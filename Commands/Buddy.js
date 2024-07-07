const { SlashCommandBuilder, CommandInteraction, ChannelType, Message } = require('discord.js');
const { execute: TranscribeExecute } = require("./Transcribe");
const { AddOnLog, LogTo, GetLastMessageAndOutputChannel } = require('../TranscriptionLogger');
const { NewMessage, fetchUserBase, client, RequestChatGPT } = require('..');
const { TextToVC, TextToVCWithCallback } = require('./TTSToVC');
const { getVoiceConnection } = require('@discordjs/voice');
const AIThinkingMessage = ":robot: The AI is thinking of a response...";
const AIVoiceBin = "Luminary.bin";
const AIWakePhrase = "computer"

/**
 * @type {[{Messages: [{role: "System" | "User" | "Function" | "Assistant"; content: string;}], LastMessageTime: number, ChannelId: string, GuildId: string, AlwaysListening: boolean, Bypass: boolean}]}
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
                    if (convo.Messages[convo.Messages.length - 1].role != "assistant" && performance.now() - convo.LastMessageTime > 2000) { // Wait longer if there are more people. (await voiceChannel).memberCount * 
                        // Respond and then voice to call.
                            // Send thinking message.
                        if (messageDetails.last.author.id != client.user.id || (messageDetails.last != undefined && messageDetails.last.content.length > 1800) || messageDetails.last == undefined) {
                            messageDetails.last = messageDetails.output.send(AIThinkingMessage);
                        } else {
                            messageDetails.last.edit(`${messageDetails.last.content}\n${AIThinkingMessage}`);
                        }

                            // Stop listening for new words until awoken again.
                        Conversations[convoKey].Bypass = false;

                        // I'm aware that this following section of code is vastly overcomplicated; I could generate in one go. 
                        // However, this way feels smoother to the user and also avoids running out of length on the TTS component.
                        RequestChatGPT(convo.Messages, messageDetails.last).then(async v => {
                            await messageDetails.last.edit(messageDetails.last.content.replace(`\n${AIThinkingMessage}`, ""));
                            
                            // First, Generate all audio.
                            const VoicePlaySections = [], GenerationCalls = [];
                            let content = v[v.length - 1].content;
                            const BottomEndLength = 100;
                            do {
                                // Split to a minimum length plus to next space.
                                const SplitSize = content.length > BottomEndLength ? BottomEndLength + content.substring(BottomEndLength).indexOf(" ") + 1 : content.length;
                                const thisRoundText = content.length > SplitSize ? content.substring(0, SplitSize) : content;
                                content = content.length > SplitSize ? content.substring(SplitSize) : "";

                                // Wait for both logging and voicing before continuing on.
                                const x = TextToVCWithCallback(thisRoundText, convo.ChannelId, convo.GuildId, AIVoiceBin);
                                
                                function Play() {
                                    return Promise.all([
                                        x.Play(),
                                        LogTo(convo.GuildId, "AI", "AI", thisRoundText)
                                    ])
                                }

                                VoicePlaySections.push(Play); GenerationCalls.push(x.voice);
                            } while (content.length != 0)

                            // Now that all voices are queued for generation, play them sucessively while generating the next chunk.
                                // This means that audio is generated during the previous section's playback.
                            await GenerationCalls[0]();
                            for (let i = 0; i < VoicePlaySections.length; i++) {
                                const x = VoicePlaySections[i]();
                                if (VoicePlaySections[i + 1] != undefined) GenerationCalls[i + 1]();
                                await x;
                            }
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
                        .addBooleanOption(op => {
                            return op.setName("alwayslistening")
                                .setDescription(`Whether to always listen. Defaults to false, wakes on "${AIWakePhrase}"`)
                                .setRequired(false)
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
            
            const AlwaysListening = interaction.options.getBoolean("alwayslistening") ?? false;

            // Register the Conversation.
            Conversations[inputId] = {
                "ChannelId": OutputID,
                "GuildId": interaction.guildId,
                "LastMessageTime": undefined,
                "Messages": NewMessage("System", fetchUserBase(interaction.user.id)),
                "AlwaysListening": AlwaysListening,
                "Bypass": false
            }

            // Now, add a listener.
            AddOnLog(interaction.guildId, (type, name, content) => {
                if (type == "STT" || type == "TTS") {
                    if (content.toLowerCase().includes(AIWakePhrase)) Conversations[inputId].Bypass = true;
    
                    if (AlwaysListening || Conversations[inputId].Bypass) {
                        Conversations[inputId].Messages = Conversations[inputId].Messages.concat(NewMessage("User", `(${name}) ${content}`));
                        Conversations[inputId].LastMessageTime = performance.now();
                    }
                }
            })
        } else {
            // Remove the convo. 
            delete Conversations[interaction.channelId]

            // Force disconnect.
            const connection = getVoiceConnection(interaction.guildId);
            if (connection != undefined) connection.destroy()
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,
}