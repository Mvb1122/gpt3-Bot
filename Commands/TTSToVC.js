//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message, ChannelType, AudioPlayer, VoiceChannel } = require('discord.js');
const { VoiceConnectionStatus, createAudioPlayer, NoSubscriberBehavior, joinVoiceChannel, createAudioResource, getVoiceConnection, VoiceConnection } = require('@discordjs/voice');
const { Voice, GetEmbeddingsToChoices, DefaultEmbedding } = require('../VoiceV2');
const { client } = require('../index');
const fs = require('fs');
const { WriteToLogChannel, HasPolicy, GetPolicy } = require('../Security');
const { HasLog, LogTo } = require('../TranscriptionLogger');
const VoiceV2 = require('../VoiceV2');

function getPlayer() {
    return createAudioPlayer(
        {
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
            },
        },
    );
}

/**
 * @param {String} path Path to sound file.
 * @param {{
    UserID: number;
    InputID: number;
    OutputID: number;
    OutputGuildID: number;
    Player: AudioPlayer;
}} set Set information.
 * @param {Number} guild GuildID
 */
function PlayAudioToVC(path, set) {
    return new Promise(async res => {
        // Make sure we have a voice connection to the channel.
        await ConnectToChannel(set)
        
        // Now that we're sure we have a connection, play the thing.
        const resource = createAudioResource(path);
        set.Player.play(resource);
        
        // When the player has finished playing, resolve the promise.
        set.Player.once('idle', () => {
            res();
        })
    })
}

/**
 * A function which ensures that a set's player is hooked up to a connection to its specified OutputID channel.
 * @param {{
    UserID: number;
    InputID: number;
    OutputID: number;
    OutputGuildID: number;
    Player: AudioPlayer;
}} set Set information.
 * @returns {Promise<VoiceConnection>} Promise which resolves when connected.
 */
function ConnectToChannel(set) {
    return new Promise(async (res) => {
        let Connection = getVoiceConnection(set.OutputGuildID);

        if (Connection != undefined) {
            // Add the player.
            if (set.Player != undefined)
                Connection.subscribe(set.Player);

            return res(Connection);
        } else {
            const guild = await client.guilds.fetch(set.OutputGuildID);
            const adapterCreator = guild.voiceAdapterCreator;

            Connection = joinVoiceChannel({
                channelId: set.OutputID,
                guildId: set.OutputGuildID,
                adapterCreator: adapterCreator,
                selfDeaf: false,
                selfMute: false
            });
            
            Connection.on(VoiceConnectionStatus.Ready, async () => {
                if (set.Player != undefined)
                    Connection.subscribe(set.Player);
                return res(await Connection);
            }, { once: true });
        }
    });
}

/**
 * @type {{
    UserID: number;
    InputID: number;
    OutputID: number;
    OutputGuildID: number;
    Player: AudioPlayer;
    Model: string
}[]}
 */
let VCSets = []

// Load VCSets on boot and save on exit.
function LoadSets() {
    if (fs.existsSync(VCSetsFile)) {
        VCSets = JSON.parse(fs.readFileSync(VCSetsFile));

        // Add new players.
        for (let i = 0; i < VCSets.length; i++) {
            VCSets[i].Player = getPlayer();
        }
    }
}

const VCSetsFile = "./VCSets.json";
LoadSets();

/**
* Adds a user set list thing to the VCSets list.
* @param {{
UserID: string;
InputID: string;
OutputID: string;
OutputGuildID: string;
Player: string | null;
Model: string | null;
}} set The set to register.
* @returns {string} The status message.
*/
async function Register(set) {
    // Look to see if this set has already been created.
    const keys = Object.keys(set);
    for (let i = 0; i < VCSets.length; i++)
        if (VCSets[i].UserID == set.UserID && set.InputID == VCSets[i].InputID) {
            let same = [], different = [];
            keys.forEach((key) => {
                if (set[key] == VCSets[i][key]) {
                    same.push(key);
                } else different.push(key)
            })

            different.splice(different.indexOf("Player"), 1) // Remove player from different list. (It's always different.)

            // If model is the same, then replace. Otherwise, warn the user.
            if (same.length == keys.length - 1) { // `keys.length - 1` is the length of the whole set object without the player, which will never be the same.
                return "You've already set this up! Try running `/stoptts` if you want to turn it off.";
            } else {
                // Update.
                VCSets.splice(i, 1);
                VCSets.push(set);
                WriteVCSets(VCSets);
                return `Link updated! (You already had TTS setup, except these changed: \`${different.join(", ")}\`)`;
            }
        }

    // Add the set and write.
    VCSets.push(set);

    WriteVCSets(VCSets);
}

function WriteVCSets(sets = VCSets) {
    try {
        // Also set VCSets here.
        VCSets = sets;
    
        // Copy the sets without Player.
        const copy = []
        for (let i = 0; i < sets.length; i++) {
            const set = sets[i];
            const clone = {};
            const keys = Object.keys(set);
            for (let j = 0; j < keys.length; j++) if (keys[j] != "Player") clone[keys[j]] = set[keys[j]];
            
            copy.push(clone);
        }
    
        return fs.writeFileSync(VCSetsFile, JSON.stringify(copy));
    } catch (error) {
        console.log(error)
        console.log(sets);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starttts')
        .setDescription("Voices your messages in a channel to a voice call.")
        .addChannelOption(o => {
            return o.setName("output")
                .setDescription("The VC to voice into.")
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
                .setRequired(true);
        })
        .addChannelOption(o => {
            return o.setName("input")
                .setDescription("The channel to read. If left blank, uses current.")
                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread)
                .setRequired(false)
        })
        .addStringOption(o => {
            return o.setName("model")
                .setDescription("The Model to use.")
                .setAutocomplete(true)
        }),

    Register,
    
    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();
        // Get inputs.
        const input = interaction.options.getChannel("input") ?? interaction.channel;
        const model = interaction.options.getString("model") ?? DefaultEmbedding;
        const UserVoiceChannelID = interaction.member.voice.channelId;
        const output = interaction.options.getChannel("output") ?? (UserVoiceChannelID != null ? await client.channels.fetch(UserVoiceChannelID) : null) ?? null;
        if (output == null) return await interaction.editReply("Please join or select a voice channel!");;

        const set = {
            UserID: interaction.user.id,
            InputID: input.id,
            OutputID: output.id,
            OutputGuildID: interaction.guildId,
            Player: getPlayer(), // Use a generic new player.
            Model: model
        };
        
        Register(set);

        await interaction.editReply(`Link created! Just send messages in <#${input.id}> to test!`);
    },

    /**
     * Executes code when message is recieved.
     * @param {Message} message
     */
    async OnMessageRecieved(message) {
        // Ignore bots and empty messages
        if (message.author.bot || (message.content ?? "").trim().length == 0) return;

        // Check if it matches an input.
        for (let i = 0; i < VCSets.length; i++) {
            const set = VCSets[i];
            if (set.UserID == message.author.id && set.InputID == message.channelId) {
                // Check that user is in the voice call.
                /**
                 * @type {VoiceChannel}
                 */
                const output = await client.channels.fetch(set.OutputID);
                const inCall = output.members.has(message.author.id)

                const path = __dirname + `/../Temp/${Math.floor(Math.random() * 100000)}_chat_tts.wav`; // Prevent error when speaking too fast by randomly naming tts wavs.
                if (inCall) {
                    Voice(message.content, path, set.Model).then(() => {
                        PlayAudioToVC(path, set)
                            // Delete audio after it has finished playing.
                            .then(() => {
                                fs.unlinkSync(path);
                            })

                        // Log what was said, also log to transcriptions if needed.
                        if (HasLog(message.guildId)) {
                            const user = message.member;
                            const Name = user.nickname ?? user.displayName;
                            LogTo(message.guildId, "TTS", Name, message.content.trim())
                        }

                        WriteToLogChannel(message.guildId, `${message.author.displayName} in <#${set.OutputID}> voiced:\`\`\`` + message.content + "```")
                    })
                }

                // Since this considered voicing, we're done.
                return;
            };
        }

        const HasAllVoiceInVC = await HasPolicy(message.guildId, "allvoiceinvc");
        const PolicyValue = await GetPolicy(message.guildId, "allvoiceinvc");
        // If this is a voice call text channel, just read their message.
        if (message.channel.type == ChannelType.GuildVoice && (HasAllVoiceInVC && PolicyValue)) {
            // Don't voice message if they aren't in the actual voice channel.
            const inCall = message.channel.members.has(message.author.id)
            if (!inCall) return;

            const path = __dirname + `/../Temp/${Math.floor(Math.random() * 100000)}_chat_tts.wav`; // Prevent error when speaking too fast by randomly naming tts wavs.
            const set = {
                UserID: message.author.id,
                InputID: message.channelId,
                OutputID: message.channelId,
                OutputGuildID: message.guildId,
                Player: getPlayer(), // Use a generic new player.
                Model: VoiceV2.DefaultEmbedding
            };

            Voice(message.content, path, set.Model).then(() => {
                PlayAudioToVC(path, set)
                    // Delete audio after it has finished playing.
                    .then(() => {
                        fs.unlinkSync(path);
                    })

                // Log what was said, also log to transcriptions if needed.
                if (HasLog(message.guildId)) {
                    const user = message.member;
                    const Name = user.nickname ?? user.displayName;
                    LogTo(message.guildId, "TTS", Name, message.content.trim())
                }

                WriteToLogChannel(message.guildId, `${message.author.displayName} in <#${set.OutputID}> voiced:\`\`\`` + message.content + "```")
            })
        }
    },

    // Also share voice sets and useful voice information.
    VCSets, PlayAudioToVC, WriteVCSets, ConnectToChannel,

    /**
     * @param {AutocompleteInteraction} interaction The Autocomplete request.
     */
    async OnAutocomplete(interaction) {
        // Get active embeddings.
        const choices = GetEmbeddingsToChoices();

        // Get what the user has currently typed in.
        const stringValue = interaction.options.getFocused();

        // Filter to just matching ones. Also, cut off if we have more than twenty responses.
        let filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(stringValue.toLowerCase()));
        if (filtered.length > 20) filtered = filtered.slice(0, 20);

        // Send back our response.
        await interaction.respond(filtered);
    }
}