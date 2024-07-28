/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/

//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, ChannelType, VoiceState } = require('discord.js');
const { Conversation } = require('../MultiAIConvo/Convo');
const { LogTo, AddOnLog } = require('../TranscriptionLogger');
const { VoiceLong, AIWakePhrase } = require('./Buddy');
const { execute: TranscribeExecute } = require('./Transcribe');
const { NewMessage } = require('..');

/**
 * Array of "input" ChannelIDs for current podcasts.
 * @type {[String]}
 */
let calls = []

/**
 * Array of "input" ChannelIDs for whether a call has a human speaker in it or not.
 * @type {{"input": number}}
 */
let lastMessageTime = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('podcast')
        .setDescription("Makes AI talk to themselves, plus you.")
        .addSubcommandGroup(o => {
            return o.setName("action")
                .setDescription("What to do.")
                .addSubcommand(s => {
                    return s.setName("call")
                        .setDescription("Transcribe a voice call.")
                        .addStringOption(option => {
                            return option.setName("topic")
                                .setDescription("conversation topic")
                                .setRequired(true)
                        })
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
        // Start transcription.
        await TranscribeExecute(interaction);


        if (interaction.options.getSubcommand() == "call") {
            const topic = interaction.options.getString("topic");
            const ChannelInput = interaction.options.getChannel("input");
            const alwayslistening = interaction.options.getBoolean("alwayslistening")
            
            /**
             * Voice output channelID.
             * @type {string}
             */
            const input = (ChannelInput != null ? ChannelInput.id : null) ?? interaction.member.voice.channelId ?? null;
            if (input == null) return interaction.editReply("Please select or join a voice channel!");

            // Add to output array.
            calls.push(input);
            
            const conversation = new Conversation(topic);
            
            // Temporary testing code.
            interaction.editReply("Conversation loading... I'll join VC in a second! Prompt: ```\n" + topic + "```");
            AddOnLog(interaction.guildId, (t, n, c) => {
                // Add this to the messages.
                const ShouldBeListenedTo = alwayslistening ? true : c.includes(AIWakePhrase);
                console.log(c)
                if (t == "STT" || t == "TTS" && ShouldBeListenedTo) {
                    conversation.DistributeMessage(NewMessage("User", c, n)[0], n);
                    lastMessageTime[input] = performance.now();
                }
            })

            // When we start, set the last message time to 1500ms ago.
            lastMessageTime[input] = performance.now() - 3000;
            do {
                await new Promise(async res => {
                    // Wait for a sec'n if someone just talked. (To let them talk again.)
                    if (performance.now() - lastMessageTime[input] < 3000) 
                        await new Promise((r) => {
                            setTimeout(() => {
                                r();
                            }, 3000);
                        })
                    const response = await conversation.GenerateNext(interaction);
                    lastMessageTime[input] = performance.now();
                    Promise.allSettled([
                        LogTo(interaction.guildId, "AI", response.chatter.name, response.content),
                        VoiceLong(interaction.guildId, response.content, input, response.chatter.PreferredVoice, false)
                    ]).then(() => {
                        setTimeout(() => {
                            res();
                        }, 300);
                    });
                });
                // Break this loop when the call has been invalidated.
            } while (calls.includes(input));
        } else {
            /**
             * @type {VoiceState}
             */
            const vc = interaction.member.voice;
            if (vc == null || (vc != null && vc.channel == null)) return interaction.editReply("Join a call please.")

            // Remove from calls array.
            if (calls.indexOf(vc.channelId) != -1) {
                calls.splice(calls.indexOf(vc.channelId), 1);
                delete lastMessageTime[vc.channelId];
                return interaction.editReply("Stopped podcasting.");
            } else return interaction.editReply("I'm not podcasting? Weird.")
        }
    },
}