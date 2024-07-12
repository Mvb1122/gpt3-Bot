//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');
const { GetUserFile } = require('../User.js');

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

        let persona = interaction.options.getString("persona");
        const id = interaction.author ? interaction.author.id : interaction.user.id;
        
        const x = await GetUserFile(id)
        x.persona = persona;
        x.sync();

        interaction.editReply({
            content: "Persona set! ```" + persona + "```",
        });
    },
};