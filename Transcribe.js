//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const wavefile = require('wavefile')

let pipe = undefined;
// Loads the AI in advance to decrease time-to-response for user.
async function Preload() {
    // Allocate a pipeline for sentiment-analysis
    const { pipeline } = await import("@xenova/transformers");
    pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
}

/**
 * Transcribes audio to text.
 * @param {Float64Array} data Path or URL to audio to be transcribed.
 * @returns {Promise<{text: String, time: Number}>} Text, transcribed. time is in ms.
 */
async function Transcribe(data) {
    // Only preload on first call.
    if (pipe == undefined) await Preload();

    const start = performance.now();
    const output = await pipe(data);
    time = performance.now() - start;
    output.time = time;
    return output;
}

async function TranscribeURL(url) {
    // Load audio data
    let buffer = Buffer.from(await fetch(url).then(x => x.arrayBuffer()))

    // Read .wav file and convert it to required format
    let wav = new wavefile.WaveFile(buffer);
    wav.toBitDepth('32f'); // Pipeline expects input as a Float32Array
    wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
            const SCALING_FACTOR = Math.sqrt(2);

            // Merge channels (into first channel to save memory)
            for (let i = 0; i < audioData[0].length; ++i) {
                audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
            }
        }

        // Select first channel
        audioData = audioData[0];
    }

    return await Transcribe(audioData);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transcribe')
        .setDescription("Transcribes audio to text.")
        .addAttachmentOption(option => {
            return option.setName("voice")
                .setDescription("The voice you want to transcribe.")
                .setRequired(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();

        // Download it.
        const attachment = interaction.options.getAttachment("voice")
        const url = attachment.url

        // return interaction.editReply("You provided a non-supported image. Here are the supported types: ```" + "Actually I'm not sure what's supported, but if it broke, then it's probably not supported." + "```")
        try {
            const text = await TranscribeURL(url);
            interaction.editReply({
                content: "```" + text.text + "```\nTime: " + text.time.toFixed(2)/1000 + " seconds",
                files: [url]
            });
        } catch (e) {
            interaction.editReply("Something went wrong! ```" + e + "```");
        }
    },

    // Export transcribe methods.
    Transcribe, TranscribeURL
}