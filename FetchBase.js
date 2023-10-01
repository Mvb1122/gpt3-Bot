//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('./index.js');



module.exports = {
	data: new SlashCommandBuilder()
        .setName('fetchbase')
        .setDescription('Tells you what your current base is.'),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});
        const id = interaction.author ? interaction.author.id : interaction.user.id;
        const base = Index.fetchUserBase(id).substring(Index.fetchRootBase().length);
        interaction.editReply("Your current base: ```" + base + "```")
    }
};