//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { GetUserFile } = require('../User.js');
const { Download } = require('../Gradio/Helpers.js');
const path = require('path');
const { Attachment } = require('discord.js');
const fp = require('fs/promises');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('clearbase')
        .setDescription('Clears your AI base.'),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});

        const id = interaction.author ? interaction.author.id : interaction.user.id;
        
        const x = await GetUserFile(id)
        x.base = "You are a helpful assistant.";
        // Clear base face.
        x.base_face = "";
        x.base_name = "";
        x.sync();
        
        interaction.editReply("Base cleared!");
    }
};