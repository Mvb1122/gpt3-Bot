//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message, ChannelType, AudioPlayer, VoiceChannel } = require('discord.js');
const { VoiceConnectionStatus, createAudioPlayer, NoSubscriberBehavior, joinVoiceChannel, createAudioResource, getVoiceConnection } = require('@discordjs/voice');
const { Voice, GetEmbeddingsToChoices, ListEmbeddings } = require('../VoiceV2');
const { client } = require('../index');
const fs = require('fs');
const { WriteToLogChannel } = require('../Security');

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
function PlayAudioToVC(path, set) {
    return new Promise(async res => {
        // Make sure we have a voice connection to the channel.
        await ConnectToChannel(set);

        // Now that we're sure we have a connection, play the thing.
        const resource = createAudioResource(path);
        set.Player.play(resource);

        // When the player has finished playing, resolve the promise.
        set.Player.on('idle', () => {
            res();
        })
    })
}

async function ConnectToChannel(set) {
    return new Promise(async (res) => {
        let connection;
        const vc = getVoiceConnection(set.OutputGuildID);

        if (vc != undefined && vc.subscribe != undefined) {
            // Add the player.
            vc.subscribe(set.Player);

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
    Model: string
}[]}
 */
let VCSets = []

// Load VCSets on boot and save on exit.
const VCSetsFile = "./VCSets.json";
if (fs.existsSync(VCSetsFile)) {
    VCSets = JSON.parse(fs.readFileSync(VCSetsFile));

    // Add new players.
    for (let i = 0; i < VCSets.length; i++) {
        VCSets[i].Player = getPlayer();
    }
}

function WriteVCSets() {
    // Delete all players.
    const sets = VCSets;
    for (let i = 0; i < sets.length; i++) 
        delete sets[i].Player;

    return fs.writeFileSync(VCSetsFile, JSON.stringify(sets));
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
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        })
        .addStringOption(o => {
            return o.setName("model")
                .setDescription("The Model to use.")
                .setAutocomplete(true)
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
        const model = interaction.options.getString("model") ?? ListEmbeddings()[0];
        const output = interaction.options.getChannel("output");

        // Add the set and reply.
        VCSets.push({
            UserID: interaction.user.id,
            InputID: input.id,
            OutputID: output.id,
            OutputGuildID: interaction.guildId,
            Player: getPlayer(), // Use a generic new player.
            Model: model
        });

        // Write VCSets whenever a new one is made.
        WriteVCSets();

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
                // Check that user is in the voice call.
                /**
                 * @type {VoiceChannel}
                 */
                const output = await client.channels.fetch(set.OutputID);
                const inCall = output.members.has(message.author.id)

                const path = __dirname + `/../Temp/${message.author.id}_chat_tts.wav`;
                if (inCall)
                    Voice(message.content, path, set.Model).then(() => {
                        PlayAudioToVC(path, set)
                        // Delete audio after it has finished playing.
                        .then(() => {
                            fs.unlinkSync(path);
                        })

                        // Log what was said.
                        WriteToLogChannel(message.guildId, `${message.author.displayName} in <#${set.OutputID}> voiced:\`\`\`` + message.content + "```")
                    })

                // Since this considered voicing, we're done.
                return;
            };
        }
    },

    // Also share voice sets and useful voice information.
    VCSets, PlayAudioToVC, WriteVCSets,

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