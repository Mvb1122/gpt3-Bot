//#region Settings
/**
 * A boolean which describes whether to log the internal server process stuff.
 */
const DoConsoleLog = true;
const VoiceDir = "/Speaker Wavs/";
const DefaultEmbedding = `Narrator_Neutral.wav`;
//#endregion

const { spawn, ChildProcess } = require('child_process');
const { DEBUG, LocalServerSettings, NewMessage, GetSafeChatGPTResponse, AIParameters, colors } = require('.');
const fp = require('fs/promises');
const fs = require('fs');

// Text formatting reqs.
const converter = require('number-to-words');
const path = require('path');
const { DownloadToBase64String } = require('./LlamaSupport');
const NumberMatchingRegex = new RegExp(/(\d+,?\.?\d?)+/g);
const AcronymRegex = new RegExp(/([A-Z]\.?(?![a-z' ]))+/g);
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
    { letter: "L", phonetic: "Ell" },
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
    { letter: "Z", phonetic: "zee" }
    
];

// Below here I made by hand.
const PhoneticSymbols = [
    { letter: "/", phonetic: "slash" },
    { letter: "&", phonetic: "and"},
    { letter: "@", phonetic: "at"},
    { letter: "%", phonetic: "percent"},
    { letter: ":", phonetic: "colon"},
    { letter: "+", phonetic: "plus"},
    { letter: "$", phonetic: "dollars"},
    { letter: "°", phonetic: "degrees"},
    { letter: "<", phonetic: "less than"},
    { letter: ">", phonetic: "greater than"}
]

/**
 * A boolean which states if the voice server has already been started. Should be treated as read-only.
 */
let Started = false, 
/** A boolean which states if the transcription AI has been loaded or not. */
transcribe_loaded = false;

let LastRequest = null;
/**
 * Posts the data to the given URL.
 * @param {String} URL The URL to post to.
 * @param {Object} data The JSON for the server. DO NOT STRINGIFY BEFOREHAND!
 * @returns {Promise<Object>} The JSON back from the server.
 */
function postJSON(URL, data) {
    const thisRequest = new Promise(async (res, rej) => {
        // Wait for the previous request to go through.
        if (LastRequest != null) await LastRequest;

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
                // If something goes wrong, let's restart the server before moving on.
                await Restart();
                rej(text);
            }
        }, async (a) => {
            // If something goes wrong, let's restart the server before moving on.
            await Restart();
            rej();
            // console.log();
        });
    });
    LastRequest = thisRequest;
    return thisRequest;
}

/**
 * @type {ChildProcess}
 */
let pythonProcess;

let startPromise = null;

/**
 * Starts the AI embedding and voicing server process.
 * @returns {Promise} A promise which resolves when the AI is running.
 */
function Start() {
    if (startPromise == null) {
        startPromise = new Promise(async res => {
            if (Started) await Stop();
            
            console.log(colors.green + "Starting Python Generation server! Please be patient." + colors.reset);
            
            // Run the python server.
            pythonProcess = spawn('python', ['voice_server.py']);
            
            // Handle process exit events to ensure the Python server is killed when Node.js exits
            process.on('exit', () => {
                pythonProcess.kill();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                if (DoConsoleLog)    
                    console.log(data.toString());
                
                if (data.includes("Running on")) {
                    console.log(colors.green + "Started Python Generation server!" + colors.reset);

                    Started = true;
                    startPromise = null;
                    module.exports.Started = true;
                    res();
                }
            });
    
            if (DoConsoleLog)    
                pythonProcess.stdout.on('data', (data) => {
                        console.log(data.toString());
                });
        })
        return startPromise;
    } else return startPromise;
}

// If we're doing console log in DEBUG, might as well start up.
if (DoConsoleLog && DEBUG) Start();

function Stop() {
    transcribe_loaded = false;
    LastTranscribe = null;
    Started = false; 

    console.log(colors.red + "Stopping Python Generation server! Please be patient." + colors.reset);

    return new Promise((res, rej) => {
        if (pythonProcess == undefined) return res();
        if (pythonProcess.kill()) res();
        else rej();
    })
}

/**
 * Preloads the transcription stuff.
 * @returns {Promise}
 */
function PreloadTranscribe() {
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

async function Restart() {
    const transcribe_loaded_before = transcribe_loaded;
    await Stop();
    const start = Start();
    LastRequest = null;
    if (transcribe_loaded_before) {
        await start;
        await PreloadTranscribe();
    }
    return start;
}

let UsingFiles = [];
function ConvertFFMPEG(AudioFileName, AdditionalSettings = undefined) {
    return new Promise(res => {
        let num = 0;
        do {
            ++num // = Math.floor(Math.random() * 1000000);
        } while (UsingFiles[num] != undefined);
        
        UsingFiles[num] = true;
        const OutputName = path.resolve(`./Temp/${num}.wav`);

        /*
        // Create a file instantly to hold the name.
            // This prevents multiple sections from being written if, somehow, the file already exists.
        fs.writeFileSync(OutputName, "");
        */

        // First convert auto to .wav with specifications required by the embedding AI.
        let options = [];

        // Special options for dealing with Opus audio.
        if (AudioFileName.includes(".pcm")) options = options.concat(`-f s16le -ar 48k -ac 2 -i ${AudioFileName}`.split(" "))
        else options = options.concat([`-i`, AudioFileName, `-ar`, `24000`, `-ac`, `1`])

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
const NonSplitTypes = "wav, mp3, mp4, avi, m4a, ogg, ogx, flac, amr, mpga, mov";
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
     * @param {boolean} [MakeAllLetters=true] Whether to fix characters; eg turn / to 'slash'
     * @returns {Promise<{ text: string, message: boolean}>} Promise which resolves when generation is complete. `text` is the voiced text.
     */
    Voice(text, location, model, MakeAllLetters = true) {
        return new Promise(async res => {
            if (!Started) await Start();

            if (model == undefined || model == null) {
                console.warn("No embedding supplied! Using default.");
                model = DefaultEmbedding;
            }

            if (!model.endsWith(".wav")) model += ".wav";

            // Reformat text to replace numbers with words.
            if (MakeAllLetters) {
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
            }

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
    DefaultEmbedding, Started,

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

    Preload: Start, Restart, Stop,

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
            name = name.substring(0, name.indexOf(".wav"));

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
     * @param {null} [start=null] Timestamp in seconds to start from
     * @param {null} [stop=null] Timestamp in seconds to stop at.
     * @returns {Promise<string>} A promise which resolves the audio's text.
     */
    Transcribe(location, start = null, stop = null) {
        const thisTranscribe = new Promise(async (res, rej) => {
            // Copy last transcribe internally.
            const _LastTranscribe = LastTranscribe;

            if (!Started) await Start();
            
            let AdditionalSettings = [];
            if (start != null)
                AdditionalSettings = ['-ss', start];
            if (stop != null) 
                AdditionalSettings = AdditionalSettings.concat(['-to', stop])
            
            if (start || stop) AdditionalSettings.concat(["-map", 0, "-copyts"])
                
            ConvertFFMPEG(location, AdditionalSettings).then(async convertedFileLocation => {
                // Wait for last transcription request to finish before starting this one.
                if (_LastTranscribe != null) await _LastTranscribe;
                if (!fs.existsSync(convertedFileLocation)) res("");

                postJSON("http://127.0.0.1:4963/transcribe", {
                    source: convertedFileLocation
                }).then((e) => {
                    // Delete the converted file.
                    fp.unlink(convertedFileLocation);
                    res(e.message.text != null ? e.message.text : e.message);
                }, (e) => {
                    // If we fail, still delete. Just reject the error I guess.
                    /* Callers should clean up after themselves. Remember to delete files!
                    try {
                        fp.unlink(name);
                    } catch {
                        ; // Do nothing.
                    }
                    */
                    rej(e);
                })
                .catch(e => {
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
     * Generates music using the server's music AI.
     * @param {string} prompt What you want to listen to.
     * @param {string} output Path to save to.
     * @param {string} length The length in seconds of the outputted audio.
     * @returns {Promise<string>} Path to output.
     */
    MakeSFX(prompt, output, length = 5) {
        return new Promise(async res => {
            if (!Started) await Start();

            postJSON("http://127.0.0.1:4963/gen_sfx", {
                prompt: prompt,
                output: output,
                length: length
            }).then(() => {
                res(output);
            });
        })
    },

    PreloadTranscribe,

    /**
     * Translates text to a language.
     * @param {string} from BCP-47 code for the source langauge.
     * @param {string} natural Text to translate.
     * @param {string} to BCP-47 code for the target language.
     * @returns {Promise<{translation_text: string, from_lang: string}>}
     */
    Translate(natural, to, from) {
        return new Promise(async res => {
            // If we're not using a local text server, use the discreet translation AI, split by sentence.
            if (!LocalServerSettings.Use) {
                // Starts up the transcribe stuff.
                if (!Started) await Start();

                let parts = natural.split(/(?<=[.!?…？。！])/);

                // Translate each part and then reassemble.
                /** @type {{translation_text: string, from_lang: string}[]} */
                const outputs = await Promise.all(parts.map(async v => {
                    const data = {
                        natural: v,
                        to: to,
                        from: from
                    };

                    return await postJSON("http://127.0.0.1:4963/translate", data);
                }));

                const merged = {
                    translation_text: outputs.map(v => v.translation_text).join(" "),
                    from_lang: outputs[0].from_lang
                };

                return res(merged);
            } else {
                // If we're connected to a local server for text generation, actually use that AI instead of the connected one.
                if (to == "auto") to = "English";
                if (from == "auto") from = "whatever language text is written in";
    
                const messages = NewMessage("system", "You are an AI which is really good at translating text from " + from + " to " + to + ". When someone gives you text to translate, you will ONLY write your translation. YOU WILL NOT write anything EXCEPT for the translation. If auto is either language, you must translate it to English. If the text is already in the requested language, please just rewrite it exactly with no changes.")
                    .concat(NewMessage("user", "Hi, please translate this text to " + to + " please!\nText:\n" + natural + ""));
                
                const response = (await GetSafeChatGPTResponse(messages, null, 0, false)).data.choices[0].message;
                return res({ 
                    translation_text: response.content,
                    from_lang: from
                });
            }
        })
    },

    /**
     * Determines the language of a text. Quite innacurate on short pieces of text!
     * @param {string} text 
     * @returns {Promise<{code: string}>} Language code; eg 'en', 'ja' etc...
     */
    DetermineLanguage(text) {
        return new Promise(async res => {
            // Starts up the transcribe stuff.
            if (!Started) await Start();

            const data = {
                text: text,
            };

            postJSON("http://127.0.0.1:4963/determineLanguage", data)
                .then((v) => {
                    res(v);
                });
        })
    },

    /**
     * Captions an image loaded locally.
     * @param {string} location Where to caption from.
     * @param {'<CAPTION>' | '<DETAILED_CAPTION>' | '<MORE_DETAILED_CAPTION>' | '<OD>' | '<MANGA_OCR>'} mode what task to do. OD is Object Detection.
     * @returns {Promise<string>} Resulting value.
     */
    Caption(location, mode) {
        // If we're doing Manga OCR, then we must use the special model (as LLMs and Florence suck for reading Japanese, as I'm reading this.)
        if (mode == '<MANGA_OCR>') 
            return new Promise(async res => {
                // Starts up the transcribe stuff.
                if (!Started) await Start();
    
                const data = {
                    location: location
                };
    
                postJSON("http://127.0.0.1:4963/manga_ocr", data)
                    .then((v) => {
                        res(v);
                    });
            })

        // If we don't have LLM image support, use the internal model.
        if (LocalServerSettings.ImageBehavior.state == "inbuilt")
            return new Promise(async res => {
                // Starts up the transcribe stuff.
                if (!Started) await Start();
    
                const data = {
                    location: location,
                    mode: mode,
                };
    
                postJSON("http://127.0.0.1:4963/caption", data)
                    .then((v) => {
                        res(v);
                    });
            })
        else {
            return new Promise(async p => {
                // Caption it with the second LLM.
                const captionSeq = NewMessage("System", "You are an image captioning AI. You will caption images with the most detail you can. You will respond with ONLY the caption. You may provide additional background information if it seems useful. In this response you should focus on the following task: " + mode + ". If OCR, only write the text, and please write ALL text in the image.")
                    .concat({
                        role: "User",
                        content: [
                            {
                                type: "text",
                                text: "Please caption this image for me."
                            },
                            {
                                type: "image_url",
                                image_url: await DownloadToBase64String(location)
                            }
                        ]
                    });

                const model = LocalServerSettings.ImageBehavior.state == "separate" ? LocalServerSettings.ImageBehavior.separateModel : AIParameters.model;
                // Ask AI.
                const resp = (await GetSafeChatGPTResponse(captionSeq, null, 0, false, model)).data.choices[0].message.content;
                p(resp);
            })
        }
    },

    /**
     * Captions an image loaded locally.
     * @param {string} location Where to caption from.
     * @param {number} [maxSpeakers=undefined] Number of speakers. Set to -1 to have automatic.
     * @returns {Promise<[{start: number, stop: number, speaker: string}]>} Resulting value.
     */
    Diarize(location, maxSpeakers = undefined) {
        return new Promise(async (res, rej) => {
            // Starts up the transcribe stuff.
            if (!Started) await Start();

            const data = {
                location: "",
                maxSpeakers: Math.abs(maxSpeakers)
            };

            ConvertFFMPEG(location).then(name => {
                data.location = name
                postJSON("http://127.0.0.1:4963/diarize", data).then((e) => {
                    // Delete the converted file.
                    fp.unlink(name);
                    res(e);
                }, (e) => {
                    // If we fail, still delete. Just reject the error I guess.
                    /* Callers should clean up after themselves. Remember to delete files!
                    try {
                        fp.unlink(name);
                    } catch {
                        ; // Do nothing.
                    }
                    */
                    rej(e);
                })
                .catch(e => {
                    rej(e);
                });
            });
        })
    },

    /**
     * Uses Chronos Bolt on a local CSV file.
     * @param {string} location Where to caption from.
     * @param {string} out Where to output to.
     * @param {number} reps How many reps to predict.
     * @returns {Promise<string>} Resulting values.
     */
    Predict(location, out, reps) {
        return new Promise(async res => {
            // Starts up the transcribe stuff.
            if (!Started) await Start();

            const data = {
                location: location,
                out: out,
                reps: reps,
            };

            postJSON("http://127.0.0.1:4963/predict", data)
                .then((v) => {
                    res(v);
                });
        })
    },
}

// Debug.
/*
module.exports.Transcribe("./audio.mp3");
Voice("./Temp/out.wav", "Whatever.").then(() => {
    console.log("Done.");
});
*/
