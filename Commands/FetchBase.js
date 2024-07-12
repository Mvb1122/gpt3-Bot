//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, User } = require('discord.js');
const { GetUserFile } = require('../User.js');



module.exports = {
	data: new SlashCommandBuilder()
        .setName('fetchbase')
        .setDescription('Tells you what your current base is.')
        .addBooleanOption(o => {
            return o.setName("hidden")
                .setDescription("Whether to show your base to everyone.")
                .setRequired(false);
        })
        .addUserOption(o => {
            return o.setName("user")
                .setDescription("What user to read. Defaults to oneself.")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        let ephemeral = interaction.options.getBoolean("hidden") ?? true;

        // Don't let people secretly read others' bases.
        let pronoun = "Your"
        if (interaction.options.getUser("user")) {
            ephemeral = false;
            pronoun = interaction.options.getUser("user").displayName + "'s"
        }
        
        await interaction.deferReply({ephemeral: ephemeral});
        
        const id = (interaction.options.getUser("user") ?? {id: null}).id ?? interaction.user.id;

        const base = (await GetUserFile(id, false)).base;
        interaction.editReply(`${pronoun} current base:` + "```" + base + "```")
    }
};