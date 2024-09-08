//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('recover')
        .setDescription('Recovers the specified conversation ID.')
        .addNumberOption(option => {
            return option.setName("recoveryid")
                .setDescription("The ID to recover.")
                .setRequired(true);
        })
        .addBooleanOption(option => {
            return option.setName("overwrite")
                .setDescription("If false, just adds the conversation onto the already present one. True, erases convo and replaces.")
                .setRequired(false);
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});
        const id = interaction.options.getNumber("recoveryid");
        const overwrite = interaction.options.getBoolean("overwrite") ?? true;
        const result = JSON.parse(await Index.Recover({RecoveryID: id, Overwrite: overwrite}, interaction));
        console.log(result);
        if (result.sucessful)
            interaction.editReply("Recovered!");
        else
            interaction.editReply("Couldn't recover!" + result.reason);
    }
};