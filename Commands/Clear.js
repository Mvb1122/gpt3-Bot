//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { ClearAll } = require('../index.js');



module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clears the AI\'s memory of a conversation.'),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        interaction.reply("Clearing...");
        ClearAll({}, interaction);
    }
};