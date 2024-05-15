//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');


module.exports = {
	data: new SlashCommandBuilder()
        .setName('setbase')
        .setDescription('Sets the text to prime the AI with before all of your messages.')
        .addStringOption(option => {
            return option.setName("text")
                .setDescription("The text.")
                .setRequired(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});
        let userBase = interaction.options.getString("text");
        const id = interaction.author ? interaction.author.id : interaction.user.id;
        Index.UpdateUserBase(id, userBase);
        interaction.editReply({
            content: "Base set!",
        });
    }
};