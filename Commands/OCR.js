//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message, ButtonBuilder, EmbedBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs'), fp = require('fs/promises');
const path = require('path');
const VoiceV2 = require('../VoiceV2');
const setFile = path.resolve("./OCRSets.json");

/**
 * @type {[string]}
 */
let sets = null;

/**
 * @returns {Promise<[string]>}
 */
async function ReadSets() {
    if (fs.existsSync(setFile)) return sets = JSON.parse(await fp.readFile(setFile));
    else return sets = [];
}

async function WriteSets() {
    return fp.writeFile(setFile, JSON.stringify(sets));
}

function getJishoURL(word) {
    return `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
}

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('ocr')
        .setDescription("Creates a channel where Japanese images will be scanned and translated.")
        .addSubcommand(o => {
            return o.setName("start")
                .setDescription("Starts the channel.")
        })
        .addSubcommand(o => {
            return o.setName("stop")
                .setDescription("Stops the channel.")
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        if (sets == null) await ReadSets();

        // Defer for safety.
        await interaction.deferReply();

        if (interaction.options.getSubcommand() == 'start') {
            // Start up the channel.
                // Make a thread.
            if (interaction.channel.isThread()) return interaction.editReply("You can't use this command in a thread!");

            const thread = (await interaction.fetchReply()).startThread({
                name: "OCR Thread"
            });

            sets.push((await thread).id);
            WriteSets();
            interaction.editReply("Almost ready! Feel free to send messages and I'll translate them ASAP!");
        } else {
            // Stop the channel and archives the thread.
            if (sets.some(v => v == interaction.channelId)) {
                sets = sets.filter(v => v != interaction.channelId);
                interaction.editReply("Stopped!");
                WriteSets();

                // Quick safety check. Even though it should be fine, since only thread ids should be in the thing, this is just a precaution.
                if (interaction.channel.isThread() && !interaction.channel.archived) interaction.channel.setArchived(true, "Translation complete.");
            } else return interaction.editReply("It doesn't look like I was watching this channel! Make sure you're doing this within the thread.");
        }
    },

    // Below here is not required; should be deleted if not needed.
    /**
     * Executes code when a message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        if (sets == null) await ReadSets();

        if (message.attachments.size != 0 && sets.some(v => v == message.channelId)) {
            // Caption it.
            const caption = await VoiceV2.Caption(message.attachments.at(0).url, '<MANGA_OCR>');
            
            // Make a button for searching jisho.
            const button = new ButtonBuilder()
                .setEmoji('📖')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("jisho_button")
                .setLabel("Search up words!");

            // Because it can take some time to translate, let's just send the caption immediately.
            const content = "```\n" + caption + "\n```";
            const reply = message.reply({
                content: content,
                components: [new ActionRowBuilder().addComponents(button)]
            });

            async function EditWithTranslation() {
                // We can edit with translation now.
                const translation = await VoiceV2.Translate(caption, 'eng_Latn', 'jpn_Jpan');
                (await reply).edit(content + "\n```" + translation.translation_text + "```");
            }

            async function WaitForClicks() {
                const interaction = await (await reply).awaitMessageComponent();
                interaction.deferReply();

                // First, remove the button from the original translation message:
                (await reply).edit({components: []})

                // Ask Jisho API.
                /**
                 * @type {import('./JishoResponse').JishoResponse}
                 */
                const data = await (await fetch(getJishoURL(caption))).json();
                const firstWords = data.data.slice(0, 5);

                // Map first word to an embed.
                const embeds = firstWords.map(firstWord => {
                    return new EmbedBuilder()
                        .setTitle(firstWord.slug)
                        .addFields(firstWord.japanese.map(v => {
                            return {name: v.reading, value: v.word}
                        }))
                        .setDescription(firstWord.senses[0].english_definitions[0])
                });

                interaction.editReply({
                    content: "Here's what I found:",
                    embeds: embeds
                });
            }

            EditWithTranslation();
            WaitForClicks();
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false
}