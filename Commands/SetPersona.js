//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('setpersona')
        .setDescription('Sets your AI avatar persona.')
        .addStringOption(option => {
            return option.setName("persona")
                .setDescription("Your persona.")
                .setRequired(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});
        Index.UpdateUserPersona(interaction.user.id, interaction.options.getString("persona"))
            .then(() => {
                interaction.editReply("Persona updated! People can mention you via Global Name, Nickname, or Discord UserID.")
            })
    },
};