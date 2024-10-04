/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Attachment } = require('discord.js');
const { NonSplitTypes, Diarize, Transcribe } = require('../VoiceV2');
const { Download } = require('../Gradio/Helpers');
const Path = require('path');
const fp = require('fs/promises');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { urlToHttpOptions } = require('url');
const { NewMessage, GetSafeChatGPTResponse } = require('..');
const { SummarizeBase } = require('./Summarize');

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('diarize')
        .setDescription("Transcribes an audio file by person speaking.")
        .addAttachmentOption(o => {
            return o.setName("file")
                .setDescription("File to transcribe.")
                .setRequired(false);
        })
        .addStringOption(o => {
            return o.setName("url")
                .setDescription("The URL of the file to transcribe.")
                .setRequired(false);
        })
        .addNumberOption(o => {
            return o.setName("maxspeakers")
                .setDescription("The maximum number of speakers to use.")
                .setRequired(false);
        })
        .addBooleanOption(o => {
            return o.setName("notetake")
                .setDescription("Whether to have the AI take notes for you!")
                .setRequired(false);
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        if (interaction.options.getAttachment("file") == null && interaction.options.getString("url") == null) interaction.reply("Please attach a URL or file.")
            
        // Defer for safety.
        await interaction.deferReply();

        /**
         * @type {Attachment}
         */
        const atch = await GetFile();

        const IsNotAudioOrVideo = !atch.contentType.includes("audio") && !atch.contentType.includes("video");
        if (IsNotAudioOrVideo) return interaction.editReply(`Invalid file provided!\nSupported Types: \`${NonSplitTypes}\`\nGiven Type: \`${atch.contentType}\``);
        else {
            // Download main file.
            const file = await Download(atch.url, Path.resolve("./Temp/" + atch.name));
            interaction.editReply("Main file downloaded! Making timestamps and speakers...")

            // Diarize.
            const diarization = await Diarize(file, interaction.options.getNumber("maxspeakers"));

            // Transcribe each section.
                // Must be more than 0.1 seconds in length.
            let Parts = diarization
                .filter(v => v.stop - v.start > 0.1)
                .filter((v, i, a) => {
                    // Only return true if we aren't the same speaker as the previous one.
                        // If we're the same, then merge.
                    if (i <= 0) return true;
                    else {
                        let last = a[i - 1]
                        if (last.speaker == v.speaker) {
                            // Merge and return false.
                            last.stop = v.stop;
                            return false;
                        } else return true; // We're different. 
                    }
                });

            const TranscribeStartMessage = "Timestamps and Speakers gotten! Now transcribing... ";
            interaction.editReply(TranscribeStartMessage + " 0/" + Parts.length)

            let doneParts = 0;
            Parts = Parts.map(async v => {
                // console.log(v.stop - v.start);
                v.transciption = (await Transcribe(file, v.start, v.stop)).trim();

                // Update the status message.
                interaction.editReply(TranscribeStartMessage + " " + ++doneParts + "/" + Parts.length)

                let line = `${v.speaker}: ${v.transciption}`;
                return line;
            });

            Parts = await Promise.all(Parts);

            const fromDiscordFile = interaction.options.getString("url") == undefined;
            const output = Parts.join("\n");
            if (output.length <= 1900) await interaction.editReply({
                content: "```\n" + output + "```" + (fromDiscordFile ? "" : "\n[file](" + interaction.options.getString("url") + ")"),
                files: fromDiscordFile ? [file] : undefined
            });
            else {
                let temp = path.resolve("./Temp/" + interaction.user.id + "_diarization.txt");
                await fp.writeFile(temp, output);
                await interaction.editReply({
                    content: "See attached file!",
                    files: fromDiscordFile ? [temp, file] : [temp]
                });
                fp.unlink(temp);
            }

            // Delete the file after we finish transcribing it.
            fp.unlink(file);

            // If we're making notes, make them and follow up.
            if (interaction.options.getBoolean("notetake") ?? false) {
                const messages = NewMessage("System", SummarizeBase)
                    .concat(NewMessage("User", /* "That being said, please summarize this conversation:\n" + */ output + "\n\nPlease summarize the above conversation using Markdown syntax!"))
                
                const response = (await GetSafeChatGPTResponse(messages, interaction, 0, false)).data.choices[0].message.content;
                interaction.followUp({
                    content: response.length > 2000 ? "Notes were too long!" : response
                });
            }
        }

        function GetFile() {
            const Output = interaction.options.getAttachment("file");
            const webURL = interaction.options.getString("url");
            // Get file information.
            if (!Output && webURL) {
                const StartOfFileName = webURL.lastIndexOf("/") != -1 ? webURL.lastIndexOf("/") : webURL.lastIndexOf("\\");
                const end = webURL.lastIndexOf("?") != -1 ? webURL.lastIndexOf("?") : (webURL.lastIndexOf("&") != -1 ? webURL.lastIndexOf("&") : webURL.length);
                // Spoof a file attachment from the file.
                    // Download file.
                const fileName = webURL.substring(StartOfFileName, end);
                return {
                    url: webURL,
                    name: fileName,
                    contentType: "audio" // Bypass safties for URLs.
                };
            }
            else return Output;
        }
    },
}