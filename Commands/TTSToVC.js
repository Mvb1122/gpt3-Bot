//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message, ChannelType, AudioPlayer } = require('discord.js');
const { VoiceConnectionStatus, createAudioPlayer, NoSubscriberBehavior, joinVoiceChannel, createAudioResource, getVoiceConnection } = require('@discordjs/voice');
const { Voice } = require('./Voice');
const { client } = require('../index');

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
 * 
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
async function PlayAudioToVC(path, set) {
    // Make sure we have a voice connection to the channel.
    await ConnectToChannel(set);

    // Now that we're sure we have a connection, play the thing.
    const resource = createAudioResource(path);
    set.Player.play(resource);
}

async function ConnectToChannel(set) {
    return new Promise(async (res) => {
        let connection;
        const vc = getVoiceConnection(set.OutputGuildID);

        if (vc != undefined) {
            connection = vc;
            // Add the player.
            connection.subscribe(set.Player);

            res();
        }
        else {
            const guild = await client.guilds.fetch(set.OutputGuildID);
            const adapterCreator = guild.voiceAdapterCreator;

            connection = joinVoiceChannel({
                channelId: set.OutputID,
                guildId: set.OutputGuildID,
                adapterCreator: adapterCreator,
            });

            connection.on(VoiceConnectionStatus.Ready, async (e) => {
                connection.subscribe(set.Player);
                res();
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
}[]}
 */
let VCSets = []

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
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();
        // Get inputs.
        const input = interaction.options.getChannel("input") ?? interaction.channel;
        const output = interaction.options.getChannel("output");

        // Add the set and reply.
        VCSets.push({
            UserID: interaction.user.id,
            InputID: input.id,
            OutputID: output.id,
            OutputGuildID: interaction.guildId,
            Player: getPlayer() // Use a generic new player.
        });

        interaction.editReply(`Link created! Just send messages in <#${input.id}> to test!`);
    },

    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        // Check if it matches an input.
        for (let i = 0; i < VCSets.length; i++) {
            const set = VCSets[i];
            if (set.UserID == message.author.id && set.InputID == message.channelId) {
                // If there's no player, then make one.
                const path = `../Temp/${message.author.id}_chat_tts.wav`;
                Voice(message.content, path).then(() => {
                    PlayAudioToVC(path, set) /* .then(() => {
                        fs.unlinkSync(path);
                    }) */ // TODO: Make PlayAudioToVC resolve later
                })

                // Since this voiced, we're done.
                return;
            };
        }
    },

    // Also share voice sets and useful voice information.
    VCSets, PlayAudioToVC
}