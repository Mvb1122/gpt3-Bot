//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, AutocompleteInteraction } = require('discord.js');
const fs = require('fs');
const { GetEmbeddingsToChoices, Voice } = require('../VoiceV2');
const { WriteToLogChannel } = require('../Security');
const Path = require('path')

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
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();
        const line = interaction.options.getString("line");
        const model = interaction.options.getString("model") ?? null;

        const path = Path.normalize(__dirname + `\\..\\Temp\\${interaction.user.id}_tts.wav`);
        let time = performance.now();
        try {
            Voice(line, path, model).then((val) => {
                // Save to temp folder and then send it off.
                time = performance.now() - time;
    
                interaction.editReply({content: `Here's your audio! Voiced line: \`\`\`${val.text}\`\`\`\n Time Taken: ${(time/1000).toFixed(2)}s`, files: [path]}).then(() => {
                    // Delete the image.
                    fs.unlink(path, (err) => {if (err) console.log(err)});

                    // Write to log about it.
                    WriteToLogChannel(interaction.guildId, `${interaction.user.globalName} voiced the following: \`\`\`` + line + "\`\`\`");
                })
            })
        } catch {
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
		let filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(stringValue.toLowerCase()));
        if (filtered.length > 20) filtered = filtered.slice(0, 20);
		
        // Send back our response.
        await interaction.respond(filtered);
    }
};