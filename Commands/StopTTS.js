//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stoptts')
        .setDescription("Stops the TTS from reading your messages anymore."),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        let { VCSets } = require('./TTSToVC');

        // Delete VCSets entry under user's id.
        for (let i = 0; i < VCSets.length; i++) {
            if (VCSets[i].UserID == interaction.user.id) {
                VCSets = VCSets.splice(i, 1);
                require("./TTSToVC").VCSets = VCSets;
            }
        }

        interaction.editReply("Stopped reading your messages!");
    }
}