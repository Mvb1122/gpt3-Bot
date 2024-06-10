//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionsBitField } = require('discord.js');
const Gradio = require('../Gradio_Stuff.js');
const fs = require('fs');

const { ImageIsValid, Download, NonSplitTypes } = require('../Helpers.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('tags')
        .setDescription('Runs the AI backwards to tell you what tags are in an image.')
        .addAttachmentOption(option => {
            return option.setName("image")
                .setDescription("The image to find the tags of.")
                .setRequired(true)
        }),


    /**
     * Interacts with the passed message.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // If we're not connected, just say so.
        if (!await Gradio.isConnected()) return interaction.reply("Image generation not connected right now! Please try again later.")

        await interaction.deferReply();
        // Download image and tell if it's actually an image.
        const attachment = interaction.options.getAttachment("image")
        const name = attachment.name
        const url = attachment.url
        let path = `./Images/${name}`;

        if (!ImageIsValid(name))
            return interaction.editReply("You provided a non-supported image. Here are the supported types: ```" + NonSplitTypes + "```")

        try {
            // Download image.
            path = await Download(url, path);
            let tags = await Gradio.GetTagsFromImage(path);
            interaction.editReply({content: "Tags:\n```" + tags + "```", files: [path]})
                .then(() => {
                    fs.unlink(path, (e) => {if(e)console.log(e)})
                })
        } catch (e) {
            interaction.editReply("Something went wrong! You probably provided an invalid image. Error: ```" + e.name + "```");
            console.log(e);
            fs.unlink(path, (e) => {if(e)console.log(e)});
        }
    },
};
