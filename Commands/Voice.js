//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const fs = require('fs');
const { Voice, GetEmbeddingsToChoices } = require('../VoiceV2');

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
                .setChoices(GetEmbeddingsToChoices())
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();
        const line = interaction.options.getString("line");
        const model = interaction.options.getString("model") ?? undefined;

        const path = __dirname + `/../Temp/${interaction.user.id}_tts.wav`;
        Voice(line, path, model).then(() => {
            // Save to temp folder and then send it off.
            interaction.editReply({content: `Here's your audio! Voiced line: \`\`\`${line}\`\`\``, files: [path]}).then(() => {
                // Delete the image.
                fs.unlink(path, (err) => {if (err) console.log(err)});
            })
        })
    }
};