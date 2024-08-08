//Ignore ts(80001)
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } = require('discord.js');
const { EmotionalJudgerModel } = require('./Say');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Emotion")
        .setType(ApplicationCommandType.Message),

    /**
     * Generates the message with the specified count.
     * @param {MessageContextMenuCommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply({ ephemeral: true });

        const message = interaction.targetMessage;
        
        interaction.editReply(`Emotion: \`${(await EmotionalJudgerModel.Run(message.content))[0].label}\`!`);
    },
}