//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('fetchpersona')
        .setDescription('Returns your AI persona.'),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});
        const persona = Index.FetchUserPersona(interaction.user.globalName);
        if (persona != "") 
            interaction.editReply(`Your persona: \`\`\`${persona}\`\`\``)
        else 
            interaction.editReply("You have not set a persona! Use `/setpersona` to set one!")
    },
};