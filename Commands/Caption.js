/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, VoiceState, Attachment } = require('discord.js');
const { Download } = require('../Gradio/Helpers');
const { Caption } = require('../VoiceV2');
const Path = require('path');
const fp = require('fs/promises');

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('caption')
        .setDescription("Captions an image!")
        .addAttachmentOption(o => {
            return o.setName("image")
                .setDescription("What to caption.")
                .setRequired(false);
        })
        .addStringOption(o => {
            return o.setName("url")
                .setDescription("URL of image to be captioned")
                .setRequired(false);
        })
        .addStringOption(o => {
            return o.setName("mode")
                .setDescription("How to caption!")
                .setRequired(false)
                .addChoices([
                    { name: "Normal", value: "<CAPTION>" },
                    { name: "Detailed Caption", value: "<DETAILED_CAPTION>" },
                    { name: "Most Detailed Caption", value: "<MORE_DETAILED_CAPTION>" },
                    { name: "OCR / Read Text", value: "<OCR>" },
                    { name: "OCR with Region", value: "<OCR_WITH_REGION>" },
                    { name: "Japanese OCR", value: "<MANGA_OCR>"},
                    { name: "Object Detection", value: "<OD>" },
                    { name: "Dense Region Detection", value: "<DENSE_REGION_CAPTION>"},
                    { name: "Region Proposal", "value": "REGION_PROPOSAL"}
                ]);
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        /**
         * @type {Attachment}
         */
        const image = interaction.options.getAttachment("image") ?? interaction.options.getString("url");
        if (image == undefined) return interaction.editReply("Please provide either an image or a URL!");

        // If this is an image file, use the URL, otherwise, use the image (string) as a url.
        let path = image.url ? image.url : image;
        const mode = interaction.options.getString("mode") ?? "<CAPTION>";
        let caption = await Caption(path, mode);

        let captionString = JSON.stringify(caption);
        if (captionString.length < 2000)
            await interaction.editReply({content: "Caption: ```" + captionString + "```", files: [caption.image ? caption.image : path]});
        else {
            // Write to a file. 
            const captionPath = "./Temp/file_" + interaction.user.id + ".txt";
            await fp.writeFile(captionPath, captionString);
            await interaction.editReply({content: "Caption in below file.", files: [caption.image ? caption.image : path, captionPath]});
            fp.unlink(captionPath)
        }
        
        if (caption.image) fp.unlink(caption.image);
    }
}