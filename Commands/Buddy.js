const AIThinkingMessage = ":robot: The AI is thinking of a response...";
module.exports.AIThinkingMessage = AIThinkingMessage;
const AIVoiceBin = "girl.bin";
module.exports.AIVoiceBin = AIVoiceBin;
const SpokenInteractionBase = " You will enter a spoken conversation with at least one user. That being said, if you encounter multiple users at once, please look at all messages provided in order to craft your response; don't just look at exactly the last message. Also, the user saying a particular thing will be listed in parenthesis at the start of that specific message."

const { SlashCommandBuilder, CommandInteraction, ChannelType, Message } = require('discord.js');
const { execute: TranscribeExecute } = require("./Transcribe");
const { AddOnLog, GetLastMessageAndOutputChannel } = require('../TranscriptionLogger');
const { NewMessage, client, RequestChatGPT } = require('..');
const { PlayAudioToVC } = require('./TTSToVC');
const { getVoiceConnection } = require('@discordjs/voice');
const { GetUserFile } = require('../User');
const { VoiceLong } = require('../VoiceLong');
const AIWakePhrase = "computer,chat"

/**
 * @type {[{Messages: [{role: "System" | "User" | "Function" | "Assistant"; content: string;}], LastMessageTime: number, ChannelId: string, GuildId: string, AlwaysListening: boolean, Bypass: boolean, CurrentlySpeaking: boolean}]}
 */
const Conversations = [];

new Promise(async ()=> {
    // Check every 7 seconds to see if we need to respond to anything.
    while (true) {
        await new Promise(res => {
            setTimeout(() => {
                const processing = Object.keys(Conversations).map(async (convoKey) => {
                    const convo = Conversations[convoKey];
                    let messageDetails = (await GetLastMessageAndOutputChannel(convo.GuildId));
                    const voiceChannel = client.channels.fetch(convo.ChannelId);
                    // Only speak if we weren't the last one to speak, an amount of time has passed, and we aren't already currently speaking.
                    if (convo.Messages[convo.Messages.length - 1].role != "assistant" && performance.now() - convo.LastMessageTime > 1000 && !Conversations[convoKey].CurrentlySpeaking) { // Wait longer if there are more people. (await voiceChannel).memberCount * 
                        // Respond and then voice to call.
                            // Stop listening for new words.
                        Conversations[convoKey].Bypass = false;
                            // Play notification stop sound.
                        PlayAudioToVC(__dirname + "/Notification Sounds/notification stop.mp3", {
                            OutputID: Conversations[convoKey].ChannelId,
                            OutputGuildID: Conversations[convoKey].GuildId
                        })
                        
                            // Send thinking message.
                        if (messageDetails.last.author.id != client.user.id || (messageDetails.last != undefined && messageDetails.last.content.length > 1800) || messageDetails.last == undefined) {
                            messageDetails.last = messageDetails.output.send(AIThinkingMessage);
                        } else {
                            messageDetails.last.edit(`${messageDetails.last.content}\n${AIThinkingMessage}`);
                        }

                        Conversations[convoKey].CurrentlySpeaking = true;
                        RequestChatGPT(convo.Messages, messageDetails.last).then(async v => {                            
                            // First, Generate all audio.
                            let content = v[v.length - 1].content;
                            const GuildId = convo.GuildId;
                            const ChannelId = convo.ChannelId;
                            
                            await VoiceLong(GuildId, content, ChannelId);
                            Conversations[convoKey].CurrentlySpeaking = false;
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
                "Messages": NewMessage("System", (await GetUserFile(interaction.member.id)).base + SpokenInteractionBase),
                "AlwaysListening": AlwaysListening,
                "Bypass": false,
                "CurrentlySpeaking": false
            }

            // Now, add a listener.
            AddOnLog(interaction.guildId, (type, name, content) => {
                if (type == "STT" || type == "TTS") {
                    const includesPhrase = AIWakePhrase.split(",").some(v => {
                        return content.toLowerCase().includes(v.trim());
                    })

                    if (includesPhrase && !Conversations[inputId].CurrentlySpeaking) {
                        Conversations[inputId].Bypass = true;

                        // Play the notification sound.
                        PlayAudioToVC(__dirname + "/Notification Sounds/notification start.mp3", {
                            OutputID: Conversations[inputId].ChannelId,
                            OutputGuildID: Conversations[inputId].GuildId
                        })
                    }
    
                    if (AlwaysListening || Conversations[inputId].Bypass || includesPhrase) {
                        if (Conversations[inputId].Messages[Conversations[inputId].Messages.length - 1].content.startsWith(`(${name})`))
                            Conversations[inputId].Messages[Conversations[inputId].Messages.length - 1].content += ' ' + content;
                        else
                            Conversations[inputId].Messages = Conversations[inputId].Messages.concat(NewMessage("User", `(${name}) ${content}`));

                        Conversations[inputId].LastMessageTime = performance.now();

                        console.log(Conversations[inputId].Messages);
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

    VoiceLong, AIWakePhrase
}