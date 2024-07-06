const { SlashCommandBuilder, CommandInteraction, ChannelType, Message } = require('discord.js');
const { execute: TranscribeExecute } = require("./Transcribe");
const { AddOnLog, LogTo, GetLastMessageAndOutputChannel } = require('../TranscriptionLogger');
const { NewMessage, fetchUserBase, client, RequestChatGPT } = require('..');
const { TextToVC } = require('./TTSToVC');
const AIThinkingMessage = ":robot: The AI is thinking of a response...";
const AIVoiceBin = "Biden.bin";

/**
 * @type {[{Messages: [{role: "System" | "User" | "Function" | "Assistant"; content: string;}], LastMessageTime: number, ChannelId: string, GuildId: string}]}
 */
const Conversations = [];

new Promise(async ()=> {
    // Check every 7 seconds to see if we need to respond to anything.
    while (true) {
        await new Promise(res => {
            setTimeout(() => {
                const processing = Object.keys(Conversations).map(async (convoKey) => {
                    const convo = Conversations[convoKey];
                    const messageDetails = (await GetLastMessageAndOutputChannel(convo.GuildId));
                    const voiceChannel = client.channels.fetch(convo.ChannelId);
                    if (convo.Messages[convo.Messages.length - 1].role != "assistant" && performance.now() - convo.LastMessageTime > (await voiceChannel).memberCount * 2000) { // Wait longer if there are more people.
                        // Respond and then voice to call.
                            // Send thinking message.
                        if (messageDetails.last.author.id != client.user.id || (messageDetails.last != undefined && messageDetails.last.content.length > 1800) || messageDetails.last == undefined) {
                            messageDetails.last = messageDetails.output.send(AIThinkingMessage);
                        } else {
                            messageDetails.last.edit(`${messageDetails.last.content}\n${AIThinkingMessage}`);
                        }

                        RequestChatGPT(convo.Messages, messageDetails.last).then(async v => {
                            await messageDetails.last.edit(messageDetails.last.content.replace(`\n${AIThinkingMessage}`, ""));
                            // Log the message.
                            LogTo(convo.GuildId, "AI", "AI", v[v.length - 1].content)
                            TextToVC(v[v.length - 1].content, convo.ChannelId, convo.GuildId, AIVoiceBin)
                        })
                    }
                })

                Promise.all(processing).then(() => {res()});
            }, 2000);
        })
    } 
})

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buddy')
        .setDescription("Transcribes audio to text.")
        .addSubcommandGroup(o => {
            return o.setName("mode")
                .setDescription("Transcribe a file or a voice call.")
                .addSubcommand(s => {
                    return s.setName("call")
                        .setDescription("Transcribe a voice call.")
                        .addChannelOption(op => {
                            return op.setName("input")
                                .setDescription("The voice call to transcribe.")
                                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
                                .setRequired(false);
                        })
                        .addChannelOption(op => {
                            return op.setName("output")
                                .setDescription("The text channel to transcribe into.")
                                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread)
                                .setRequired(false);
                        })
                })
                .addSubcommand(s => {
                    return s.setName("stopcall")
                        .setDescription("Stops transcribing a voice call.")
                })
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // First, start transcription.
        await TranscribeExecute(interaction);

        // Get subcommand.
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand == "call") {
            const ChannelInput = interaction.options.getChannel("input");
            const inputId = (ChannelInput != null ? ChannelInput.id : null) ?? interaction.member.voice.channelId ?? null;
            const OutputID = (interaction.options.getChannel("output") ?? {id: null}).id ?? interaction.channelId;
            if (inputId == null) return interaction.editReply("Please join or select a voice channel!");

            // Register the Conversation.
            Conversations[inputId] = {
                "ChannelId": OutputID,
                "GuildId": interaction.guildId,
                "LastMessageTime": undefined,
                "Messages": NewMessage("System", fetchUserBase(interaction.user.id))
            }

            // Now, add a listener.
            AddOnLog(interaction.guildId, (type, name, content) => {
                if (type == "STT" || type == "TTS") {
                    Conversations[inputId].Messages = Conversations[inputId].Messages.concat(NewMessage("User", `(${name}) ${content}`));
                    Conversations[inputId].LastMessageTime = performance.now();
                }
            })
        } else {
            // Remove the convo. 
            delete Conversations[interaction.channelId]
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,
}