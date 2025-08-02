//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Attachment } = require('discord.js');
const { DownloadToBase64String } = require('../LlamaSupport');
const { NewMessage, GetSafeChatGPTResponse } = require('..');
const TemporaryModel = require('../Model Configs/TemporaryModel');
const RecommendedModels = require('../Model Configs/RecommendedModels');
const pointBase = "Please output a Point2D JSON object locating: "

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('point')
        .setDescription("Uses AI to find where to point.")
        .addStringOption(option => {
            return option.setName("object")
                .setDescription("Where to point.")
                .setRequired(true)
        })
        .addAttachmentOption(option => {
            return option.setName("image")
                .setDescription("Image to look at.")
                .setRequired(true);
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const object = pointBase + interaction.options.getString("object");
        /**
         * @type {Attachment}
         */
        const image = interaction.options.getAttachment("image");
        const b64 = await DownloadToBase64String(image.url);

        const messages = NewMessage("User", [
            {
                type: "text",
                text: object
            },
            {
                type: "image_url",
                image_url: {
                    url: b64
                }
            }
        ]);

        // Use pointing model.
        // const temp = new TemporaryModel(RecommendedModels.pointing);
        const resp = await GetSafeChatGPTResponse(messages, interaction, 0, false);
        // temp.end();

        interaction.editReply("```json\n" + resp.data.choices[0].message.content + "```");
    }
}