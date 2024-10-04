//Ignore ts(80001)
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, ButtonStyle } = require('discord.js');
const { Transcribe, Caption, Translate } = require('../VoiceV2');
const { ButtonBuilder } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');
const { Download } = require('../Gradio/Helpers');
const Path = require('path');
const fp = require('fs/promises')

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Translate to English")
        .setType(ApplicationCommandType.Message),

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