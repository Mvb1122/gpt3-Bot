//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const fs = require('fs')

let pipe = undefined;
// Loads the AI in advance to decrease time-to-response for user.
async function Preload() {
    // Allocate a pipeline for sentiment-analysis
    const { pipeline } = await import("@xenova/transformers");
    pipe = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { quantized: false });
}

const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';

const wavefile = require('wavefile');
/**
 * Gets the voice line for a thing.
 * @param {String} q Text to speak.
 * @param {String} p Path to write to.
 * @returns {Promise<String>} Path written to.
 */
async function Voice(q, p) {
    // Don't preload until first call.
    if (pipe == undefined) await Preload();
    
    return new Promise(async res => {
        pipe(q, { speaker_embeddings }).then(result => {
            const wav = new wavefile.WaveFile();
            
            wav.fromScratch(1, result.sampling_rate, '32f', result.audio);
            fs.writeFile(p, wav.toBuffer(), () => {
                res(p);
            });
        })
    });
}

module.exports = {
	data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Use AI to voice words!')
        .addStringOption(option => {
            return option.setName("line")
                .setDescription("The line to voice.")
                .setRequired(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();
        const line = interaction.options.getString("line");

        const path = __dirname + `/../Temp/${interaction.user.id}_tts.wav`;
        Voice(line, path).then(() => {
            // Save to temp folder and then send it off.
            interaction.editReply({content: `Here's your audio! Voiced line: \`\`\`${line}\`\`\``, files: [path]}).then(() => {
                // Delete the image.
                fs.unlink(path, (err) => {if (err) console.log(err)});
            })
        })
    },

    // Also share Voice method and embedding url.
    Voice, speaker_embeddings
};