//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { GetUserFile } = require('../User.js');


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
        
        const x = await GetUserFile(id)
        x.base = userBase;
        x.sync();

        interaction.editReply({
            content: "Base set! ```" + userBase + "```",
        });
    }
};