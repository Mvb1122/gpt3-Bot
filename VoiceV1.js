//Ignore ts(80001)
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
 * @param {*} m ignored for drop-in compatability with VoiceV2
 * @returns {Promise<String>} Path written to.
 * 
 * @deprecated
 * @see VoiceV2
 */
async function Voice(q, p, m) {
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
    Voice, speaker_embeddings
};