const { default: StableDiffusionApi } = require("a1111-webui-api");
const API = require("a1111-webui-api");
const { Message } = require("discord.js");
const fs = require('fs');
const NegativePrompt = 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, bad feet, bad pussy';

/**
 * @type {[StableDiffusionApi]}
 */
let apps = [];
async function ConnectTo(Address, Port = 7860) {
    let app = new StableDiffusionApi({
        host: Address,
        port: Port,
        protocol: "http",
        defaultSampler: "DDIM",
        defaultStepCount: 15,
        timeout: 1800000
    });

    apps.push(app);
}

function ConnectToPreset(number) {
    return new Promise(async (resolve, reject) => {
        // Load preset from file. 
        const preset = fs.readFileSync(`./Gradio/Gradio_Presets/${number}.txt`).toString().split("\n");
        apps = [];
        preset.forEach(Server => {
            Server = Server.split(":")
            ConnectTo(Server[0], Server[1]);
        });
        resolve(true);
    })
}

/**
 * An object representing the host and ports.
 * @returns {[{host: String, port: String}]}
 */
function GetServers() {
    let output = [];
    apps.forEach(app => {
        output.push({
            host: app.config.host,
            port: app.config.port
        });
    })
    return output;
}

/**
 * @param {String} Address The address to disconnect from.
 * @param {Number} Port The port of the server to disconnect from.
 * @returns Nothing. Error if no address found.
 */
function DisconnectFrom(Address, Port = 7860) {
    Address = Address.trim();
    Port = Number.parseInt(Port)
    for (let i = 0; i < apps.length; i++) {
        if (apps[i].config.host.trim().includes(Address) && apps[i].config.port == Port)
        {
            apps.splice(i, 1);
            return apps;
        }
    }
    
    throw new Error("Address not found!")
}

const sharp = require('sharp')
/**
 * 
 * @param {Path} ImagePath The path to the image.
 * @param {{prompt: String, scale: Number}} Settings Settings for upscaling.
 */
async function ImageToImageFromPath(ImagePath, Settings) {
    const Image = sharp(ImagePath)
    return ImageToImageFromSharp(Image, Settings);
}

/**
 * 
 * @param {sharp.Sharp} Image The path to the image.
 * @param {{prompt: String, scale: Number}} Settings Settings for upscaling.
 */
async function ImageToImageFromSharp(Image, Settings, MakeSeed = true) {
    return new Promise(async (resolve, reject) => {
        let meta = await Image.metadata();
        
        if (MakeSeed || Settings.seed == undefined)
        Settings.seed = GenerateSeed();
    
        Settings.init_images = [Image];

        Settings.resize_mode = 0;
        if (Settings.negative_prompt == undefined)
            Settings.negative_prompt = NegativePrompt;
        
        Settings.save_images = true;
        
        Settings.sampler_name = "DDIM"; Settings.steps = 35;

        if (Settings.scale == undefined) Settings.scale = 1;

        if (Settings.width == undefined || Settings.height == undefined) {
            Settings.height = (await meta).height * Settings.scale;
            Settings.width = (await meta).width * Settings.scale;
        }

        let scale = (Settings.scale).toString();
        const prompt = `${Settings.prompt}`;

        try {
            (await FetchApp()).img2img(Settings)
                .then(async e => {
                    // Include the seed to prevent sending back the same image.
                    const path = "./Images/" + `${prompt.substring(0, 100)}_${Settings.seed}-${scale}x.png`
                        // Sanatize path!
                        .replace(/[/\\?%*:|"<>]/g, '-')
                    await (e.image.toFile(path))
                    resolve(path)
                })
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Gets the tags that coorespond with an image using DeepBooru.
 * @param {String} path The path to the image.
 * @returns {Promise<API.StableDiffusionResult>}
 */
function GetTagsFromImage(path) {
    // Load image. 
    return new Promise(async (resolve, reject) => {
        try {
            const App = await FetchApp();
            let ImageSharp = await new sharp(path)
            App.interrogate(ImageSharp, "deepdanbooru")
                .then(async val => {
                    resolve(await val.response.data.caption);
                })
        } catch (error) {
            reject(error)
        }
    })
}

// Returns a random generator, that isn't the last one we used.
let LastIndex = -1;
/**
 * 
 * @returns {Promise<StableDiffusionApi>}
 */
async function FetchApp() {
    return new Promise(async (resolve) => {
        let index = Math.floor(Math.random() * apps.length)
        if (index == LastIndex && apps.length > 1) resolve(await FetchApp());

        // If this server has more than four jobs and we can reroll, reroll.
        if (apps.length > 1 && (await apps[index].getProgress()).state.job_count >= 4) {
            resolve(await FetchApp())
        } else {
            LastIndex = index;
            resolve(apps[index]);
        }
    })
    
}

 function IsConnected() {
    return apps.length != 0;
}

async function PredictContentDefault(Input) {
    return PredictContent({
        prompt: Input.trim(),
        negative_prompt: NegativePrompt,
        height: 768,
        width: 512,
        cfg_scale: 7,
        save_images: true,
    }, true)
}

const PixelCountLimit = 600000;
function IsPixelCountAboveLimit(Height, Width) {
    return (Height * Width) > PixelCountLimit
}

function GenerateSeed() {
    let Seed = Math.floor(Math.random() * Math.pow(2, 32));
    return Seed;
}

/**
 * Predicts an image and then returns the path or error.
 * @param {StableDiffusionApi.Txt2ImgOptions} Input The settings for generation.
 * @param {Boolean} MakeSeed Whether or not to generate a seed.
 * @returns {Promise<String>} A promise which resolves to the path or error.
 */
async function PredictContent(Input, MakeSeed = true) {
    if (MakeSeed)
        Input.seed = GenerateSeed();
    
    return new Promise(async (res, reject) => {
        // If there's too many pixels, use HR scaling from one-half resolution.
        if (IsPixelCountAboveLimit(Input.height, Input.width)) {
            const scalar = 2;
            Input.height /= scalar; Input.width /= scalar;
            Input.hr_scale = scalar; Input.hr_second_pass_steps = 10; Input.hr_upscaler = "R-ESRGAN 4x+ Anime6B"; // R-ESRGAN 4x+ Anime6B
            Input.enable_hr = true;
            /*
            Input = Input.concat({
                hr_scale: 2,
                hr_second_pass_steps: 10,
                hr_upscaler: "Latent"
            })
            */
        }

        try {
            if ((Input.negative_prompt == undefined) || (Input.negative_prompt != undefined && !Input.negative_prompt.includes(NegativePrompt))) {
                Input.negative_prompt = NegativePrompt + (Input.negative_prompt ?? "");
            }

            // If there's \n characters in the prompt, replace them with commas.
            Input.prompt.replaceAll("\n", ", ")
            // Get image result from generator server.
            const result = (await FetchApp()).txt2img(Input);
    
            const end = `_${Input.seed}.png`;
            const Path = "./Images/" + `${Input.prompt.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 100)}${end}`
                // Sanatize path!
                .replace(/[/\\?%*:|"<>]/g, '-')
            
    
            result
                .then(async () => {
                    try {
                        (await (await result).image.toFile(Path))
                        console.log("Image written to " + Path + "!")
                        res(Path);
                    } catch (error) {
                        reject(error)
                    }
                })
        } catch (e) {
            reject(e)
        }
    });
}


/**
 * Description
 * @param {[any]} Input
 * @param {Message} DiscordMessage
 * @returns {Promise} When prediction is complete.
 */
/*
async function PredictWithMessage(Input, DiscordMessage) {
    let job = app.submit("/predict", Input);
    let content = "Generating! Tags: " + Input[0];
    /** @type {Message} */
    /*
    let message = DiscordMessage.channel.send(content);
    job.on("status", (status) => {
        // Update message when status changes.
        console.log(status)
        // if (status.status == "pending") 
    })
}
*/

module.exports = { ConnectTo, PredictContent, isConnected: IsConnected, GenerateSeed, IsPixelCountAboveLimit, FetchApp, DisconnectFrom, GetServers, ImageToImageFromPath, ImageToImageFromSharp, ConnectToPreset, GetTagsFromImage, PredictContentDefault, PixelCountLimit }