//Ignore ts(80001)
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } = require('discord.js');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("👁 Translate to English")
        .setType(ApplicationCommandType.Message),

    /**
     * Generates the message with the specified count.
     * @param {MessageContextMenuCommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();
        
        // Get content.
        const message = interaction.targetMessage;
        
        if (message.content == undefined) return interaction.editReply("This message has no content!");
        else {
            const translation = await Translate(message.content, "auto", "auto")
            interaction.editReply(translation.translation_text);
        }
    },
}