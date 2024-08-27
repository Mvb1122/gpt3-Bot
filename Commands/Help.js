//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { AIParameters } = require('..');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Returns a link to the general manual of this bot.'),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        interaction.reply("Help webpage: [here](https://micahb.dev/ObsidianViewer.html?file=Markdown/General/General/GPT3%20Bot%20Manual.md) \nSupport and testing server: https://discord.gg/JNSdRSPBQ4\nCurrent AI Model: `" + AIParameters.model + "`")
    },
};