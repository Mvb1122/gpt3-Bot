/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/

//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { Download } = require('../Gradio/Helpers');
const { Embed, FileIsAudio, NonSplitTypes } = require('../VoiceV2');
const fp = require('fs/promises');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clonevoice')
        .setDescription("Clones a speaker's voice from a file for use as TTS.")
        .addAttachmentOption(o => {
            return o.setName("audioclip")
                .setDescription("The clip to clone from. Make sure it's clear!")
                .setRequired(true)
        })
        .addStringOption(o => {
            return o.setName("embedname")
                .setDescription("What to call your voice! Uses filename if blank.")
        })
        .addBooleanOption(o => {
            return o.setName("removesilence")
                .setDescription("Can improve results. Defaults to true.");
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        
        const attachment = interaction.options.getAttachment("audioclip");
        const fileName =  attachment.name;
        const url = attachment.url
        
        // Name the file after the attachment name if it's not given a name.
        const name = interaction.options.getString("embedname") ?? fileName;
        const SilenceRemove = interaction.options.getBoolean("removesilence") ?? true;
        
        let AudioPath;
        
        if (!FileIsAudio(fileName))
            return interaction.editReply("You provided a non-supported audio/video file! Here are the supported types: ```" + NonSplitTypes + "```\nSee `/ttshelp` for more information.")
        else 
            try {
                AudioPath = await Download(url, `./Temp/${fileName}`);
                Embed(AudioPath, `./Speaker Wavs/${name}.wav`, SilenceRemove).then(() => {
                    interaction.editReply("Embed processed! It should be available on the `/ttstovc` and `/voice` commands immediately!");

                    // Delete the original audio.
                    fp.unlink(AudioPath);
                })
            } catch (e) {
                interaction.editReply("Please check your file! Something went wrong.\n```" + e + "```");
            }
    },
}