//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
let { VCSets, WriteVCSets } = require('./TTSToVC');
const { getVoiceConnection } = require('@discordjs/voice');

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

        // Delete VCSets entry under user's id.
        let Deleted = false;
        for (let i = 0; i < VCSets.length; i++) {
            const IsUser = VCSets[i].UserID == interaction.user.id;
            const IsChannel = VCSets[i].InputID == interaction.channelId;
            
            if (IsUser && IsChannel) {
                // Try to disconnect voice.
                const connection = getVoiceConnection(VCSets[i].OutputGuildID);
                if (connection != undefined) connection.destroy()

                VCSets.splice(i, 1);
                Deleted = true;
            }
        }

        WriteVCSets(VCSets);

        if (!Deleted)
            interaction.editReply("Please run this in a channel which is reading your messages! See `/ttshelp` for more information.")
        else 
            interaction.editReply("Stopped reading your messages!");
    }
}