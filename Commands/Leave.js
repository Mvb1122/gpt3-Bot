//Ignore ts(80001)
const { getVoiceConnection } = require('@discordjs/voice');
const { SlashCommandBuilder, CommandInteraction, VoiceState } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription("Disconnects the bot from a call."),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const connection = getVoiceConnection(interaction.guildId);
        if (connection != undefined) {
            connection.destroy();
            interaction.editReply("Disconnected!");
        } else {
            interaction.editReply("No call found! You can't make me leave what I'm not in!")
        }
    }
}