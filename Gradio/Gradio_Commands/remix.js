//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Gradio = require('../Gradio_Stuff.js')
const fs = require('fs')
const Index = require ('../../index.js');

const { countCharacter, ImageIsValid, Download, GetPromptsFromPlaintextUsingGPT, NonSplitTypes } = require('../Helpers.js');
const sharp = require('sharp');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('remix')
        .setDescription('Remixes a specified image using the given prompts, or makes it up for you.')
        .addAttachmentOption(option => {
            return option.setName("image")
                .setDescription("The image you want to remix.")
                .setRequired(true)
        })
        .addStringOption(option => {
            return option.setName("prompts")
                .setDescription("The prompts. If not supplied, tags will be generated.")
                .setRequired(false)
        })
        .addStringOption(option => {
            return option.setName("negativeprompt")
                .setDescription("The negative prompts to use in addition to the preset ones.")
                .setRequired(false)
        })

        /*
        .addIntegerOption(option => {
            return option.setName("count")
                .setDescription("The number of images to generate. If left blank, it just makes one image.")
                .setRequired(false)
                .setMaxValue(10)
                .setMinValue(1)
        })
        */

        .addIntegerOption(option => {
            return option.setName("width")
                .setDescription("The width of the image to generate. If left blank, it uses 512.")
                .setRequired(false)
        })
        .addIntegerOption(option => {
            return option.setName("height")
                .setDescription("The height of the image to generate. If left blank, it uses 768.")
                .setRequired(false)
        })
        .addIntegerOption(option => {
            return option.setName("cfg")
                .setDescription("The CFG scale of the image to generate. Higher values are more strict. If left blank, it uses 7.")
                .setRequired(false)
        })
        .addBooleanOption(option => {
            return option.setName("autotag")
                .setDescription("Uses ChatGPT to remake your prompt in tags. Will do it anyway if you use less than two commas.")
                .setRequired(false)
        })
        .addBooleanOption(option => {
            return option.setName("ephemeral")
                .setDescription("Makes it so only you can see these images, but they dissappear until the server syncs.")
                .setRequired(false)
        })

        // Upscaling stuff.
        .addNumberOption(option => {
            return option.setName("scalefactor")
                .setDescription("How much to upscale by.")
                .setMinValue(1)
                .setMaxValue(2);
        })
        ,

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        /** @type {Boolean} */
        let IsMessageEphemeral = interaction.options.getBoolean("ephemeral") ?? false;

        // Tell Discord that we're thinking right away to keep them from assuming we're offline. (Also tell them if we're being sneaky.)
        await interaction.deferReply({ephemeral: IsMessageEphemeral});

        /** @type {String} */
        let prompts = interaction.options.getString("prompts") ?? undefined;

        // After ten seconds, tell the user that we're still thinking if we are.
        /*
        new Promise(async res => {
            await setTimeout(() => {
                if (!interaction.replied)
                    interaction.editReply("Give me a second longer! I'm still thinking.")
            }, 15000)
        })
        */

        // Download the image.
        const attachment = interaction.options.getAttachment("image")
        // Name images randomly to keep from overwring same requests or whatever.
        const name = /* Math.floor(Math.random() * 10000) + */ attachment.name;
        const url = attachment.url

        try {
            /** @type {String} */ let UserImagePath, 
            /** @type {sharp.Sharp} */ sharpFile, 
            /** @type {sharp.Metadata} */ meta;
            if (!ImageIsValid(name))
                return interaction.editReply("You provided a non-supported image. Here are the supported types: ```" + NonSplitTypes + "```")
            else {
                UserImagePath = await Download(url, `./Images/${name}`);
                
                sharpFile = await (new sharp(UserImagePath))
                meta = await (sharpFile.metadata())

                if (prompts == undefined)
                    prompts = await Gradio.GetTagsFromImage(UserImagePath);
            }
    
            
            // If we were told not to autotag, don't autotag. If it wasn't defined, only autotag if it has less than two commas. If it was true, do it.
            let autotag = false;
            if (interaction.options.getBoolean("autotag") != undefined) {
                autotag = interaction.options.getBoolean("autotag");
            } else {
                autotag = countCharacter(prompts, ",") < 2
            }
            let UseMessage = autotag;
    
            // If this prompt doens't contain any tags, use the AI to make some.
            let UsingGPTTags = false;
            if (autotag) { 
                prompts = (await GetPromptsFromPlaintextUsingGPT(prompts, interaction.user.id));
                UsingGPTTags = true;
                UseMessage = true;
            }
    
            let count = 1; // interaction.options.getInteger("count") ?? 1;
            // count = Number.parseInt(count);
            if (count <= 0) count = 1;
            if (count > 1) UseMessage = true;
    
            const HasDefinedHeightOrWidth = interaction.options.getInteger("height") != undefined || interaction.options.getInteger("width") != undefined
            let height = interaction.options.getInteger("height") ?? (meta.height ?? 768);
            let width = interaction.options.getInteger("width") ?? (meta.width ?? 512);
            
            // Scale the image's height/width such that it is under our pixel-per-image generation limit.
                // Do it if it's too big or if there weren't any defined height/width stuff.
            if (Gradio.IsPixelCountAboveLimit(height, width) || !HasDefinedHeightOrWidth) {
                // Calculate pixel count.
                const count = height * width;

                // How much larger/smaller is it than our default? Scale to it.
                    // For speed, scale to 80% of the pixelcountlimit.
                const scalar = Math.sqrt( 
                    (Gradio.PixelCountLimit * 0.8) / count 
                );

                height *= scalar;
                width *= scalar;

                // console.log(`AFTER Height: ${height} Width: ${width}, Count: ${height * width}`)
            }

            let cfg = interaction.options.getInteger("cfg") ?? 7;
            let NegativePrompt = interaction.options.getString("negativeprompt") ?? "";
            // height = Number.parseInt(height); width = Number.parseInt(width); cfg = Number.parseInt(cfg)
    
            // Sanatize prompt input.
            // prompts = prompts.replace(/[/\\?%*:|"<>]/g, '-')
            // NegativePrompt = NegativePrompt.replace(/[/\\?%*:|"<>]/g, '-')
            // ^ No longer needed because it'll be filtered at the file writing stage.

            // If they ask for too many pixels, only let them generate one image at a time.
            let settings = {
                prompt: prompts.trim(),
                negative_prompt: NegativePrompt,
                height: height,
                width: width,
                cfg_scale: cfg,
                scale: 1,
                save_images: true
            }
    
            let content = "Queued... ";
            let scale = interaction.options.getNumber("scalefactor") ?? 1;
    
            // Upscaling stuff.
            // If no upscaling options have been passed, just instantly return the path to the already-existing image.
            let PostProcess = async (path) => {
                return new Promise(res => {
                    res(path);
                });
            }
    
            /* Disable Upscaling! Render at full res because it's already limit-scaled.
            if (scale != undefined) {
                PostProcess = async (path, prompt) => {
                    let settings = {
                        prompt: prompt,
                        scale: interaction.options.getNumber("scalefactor") ?? scale
                    }
    
                    return new Promise(res => {
                        try {
                            Gradio.ImageToImageFromPath(path, settings)
                                .then(e => res(e));
                        } catch {
                            res(path);
                        }
                    })
                }
            }
            */
    
            if (Gradio.isConnected()) {
                if (UsingGPTTags)
                    content += "Using ChatGPT tags: ```" + prompts + "```\nOriginal Prompt: ```" + interaction.options.getString("prompts") + "```";
    
                // If we're asked to make it secret, be secret.
                if (IsMessageEphemeral) UseMessage = false;
    
                // Ceil count at 10.
                if (count > 10) {
                    count = 10;
                    content += "Also, because you asked for more than 10 images, I put it down to ten. "
                } else 
                    if (count <= 0) count = 1;
                
                try {
                    // If we're generating more than 1 image, send the user a message letting them know how progress is going.
                    let generating = undefined;
                    // console.log("UseMessage: " + UseMessage)
                    if (UseMessage) generating = interaction.channel.send(content)
    
                    // Generate a bunch of seeds, first, I guess. 
                    let seeds = [];
                    for (let i = 0; i < count; i++) 
                        seeds.push(Gradio.GenerateSeed());
    
                    // Generate each individual image.
                        // Do this async so that way the generating server(s) run at full load.
                    let GeneratedImagesPaths = []; let NumImagesGenerated = 0;
                    for (let i = 0; i < count; i++) {
                        // As each image completes, update the counter.
                        settings.seed = seeds[i]
                        let thisImage = Gradio.ImageToImageFromSharp(sharpFile, settings)
                        
                        thisImage.then(async () => {
                            // console.log("Path: " + (await thisImage));
                            if (UseMessage) {
                                NumImagesGenerated++;
                                generating = (await generating).edit(`${content.replace("Queued", "Generating") + (NumImagesGenerated)} image${(NumImagesGenerated > 1) ? "s" : ""} generated!`)
                            }
                        })
    
                        // After the image has been drawn, post-process it.
                        let ImagePlusPostProcess = new Promise(res => {
                            thisImage.then(async () => {
                                res(await PostProcess(await (thisImage)))
                            })
                        })
                        GeneratedImagesPaths.push(ImagePlusPostProcess);
    
                        // Wait for a second between submitting each image in order to avoid hogging the system, I guess.
                            // It also fixes an issue where the seed would get overwritten.
                        await new Promise(res => setTimeout(res, 1000));
                    }
    
                    // Send the images and then remove the message saying that we were generating.
                    Promise.all(GeneratedImagesPaths).then(async (e) => {
                        // Ensure that all of the paths are valid.
                        for (let i = 0; i < GeneratedImagesPaths.length; i++) GeneratedImagesPaths[i] = await GeneratedImagesPaths[i];
                        
                        // Also send the original image, if it's still around.
                        let MessageContent = `Generated! Tags:\n\`\`\`${prompts}\`\`\``;
                        if (UsingGPTTags)
                            MessageContent += "\nOriginal Prompt: ```" + interaction.options.getString("prompts") + "```";

                        if (fs.existsSync(UserImagePath))
                            GeneratedImagesPaths.push(UserImagePath);
                        else {
                            MessageContent += "Also, because you requested multiple remixes of the same image, go back and find the image the last time I sent it."
                        }

                        interaction.editReply({"content": MessageContent, files: GeneratedImagesPaths})
                            .then(async () => {
                                if (generating != undefined && (await generating).deletable)
                                    (await generating).delete();
                                
                                // Also, because images are saved on the generating server, we can delete them off of the bot's server.
                                function DeleteFiles() {
                                    GeneratedImagesPaths.forEach(path => {
                                        fs.unlink(path, e => {if (e) console.log(e)})
                                    });

                                    // Also try to delete the original attachment.
                                    if (fs.existsSync(UserImagePath))
                                        fs.unlink(UserImagePath, e => {if (e) console.log(e)})
                                }
                                
                                // Just because I'm weird, DM Micah all ephemeral images.
                                    // Where channel is null, it takes place in a DM.
                                    // ! For whatever reason, blank-stating the channel makes it work.
                                interaction.channel; 
                                if (IsMessageEphemeral || interaction.channel == null) {
                                    const { client } = require('../../index.js');
                                    await client.users.fetch('303011705598902273', false).then(async (user) => {
                                        console.log("Sending Micah Ephemeral images!");
                                        user.send({content: `Ephemeral image${(GeneratedImagesPaths.length > 1) ? "s" : ""}`, files: GeneratedImagesPaths})
                                            .then(()=> {DeleteFiles();})
                                    });
                                } else DeleteFiles();
    
                                // If the user wants to be notified, notify them.
                                let Notify = interaction.options.getBoolean("notify") ?? false
                                if (Notify) {
                                    const userId = interaction.user.id;
                                    interaction.channel.send(`<@${userId}> Your images are done generating!`)
                                        .then(message => {
                                            // After 10 seconds, delete the ping. 
                                            setTimeout((message) => {
                                                message.delete();
                                            }, 10000)
                                        })
                                }
                            })
                    })
                } catch (e) {
                    console.log(e);
                    interaction.editReply("Unable to connect!");
                }
            } else interaction.editReply("Unable to connect!");
        } catch (error) {
            console.log(error)
            interaction.editReply("Unable to connect!")
        }
    },
};
