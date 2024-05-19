const { spawn } = require('child_process');
const { DEBUG } = require('.');
const fp = require('fs/promises');
const fs = require('fs');
let Started = false;

/**
 * Posts the data to the given URL.
 * @param {String} URL The URL to post to.
 * @param {Object} data The JSON for the server. DO NOT STRINGIFY BEFOREHAND!
 * @returns {Promise<Object>} The JSON back from the server.
 */
function postJSON(URL, data) {
    return new Promise(async res => {
        let request = fetch(URL, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            method: "POST",
            body: JSON.stringify(data),
        })
            
        request.then((a) => {
            res(a.json());
        });
    })
}

const DoConsoleLog = false;
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

function ConvertFFMPEG(AudioFileName) {
    return new Promise(res => {
        const OutputName = "./audio.wav";
        // First convert auto to .wav with specifications required by the embedding AI.
        const ffmpeg = spawn('ffmpeg', [`-i`, AudioFileName, `-ar`, `16000`, `-ac`, `1`, OutputName, `-y`]);
        ffmpeg.stderr.on('end', () => {
            res(OutputName);
        })
    })
}

/**
 * Lists currently available embeddings in the Voice Embeddings category.
 * @returns string[] Array of embeddings.
 */
function ListEmbeddings() {
    return fs.readdirSync(__dirname + "/Voice Embeddings/");
}

const DefaultEmbedding = "./Voice Embeddings/girl.bin";

module.exports = {
    /**
     * Voices a text line into a file.
     * @param {String} text Text to voice.
     * @param {String} location File location to write to.
     * @param {String} model Embedding Model to use.
     * @returns {Promise<boolean>} Promise which resolves when generation is complete.
     */
    Voice(text, location, model) {
        return new Promise(async res => {
            if (!Started) await Start();

            if (model == undefined || model == null) {
                console.warn("No embedding supplied! Using default.");
                model = DefaultEmbedding;
            }

            if (!model.endsWith(".bin")) model += ".bin";

            const Data = {
                location: location,
                text: text,
                embed: model
            };

            // Ask server for stuff.
            postJSON("http://127.0.0.1:4963/gen", Data).then((d) => {
                res(d.Message)
            })
            
        })
    },
    
    EmbedDirectory: "./Voice Embeddings/",
    DefaultEmbedding,

    Embed(AudioFileName, EmbedName) {
        return new Promise(res => {
            ConvertFFMPEG(AudioFileName).then(async (name) => {
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

    // Debug.
    /*
    Voice("./Temp/out.wav", "Whatever.").then(() => {
        console.log("Done.");
    });
    */
}