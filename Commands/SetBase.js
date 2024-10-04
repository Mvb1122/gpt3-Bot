//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { GetUserFile } = require('../User.js');
const { Download } = require('../Gradio/Helpers.js');
const path = require('path');
const { Attachment } = require('discord.js');
const fp = require('fs/promises');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('setbase')
        .setDescription('Sets the text to prime the AI with before all of your messages.')
        .addStringOption(option => {
            return option.setName("text")
                .setDescription("The text.")
        })
        .addAttachmentOption(option => {
            return option.setName("file")
                .setDescription("A file to set your base to.")
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});

        let base = interaction.options.getString("text");

        if (base == undefined) {
            /**
             * @type {Attachment}
             */
            const attachment = interaction.options.getAttachment("file");

            if (!attachment || (attachment && !attachment.contentType.includes("text"))) return interaction.editReply("Please provide a base in either text or text file!");
            else {
                const p = await Download(attachment.url, path.resolve(`./Temp/${interaction.user.id}_Base.txt`));
                base = (await fp.readFile(p)).toString();
            }
        }

        const id = interaction.author ? interaction.author.id : interaction.user.id;
        
        const x = await GetUserFile(id)
        x.base = base;
        // Clear base face.
        x.base_face = "";
        x.base_name = "";
        x.sync();

        const text = "Base set! ```" + base + "```";
        if (text.length <= 2000)
            interaction.editReply({
                content: text,
            });
        else interaction.editReply("Base set!");
    }
};