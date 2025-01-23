//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, AutocompleteInteraction, ChannelType, Message } = require('discord.js');
const fs = require('fs');
const fp = require('fs/promises');
const { GetEmbeddingsToChoices, Voice, ListEmbeddings, } = require('../VoiceV2');
const { WriteToLogChannel } = require('../Security');
const Path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Use AI to voice words!')
        .addStringOption(option => {
            return option.setName("line")
                .setDescription("The line to voice.")
                .setRequired(true)
        })
        .addStringOption(o => {
            return o.setName("model")
                .setDescription("The Model to use.")
                .setAutocomplete(true)
        })
        .addBooleanOption(o => {
            return o.setName("fixtext")
                .setDescription("Whether to turn everything into letters. eg; 1 -> \"one\"")
                .setRequired(false)
        })
        .addBooleanOption(o => {
            return o.setName("demo")
                .setDescription("Whether to run on all voices!")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();
        const line = interaction.options.getString("line");
        const model = interaction.options.getString("model") ?? null;
        const fixtext = interaction.options.getBoolean("fixtext") ?? true;
        const demo = interaction.options.getBoolean("demo") ?? false;

        const path = Path.normalize(__dirname + `\\..\\Temp\\${interaction.user.id}_tts.wav`);
        let time = performance.now();
        try {
            if (!demo)
                Voice(line, path, model, fixtext).then((val) => {
                    // Save to temp folder and then send it off.
                    time = performance.now() - time;
        
                    interaction.editReply({content: `Here's your audio! Voiced line: \`\`\`${val.text}\`\`\`\n Time Taken: ${(time/1000).toFixed(2)}s`, files: [path]}).then(() => {
                        // Delete the image.
                        fs.unlink(path, (err) => {if (err) console.log(err)});

                        // Write to log about it.
                        WriteToLogChannel(interaction.guildId, `${interaction.user.globalName} voiced the following: \`\`\`` + line + "\`\`\`");
                    })
                })
            else {
                // Voice on all embeds.
                let promises = ListEmbeddings().map(async (v, i) => {
                    const thisPath = path.replace("tts", v + "_tts");
                    await Voice(line, thisPath, v, fixtext);
                    return thisPath;
                });

                await Promise.all(promises);

                // Send all files, in groups of ten.
                let reply = await interaction.editReply("See below!");
                do {
                    const snipLength = promises.length > 10 ? 10 : promises.length;
                    let slice = promises.slice(0, snipLength);
                    promises = promises.slice(snipLength);
                    reply = await reply.reply({
                        files: await Promise.all(slice)
                    });
                } while (promises.length != 0)

                // After all parts are sent, delete all files.
                await reply;
                (await Promise.all(promises)).forEach(v => fp.unlink(v));
            }
        } catch (e) {
            console.log(e);
            return await interaction.editReply("Your text was too long! Please cut it shorter.");
        }
    },

    /**
     * @param {AutocompleteInteraction} interaction The Autocomplete request.
     */
    async OnAutocomplete(interaction) {
        // Get active embeddings.
        const choices = GetEmbeddingsToChoices();
        
        // Get what the user has currently typed in.
        const stringValue = interaction.options.getFocused();
        
        // Filter to just matching ones. Also, cut off if we have more than twenty responses.
		let filtered = choices.filter(choice => choice.name.toLowerCase().trim().startsWith(stringValue.toLowerCase().trim()));
        if (filtered.length > 20) filtered = filtered.slice(0, 20);
		
        // Send back our response.
        await interaction.respond(filtered);
    },
};