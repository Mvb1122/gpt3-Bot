//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demo')
        .setDescription("demo")
        .addStringOption(option => {
            return option.setName("demo")
                .setDescription("demo")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const demo = interaction.options.getString("demo") ?? null; // If required then you can remove the ?? null.
    }
}