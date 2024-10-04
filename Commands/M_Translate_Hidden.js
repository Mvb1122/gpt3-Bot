//Ignore ts(80001)
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } = require('discord.js');
const { Translate } = require('../VoiceV2');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Translate to English [HIDDEN]")
        .setType(ApplicationCommandType.Message)
        .setNameLocalization('ja', "翻訳する"),

    /**
     * Generates the message with the specified count.
     * @param {MessageContextMenuCommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply({ ephemeral: true });
        
        // Get content.
        const message = interaction.targetMessage;
        
        if (message.content == undefined) return interaction.editReply("This message has no content!");
        else {
            const translation = await Translate(message.content, "auto", "auto")
            interaction.editReply(translation.translation_text);
        }
    },
}