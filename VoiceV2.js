//#region Settings
/**
 * A boolean which describes whether to log the internal server process stuff.
 */
const DoConsoleLog = false;
const VoiceDir = "/Voice Embeddings/";
const DefaultEmbedding = `luminary.bin`;
//#endregion

const { spawn } = require('child_process');
const { DEBUG } = require('.');
const fp = require('fs/promises');
const fs = require('fs');

// Text formatting reqs.
const converter = require('number-to-words');
const NumberMatchingRegex = new RegExp(/(\d+,?\.?\d?)+/g);
const AcronymRegex = new RegExp(/([A-Z]\.?(?![a-z']))+/g);
const SpaceRegex = new RegExp(/ (?=[ ])/g);

// I used AI to make this Array; don't laugh! This is what AI is meant to be used for, right?
const PhoneticAlphabet = [
    { letter: "A", phonetic: "Ayy" },
    { letter: "B", phonetic: "Bee" },
    { letter: "C", phonetic: "Cee" },
    { letter: "D", phonetic: "Dee" },
    { letter: "E", phonetic: "Eee" },
    { letter: "F", phonetic: "Eff" },
    { letter: "G", phonetic: "Jee" },
    { letter: "H", phonetic: "Aych" },
    { letter: "I", phonetic: "Eye" },
    { letter: "J", phonetic: "Jay" },
    { letter: "K", phonetic: "Kay" },
    { letter: "L", phonetic: "El" },
    { letter: "M", phonetic: "Emm" },
    { letter: "N", phonetic: "Enn" },
    { letter: "O", phonetic: "Ohh" },
    { letter: "P", phonetic: "Pee" },
    { letter: "Q", phonetic: "Queue" },
    { letter: "R", phonetic: "Arr" },
    { letter: "S", phonetic: "Ess" },
    { letter: "T", phonetic: "Tee" },
    { letter: "U", phonetic: "You" },
    { letter: "V", phonetic: "Vee" },
    { letter: "W", phonetic: "Double You" },
    { letter: "X", phonetic: "Ex" },
    { letter: "Y", phonetic: "Why" },
    { letter: "Z", phonetic: "Zed" }
    
];

// Below here I made by hand.
const PhoneticSymbols = [
    { letter: "/", phonetic: "slash" },
    { letter: "&", phonetic: "and"},
    { letter: "@", phonetic: "at"},
    { letter: "%", phonetic: "percent"},
    { letter: ":", phonetic: "colon"},
    { letter: "+", phonetic: "plus"},
    { letter: "$", phonetic: "dollars"}
]

/**
 * A boolean which states if the voice server has already been started. Should be treated as read-only.
 */
let Started = false, 
/** A boolean which states if the transcription AI has been loaded or not. */
transcribe_loaded = false;

/**
 * Posts the data to the given URL.
 * @param {String} URL The URL to post to.
 * @param {Object} data The JSON for the server. DO NOT STRINGIFY BEFOREHAND!
 * @returns {Promise<Object>} The JSON back from the server.
 */
function postJSON(URL, data) {
    return new Promise(async (res, rej) => {
        let request = fetch(URL, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            method: "POST",
            body: JSON.stringify(data),
        })
            
        request.then(async (a) => {
            const text = await a.text();
            // console.log(text)
            try {
                res(JSON.parse(text));
            } catch {
                rej(text);
            }
        });
    })
}

/**
 * Starts the AI embedding and voicing server process.
 * @returns {Promise} A promise which resolves when the AI is running.
 */
function Start() {
    return new Promise(res => {
        // Run the python server.
        const pythonProcess = spawn('python', ['voice_server.py']);

        // Handle process exit events to ensure the Python server is killed when Node.js exits
        process.on('exit', () => {
            pythonProcess.kill();
        });

        pythonProcess.stderr.on('data', (data) => {
            if (DoConsoleLog)    
                console.log(data.toString());
            
            if (data.includes("Running on")) {
                Started = true;
                res();
            }
        });

        if (DoConsoleLog)    
            pythonProcess.stdout.on('data', (data) => {
                    console.log(data.toString());
            });
    })
}

function ConvertFFMPEG(AudioFileName, AdditionalSettings = undefined) {
    return new Promise(res => {
        const OutputName = `./${AudioFileName}.wav`;
        // First convert auto to .wav with specifications required by the embedding AI.
        let options = [];

        // Special options for dealing with Opus audio.
        if (AudioFileName.includes(".pcm")) options = options.concat(`-f s16le -ar 48k -ac 2 -i ${AudioFileName}`.split(" "))
        else options = options.concat([`-i`, AudioFileName, `-ar`, `16000`, `-ac`, `1`])

        // Add any extra options if they're passed.
        if (AdditionalSettings != undefined) options = options.concat(AdditionalSettings)

        // Finally, add output stuff.
        options = options.concat([OutputName, `-y`]);

        if (DoConsoleLog)
            console.log(`ffmpeg ${options.join(" ")}`);
        
        const ffmpeg = spawn('ffmpeg', options);

        ffmpeg.stderr.on('end', () => {
            res(OutputName);
        })

        if (DoConsoleLog) {
            ffmpeg.stderr.on('data', (d) => console.log(d.toString()));
        }
    })
}

/**
 * Lists currently available embeddings in the Voice Embeddings category.
 * @returns string[] Array of embeddings.
 */
function ListEmbeddings() {
    return fs.readdirSync(__dirname + VoiceDir);
}

/** Acceptable audio types for Embedding. */
const NonSplitTypes = "wav, mp3, mp4, avi, m4a, ogg, ogx, flac, amr, mpga";
const AudioTypes = NonSplitTypes.split(", ");

function FileIsAudio(name) {
    for (let i = 0; i < AudioTypes.length; i++) if (name.includes(AudioTypes[i])) return true;
    return false;
}

/**
 * A promise which resolves when the last transcription job is done.
 * @type {Promise}
 */
let LastTranscribe = null;

module.exports = {
    /**
     * Voices a text line into a file.
     * @param {String} text Text to voice.
     * @param {String} location File location to write to.
     * @param {String} model Embedding Model to use.
     * @returns {Promise<{ text: string, message: boolean}>} Promise which resolves when generation is complete. `text` is the voiced text.
     */
    Voice(text, location, model) {
        return new Promise(async res => {
            if (!Started) await Start();

            if (model == undefined || model == null) {
                console.warn("No embedding supplied! Using default.");
                model = DefaultEmbedding;
            }

            if (!model.endsWith(".bin")) model += ".bin";

            // Reformat text to replace numbers with words.
            const numbers = text.match(NumberMatchingRegex);
            try {
                if (numbers != null) {
                    // Go through each one and replace it.
                    for (let i = 0; i < numbers.length; i++) {
                        /**
                         * @type {string}
                         */
                        const sub = numbers[i].replaceAll(",", "");
                        const hasPoint = sub.includes(".")
                        const pointIndex = hasPoint ? sub.indexOf(".") : sub.length;
                        const beforePoint = sub.substring(0, pointIndex);
    
                        let converted = converter.toWords(beforePoint);
                        if (hasPoint) try {
                            let afterPoint = sub.substring(pointIndex + 1);
                            converted += " point " + converter.toWords(afterPoint);
                        } catch { ; } // Do nothing.
    
                        text = text.replace(numbers[i], converted);
                    }
                }
            } catch {
                ; // Do nothing.
            }

            // Fix acronyms, only if the message isn't in all caps.
            const acronyms = text.match(AcronymRegex);
            if (acronyms != null && text.toUpperCase() != text) {
                // Replace them.
                for (let i = 0; i < acronyms.length; i++) {
                    const OGLowerCase = acronyms[i].toLowerCase();
                    let converted = (" " + OGLowerCase); // Force deep copy.
                    PhoneticAlphabet.forEach(letter => {
                        if (OGLowerCase.includes(letter.letter.toLowerCase()))
                            converted = converted.replaceAll(letter.letter.toLowerCase(), letter.phonetic + " ");
                    });
                    converted = converted.replaceAll(".", " ").trim();
                    text = text.replace(acronyms[i], converted)
                }
            }

            // Replace phonetic symbols.
            PhoneticSymbols.forEach(symbol => {
                if (text.includes(symbol.letter))
                    text = text.replaceAll(symbol.letter, ` ${symbol.phonetic} `);
            });

            // Fix multiple spaces.
            text = text.replace(SpaceRegex, "");

            const Data = {
                location: location,
                text: text,
                embed: model
            };

            // Ask server for stuff.
            postJSON("http://127.0.0.1:4963/gen", Data).then((d) => {
                res({
                    text: text,
                    message: d.Message
                })
            })
        })
    },
    
    EmbedDirectory: VoiceDir,
    DefaultEmbedding,

    Embed(AudioFileName, EmbedName, SilenceRemove = true) {
        return new Promise(res => {
            // Remove silence if requested.
            const ExtraOptions = SilenceRemove ? [`-af`, `silenceremove=1:0:-30dB`] : undefined;

            ConvertFFMPEG(AudioFileName, ExtraOptions).then(async (name) => {
                if (!Started) await Start();

                // Make sure that Voice Embeds land in the Voice Embeddings directory.
                if (!EmbedName.includes(this.EmbedDirectory)) EmbedName = EmbedName;

                // Ask the server to make an embed from it.
                console.log("Conversion finished, asking for embed now.")
                postJSON("http://127.0.0.1:4963/embed", {
                    source: name,
                    output: EmbedName
                }).then(() => {
                    // Delete the .wav file.
                    fp.unlink(name);
                    res(EmbedName);
                });
            })
        })
    },

    Preload: Start,

    AudioTypes, NonSplitTypes, FileIsAudio,

    ListEmbeddings,

    /**
     * Gets the DiscordJS stringchoices for the embedding models.
     * @returns {[{ name: string, value: string}]}
     */
    GetEmbeddingsToChoices() {
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
    },

    /**
     * Transcribes audio from a path.
     * @param {String} location Path to transcribe from.
     * @returns {Promise<string>} A promise which resolves the audio's text.
     */
    Transcribe(location) {
        const thisTranscribe = new Promise(async (res, rej) => {
            if (LastTranscribe != null) await LastTranscribe;
            // Wait for last transcription request to finish before starting this one.
            if (!Started) await Start();

            ConvertFFMPEG(location).then(name => {
                postJSON("http://127.0.0.1:4963/transcribe", {
                    source: name
                }).then((e) => {
                    // Delete the converted file.
                    fp.unlink(name);
                    res(e.message.text != null ? e.message.text : e.message);
                }, (e) => {
                    // If we fail, still delete. Just reject the error I guess.
                    try {
                        fp.unlink(name);
                    } catch {
                        ; // Do nothing.
                    }
                    rej(e);
                });
            });
        });
        LastTranscribe = thisTranscribe;
        return thisTranscribe;
    },

    /**
     * Generates music using the server's music AI.
     * @param {string} prompt What you want to listen to.
     * @param {string} output Path to save to.
     * @param {string} length The length in seconds of the outputted audio.
     * @returns {Promise<string>} Path to output.
     */
    MakeMusic(prompt, output, length = 5) {
        return new Promise(async res => {
            if (!Started) await Start();

            postJSON("http://127.0.0.1:4963/gen_music", {
                prompt: prompt,
                output: output,
                length: length
            }).then(() => {
                res(output);
            });
        })
    },

    /**
     * Preloads the transcription stuff.
     * @returns {Promise}
     */
    PreloadTranscribe() {
        return new Promise(async res => {
            // Starts up the transcribe stuff.
            if (!Started) await Start();

            if (!transcribe_loaded)
                postJSON("http://127.0.0.1:4963/preload_transcribe", {})
                .then(() => {
                    transcribe_loaded = true;
                    res();
                });
            else res();
        })
    }
}
// Debug.
/*
module.exports.Transcribe("./audio.mp3");
Voice("./Temp/out.wav", "Whatever.").then(() => {
    console.log("Done.");
});
*/
