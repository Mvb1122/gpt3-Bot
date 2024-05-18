/*
Embedding maker:
https://colab.research.google.com/drive/1Fk_Jaq1WzLVKl6w94jglPUDxNWTW-PXB#scrollTo=7PGxrX4t1Oqe
*/

const wavefile = require('wavefile');
const fs = require('fs');

let tokenizer, vocoder, processor, 
/** @type {PreTrainedModel} */
model 
= vocoder = tokenizer = null;

/**
 * @returns {Promise<null>} Promise which returns when the model has finished loading.
 */
async function Preload() {
    return new Promise(async res => {
        const { Tensor, AutoProcessor, AutoTokenizer, SpeechT5ForTextToSpeech, SpeechT5HifiGan  } = await import('@xenova/transformers');
    
        // Load stuff all at once, using promises to make it faster.
            // Load the tokenizer and processor
        tokenizer = AutoTokenizer.from_pretrained('Xenova/speecht5_tts');
        processor = AutoProcessor.from_pretrained('Xenova/speecht5_tts');
        
            // Load the models
        vocoder = SpeechT5HifiGan.from_pretrained('Xenova/speecht5_hifigan', { quantized: false });
        model = SpeechT5ForTextToSpeech.from_pretrained('Xenova/speecht5_tts', { quantized: false });

        Promise.all([model, vocoder, tokenizer, processor]).then((v) => {
            // Assign promises to variables.
            model = v[0];
            vocoder = v[1];
            tokenizer = v[2];
            processor = v[3];
            
            res();
        });
    })
}

/**
 * Voices stuff but this one has support for using an embedding.
 * @param {String} path The path to write to.
 * @param {String} text The text to voice.
 * @param {String} embedding The voice embedding to use.
 */
async function Voice(text, path, embedding) {
    return new Promise(async res => {
        if (embedding == undefined || embedding == null) embedding = ListEmbeddings()[0];
    
        const { Tensor, AutoProcessor, AutoTokenizer, SpeechT5ForTextToSpeech, SpeechT5HifiGan  } = await import("@xenova/transformers");
        if (model == null) await Preload();
    
        const Embedding_Path = __dirname + "/Voice Embeddings/" + embedding;
        // Load speaker embeddings from file
        const data = fs.readFileSync(Embedding_Path);
        const speaker_embeddings_data = new Float32Array(data.buffer).slice(0, 512); // Crop to 512 in length.
    
        let speaker_embeddings = new Tensor(
            'float32',
            speaker_embeddings_data,
            [1, speaker_embeddings_data.length]
        );
    
        // Run tokenization
        const { input_ids } = tokenizer(text);

        // Generate waveform
        const { waveform } = await model.generate_speech(input_ids, speaker_embeddings, { vocoder });
        
        // Reset stuff so stuff doesn't transfer.
        (await vocoder).dispose();
        
        // Save to file.
        const wav = new wavefile.WaveFile();
        wav.fromScratch(1, processor.feature_extractor.config.sampling_rate, '32f', waveform.data);
        fs.writeFile(path, wav.toBuffer(), () => {
            console.log(`File written to ${path}!`)
            res(path);
        });
    })
}

/**
 * Gets the DiscordJS stringchoices for the embedding models.
 * @returns [{ name: string, value: string}]
 */
function GetEmbeddingsToChoices() {
    // Get the list of embeddings, then process it to be in the right format.
    const Embeddings = ListEmbeddings();
    const output = [];
    Embeddings.forEach(embedding => {
        let name = embedding.charAt(0).toUpperCase() + embedding.slice(1);
        name = name.substring(0, name.indexOf(".bin"));

        output.push({
            name: name,
            value: embedding
        });
    })

    return output;
}

// Debug.
/*
Voice("./Temp/out.wav", "Whatever.").then(() => {
    console.log("Done.");
});
*/

/**
 * Lists currently available embeddings in the Voice Embeddings category.
 * @returns string[] Array of embeddings.
 */
function ListEmbeddings() {
    return fs.readdirSync(__dirname + "/Voice Embeddings/");
}

/* DEBUG:
Voice("./out.wav", "Call me Hitler, but I don't like child porn!", "embeddings.bin")
Voice("./out_luminary.wav", "Call me Hitler, but I don't like child porn!", "luminary.bin")
*/

module.exports = {
    Voice, ListEmbeddings, Preload, GetEmbeddingsToChoices
}