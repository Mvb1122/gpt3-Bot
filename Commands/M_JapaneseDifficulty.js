//Ignore ts(80001)
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, Routes } = require('discord.js');
const { EmotionalJudgerModel } = require('./Say');
const { NewMessage } = require('..');
const LLMJudge = require('../LLMJudge');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("JP Difficulty")
        .setType(ApplicationCommandType.Message),

    /**
     * Generates the message with the specified count.
     * @param {MessageContextMenuCommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply({ ephemeral: false });

        const message = interaction.targetMessage;

        // Use the LLM Judge.
        const messages = NewMessage("System", "You are an expert at Japanese-to-English translation, and you accurately know grammatical structures involved with writing every message. When given a message in Japanese text, you will provide an intimate explanation of the vocabulary in a text, then followed by a simple list of the grammatical structures, and *then* finally a translation of the text where the translation is written like || TRANSLATION ||, where TRANSLATION is the English text. Additionally, at the end of your response, you will classify the sentence to one of five difficulties: LOW, INTERMEDIATE-LOW, MEDIUM, INTERMEDIATE, and HIGH.")
            .concat(NewMessage("User", message.content ?? "EMPTY MESSAGE"));

        const result = await LLMJudge(messages, ["LOW", "INTERMEDIATE-LOW", "MEDIUM", "INTERMEDIATE", "HIGH"]);

        const MessageLink = message.url;
        const output = `[The message](${MessageLink}) appears to be of **${result.toLowerCase()}** difficulty!`; // `" + message.content + "`

        return await interaction.editReply(output);
    },
}