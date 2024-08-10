//Ignore ts(80001)
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, ButtonStyle } = require('discord.js');
const { Transcribe } = require('../VoiceV2');
const { ButtonBuilder } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');
const { Download } = require('../Gradio/Helpers');
const Path = require('path');
const fp = require('fs/promises')

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Transcribe File")
        .setType(ApplicationCommandType.Message),

    /**
     * Generates the message with the specified count.
     * @param {MessageContextMenuCommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply({ ephemeral: true });
        
        // Get attachments.
        const message = interaction.targetMessage;
        let attachments = message.attachments;

        if (attachments.size == 0) interaction.editReply("This message has no attachments to transcribe!");

        if (attachments.size > 1) {
            /**
             * @type {ButtonBuilder[]}
             */
            let buttons = RemakeButtons();

            const row = new ActionRowBuilder()
                .addComponents(buttons.slice(0, 5))

            const InteractionContent = {
                content: `Please select an attachment: ${buttons.length > 5 ? "\nUnlisted attachments will become visible after transcribing the ones in the way." : ""}`,
                components: [row]
            };

            const response = interaction.editReply(InteractionContent);

            async function AwaitResponse() {
                const click = await (await response).awaitMessageComponent();
                click.deferReply({ ephemeral: true })

                // Find the file.
                const file = attachments.find(v => {
                    return v.name == click.customId;
                })            
                
                // Remove the button.
                    // Remove the attachment.
                attachments.sweep(v => {
                    return v.name == click.customId;
                });
                
                // If there's still stuff left, remake the buttons without the one we clicked.
                buttons = RemakeButtons();
                if (buttons.length != 0) {
                    const row = new ActionRowBuilder().addComponents(buttons.slice(0, 5));
                    InteractionContent.components = [row];
                    interaction.editReply(InteractionContent);
                } else {
                    // If there's nothing left, delete the original reply.
                    if ((await interaction.fetchReply()).deletable) interaction.deleteReply();
                }

                // Re-Register to wait for another click.
                if (buttons.length != 0)
                    AwaitResponse();
                
                // Download and transcribe.
                const p = await Download(file.url, Path.resolve(`./Temp/${file.name}`));
                const transcription = await Transcribe(p);
                fp.unlink(p);
                click.editReply('Transcription: ```' + transcription + "```");
            }
            AwaitResponse();
        } else if (attachments.size == 1) {
            // Transcribe first file.
            const file = message.attachments.at(0);
            const p = await Download(file.url, Path.resolve(`./Temp/${file.name}`));
            const transcription = await Transcribe(p);
            await interaction.editReply('Transcription: ```' + transcription + "```");
            fp.unlink(p);
        }

        function RemakeButtons() {
            buttons = [];
            attachments.forEach((file, key) => {
                if (file.contentType.includes("audio") || file.contentType.includes("video")) {
                    // Add a button.
                    const b = new ButtonBuilder()
                        .setCustomId(file.name)
                        .setLabel(file.name)
                        .setStyle(ButtonStyle.Primary);

                    buttons.push(b);
                }
            });
            return buttons;
        }
    },
}