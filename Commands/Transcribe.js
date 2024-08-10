//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, ChannelType, VoiceChannel, GuildMember, VoiceState, Message, NewsChannel } = require('discord.js');
const { Download } = require('../Gradio/Helpers');
const { Transcribe, FileIsAudio, NonSplitTypes, PreloadTranscribe } = require('../VoiceV2');
const fp = require('fs/promises');
const fs = require('fs');
const { ConnectToChannel } = require('./TTSToVC');
const { getVoiceConnection, VoiceConnection, EndBehaviorType } = require('@discordjs/voice');
const { client, DEBUG } = require('..');
const prism = require('prism-media');
const { LogTo, StartLog, StopLog, HasLog, GetLogId, AddOnLog } = require('../TranscriptionLogger');

/**
 * Ensures that a voice connection to a channel exists.
 * @param {VoiceChannel} channel 
 * @returns {Promise<VoiceConnection>} The connection. 
 */
async function EnsureHasConnectionTo(channel) {
    if (getVoiceConnection(channel) == undefined)
        return await ConnectToChannel({ OutputGuildID: channel.guildId, OutputID: channel.id });
    else return getVoiceConnection(channel);
}

function TranscribeURL(url, name) {
    return new Promise(async res => {
        // Load audio data
        const path = await Download(url, `./Temp/${name}`)
        Transcribe(path).then(v => {
            fp.unlink(path);
            res(v);
        });
    })
}

const SubscribedMembers = [];

/**
 * Subscribes transcription onto a user.
 * @param {GuildMember} user User to subscribe transcription onto.
 * @param {{ Output: number; Input: number, UseWH: boolean }} set to transcribe to. 
 */
async function SubscribeTranscribe(user, set, bypassSubscribedMembers = false) {
    // Prevent subscribing to a user twice.
    if (!bypassSubscribedMembers) {
        const UserGuildId = `${user.guild.id}|${user.id}`;
        if (SubscribedMembers.indexOf(UserGuildId) == -1) {
            // Add to the list, but also allow our recursions to bypass this if we're adding a new person.
            SubscribedMembers.push(UserGuildId); 
            bypassSubscribedMembers = true;
        }
    }

    // Subscribe to the user's audio.
    const connection = await EnsureHasConnectionTo(await client.channels.fetch(set.Input))
    const subscription = connection.receiver.subscribe(user.id, 
        { 
            end: { 
                behavior: EndBehaviorType.AfterSilence, 
                duration: 100 
            }
        }
    );

    let path = MakeRandomPath();
    const writeStream = fs.createWriteStream(path);

    const opusDecoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000,
    });

    subscription.pipe(opusDecoder).pipe(writeStream);
    
    let start = 0;
    subscription.on("data", () => {
        if (start == 0) {
            start = performance.now();
        }
    })

    subscription.on('close', async () => {
        const TimeTaken = performance.now() - start;
        
        // Only transcribe if they were talking for more than 1/3 second.
        if (TimeTaken >= 500)
            Transcribe(path).then(async val => {
                val = val.trim();
                const Name = user.nickname ?? user.displayName;
                if (val.toLowerCase() == "you" || val == "") return;

                // Always delete file.
                fp.unlink(path);
                
                // const channel = client.channels.fetch(set.Output);
                await LogTo(user.guild.id, "STT", Name, val, user.id);
            }, () => {
                // If the transcription fails, just unlink the audio file, I guess.
                try {
                    fp.unlink(path);
                } catch { ; } // Do nothing.
            })

        else // Just delete the file.
            try { 
                fp.unlink(path) 
            } catch { ; } // Do nothing.

        // If this set is still in the list, then keep transcribing.
        if (TranscribingSets.indexOf(set) != -1) SubscribeTranscribe(user, set);
    });
}

let TranscribingSets = [
    {
        Output: 1234, // Text channel ID.
        Input: 1234 // Voice channel ID. 
    }
];
TranscribingSets = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transcribe')
        .setDescription("Transcribes audio to text.")
        .addSubcommandGroup(o => {
            return o.setName("mode")
                .setDescription("Transcribe a file or a voice call.")
                .addSubcommand(s => {
                    return s.setName("file")
                        .setDescription("Transcribe a file.")
                        .addAttachmentOption(option => {
                            return option.setName("voice")
                                .setDescription("The voice you want to transcribe.")
                                .setRequired(true)
                        })
                })
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
                            return op.setName("usewh")
                                .setDescription("Whether to impersonate the users.")
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
        await interaction.deferReply();

        // Get subcommand.
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "file") {
            const attachment = interaction.options.getAttachment("voice")
            const url = attachment.url, name = attachment.name;
            if (!FileIsAudio(name)) return interaction.editReply("You provided a non-supported audio/video file! Here are the supported types: ```" + NonSplitTypes + "```\nSee `/ttshelp` for more information.");

            // return interaction.editReply("You provided a non-supported image. Here are the supported types: ```" + "Actually I'm not sure what's supported, but if it broke, then it's probably not supported." + "```")
            try {
                let TimeTaken = performance.now();
                TranscribeURL(url, name).then(async val => {
                    TimeTaken = ((performance.now() - TimeTaken) / 1000).toFixed(2);
                    const NormalContent = "```" + val + "```\nTime Taken: " + TimeTaken + " seconds";
                    if (NormalContent.length >= 2000) {
                        await interaction.editReply({
                            content: "```See below!```\nTime Taken: " + TimeTaken + " seconds",
                            files: [url]
                        });

                        let NumMessages = 1;
                        do {
                            let end = val.length >= 2000 ? 2000 : val.length
                            if (NumMessages == 1)
                                await interaction.followUp(val.substring(0, end));
                            else await interaction.channel.send(val.substring(0, end));
                            val = val.substring(end);
                            NumMessages++;
                        } while (val.length != 0)
                    } else
                        interaction.editReply({
                            content: NormalContent,
                            files: [url]
                        });
                })
            } catch (e) {
                interaction.editReply("Something went wrong! ```" + e + "```");
            }
        } else if (subcommand == "call") {
            // Check if this call is already being transcribed.
            if (HasLog(interaction.guildId))
                return interaction.editReply(`There's already a transcription ongoing in this server! Please stop the other before starting. Transcription channel: <#${GetLogId(interaction.guildId)}>`)
            

            interaction.editReply("I'll join in a second! Once I'm in, I'll be listening. You can run `/transcribe mode stopcall` to stop.");

            /**
             * @type {VoiceChannel}
             */
            let input;

            // Select the output text channel.
            const output = interaction.options.getChannel("output") ?? interaction.channel;

            // Get UseWH.
            const UseWH = interaction.options.getBoolean("usewh") ?? false;

            // Select the input voice channel.
            const ChannelInput = interaction.options.getChannel("input");
            const inputId = (ChannelInput != null ? ChannelInput.id : null) ?? interaction.member.voice.channelId ?? null;
            if (inputId == null) return interaction.editReply("Please join or select a voice channel!");
            else input = await client.channels.fetch(inputId);

            // Make up a transcribing set.
            const set = {
                Output: output.id,
                Input: input.id, 
                UseWH: UseWH
            }
            TranscribingSets.push(set);

            // Because this will make lots of calls to transcribe, force it to be preloaded before we actually start transcribing anything.
            await PreloadTranscribe()
            
            // Join voice call, subscribe to all people.
                // EnsureHasConnectionTo(input);
            // Start the logger thing.
            StartLog(interaction.guildId, set.Output, set.UseWH);

            // If we're in DEBUG mode, log all transcriptions.
            if (DEBUG)
                AddOnLog(interaction.guildId, (f, n, c) => {
                    console.log(`[${f}] ${n}: ${c}`);
                })

            input.members.forEach(member => {
                if (!member.user.bot) // Only transcribe people.
                    SubscribeTranscribe(member, set);
            });

            return;
        } else if (subcommand == "stopcall") {
            const VoiceID = interaction.member.voice.channelId ?? null;
            if (VoiceID == null) return interaction.editReply("Please join the call you wish to stop transcribing.");
            
            let removed = false; 
            for (let i = 0; i < TranscribingSets.length; i++)
                if (TranscribingSets[i].Input == VoiceID) {
                    // Try to leave VC.
                    const connection = getVoiceConnection(interaction.guildId);
                    if (connection != undefined) connection.destroy()

                    TranscribingSets.splice(i, 1);
                    removed = true;

                    // Also stop the logger.
                    StopLog(interaction.guildId);
                }

            if (removed)
                interaction.editReply("Stopped listening!")
            else
                interaction.editReply("It doesn't look like I was listening!")
        }
    },

    // Export transcribe methods.
    TranscribeURL,

    /**
     * Handles people joining/leaving call causing voice subscription requirements. 
     * @param {VoiceState} oldState 
     * @param {VoiceState} newState 
     */
    OnVoiceStateUpdate(oldState, newState) {
        // Look to see if they joined a channel we're transcribing.
        if (!newState.member.user.bot && SubscribedMembers.indexOf(`${newState.guild.id}|${newState.member.id}`) == -1) // Only transcribe people.
            for (let i = 0; i < TranscribingSets.length; i++) 
                if (newState.channelId == TranscribingSets[i].Input) {
                    SubscribeTranscribe(newState.member, TranscribingSets[i]);
                    break;
                }

        // ! This function also handles mute/unmute/join/leave events!
        // Check if they're joining.
        const NewConnection = oldState.channelId === null || typeof oldState.channelId == 'undefined';
        const ConnectionDestroyed = newState.channelId === null || typeof newState.channelId == 'undefined';
        const Name = newState.member.nickname ?? newState.member.displayName;
        if (NewConnection)
            return LogTo(newState.guild.id, "Join", Name)

        if (ConnectionDestroyed) 
            return LogTo(newState.guild.id, "Leave", Name);

        // Check if they're muting/unmuting.
        if (!NewConnection && oldState.mute != newState.mute) {
            switch (newState.mute) {
                case true:
                    LogTo(newState.guild.id, "Mute", Name)
                    break;
            
                default:
                    LogTo(newState.guild.id, "Unmute", Name)
                    break;
            }
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,
}

function MakeRandomPath() {
    return `./Temp/${(Math.random() * 10000).toFixed(0)}.pcm`;
}
