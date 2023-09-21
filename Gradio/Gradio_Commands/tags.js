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
        await interaction.deferReply();
        // Download image and tell if it's actually an image.
        const attachment = interaction.options.getAttachment("image")
        const name = attachment.name
        const url = attachment.url

        if (!ImageIsValid(name))
            return interaction.editReply("You provided a non-supported image. Here are the supported types: ```" + NonSplitTypes + "```")

        try {
            // Download image.
            let path = await Download(url, `./Images/${name}`);
            let tags = await Gradio.GetTagsFromImage(path);
            interaction.editReply({content: "Tags:\n```" + tags + "```", files: [path]})
                .then(() => {
                    fs.unlink(path, (e) => {if(e)console.log(e)})
                })
        } catch (e) {
            interaction.editReply("Something went wrong! You probably provided an invalid image. Error: ```" + e.name + "```");
            fs.unlink(path, (e) => {if(e)console.log(e)});
        }
    },
};
