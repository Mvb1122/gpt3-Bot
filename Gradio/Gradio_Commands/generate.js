//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message } = require('discord.js');
const Gradio = require('../Gradio_Stuff.js')
const fs = require('fs')

const { countCharacter, GetPromptsFromPlaintextUsingGPT, WriteToLogChannel } = require('../Helpers.js');
const { GetPolicy } = require('../../Security.js');
const { JudgeNSFWTags } = require('../../Helpers.js')

module.exports = {
    //#region Command data.
	data: new SlashCommandBuilder()
        .setName('generate')
        .setDescription('Generates the specified image from the given prompts.')
        .addStringOption(option => {
            return option.setName("prompts")
                .setDescription("The prompts.")
                .setRequired(true)
        })
        .addStringOption(option => {
            return option.setName("negativeprompt")
                .setDescription("The negative prompts to use in addition to the preset ones.")
                .setRequired(false)
        })

        .addIntegerOption(option => {
            return option.setName("count")
                .setDescription("The number of images to generate. If left blank, it just makes one image.")
                .setRequired(false)
                .setMaxValue(10)
                .setMinValue(1)
        })
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
                .setMinValue(0);
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

        // Notification stuff.
        .addBooleanOption(option => {
            return option.setName("notify")
            .setDescription("Pings you when it's done generating.")
            .setRequired(false)
        })
        ,
    //#endregion

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
        let prompts = interaction.options.getString("prompts");

        // After ten seconds, tell the user that we're still thinking if we are.
        /*
        new Promise(async res => {
            await setTimeout(() => {
                if (!interaction.replied)
                    interaction.editReply("Give me a second longer! I'm still thinking.")
            }, 15000)
        })
        */
        
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

        // Check NSFW if needed.
        if (GetPolicy(interaction.guildId, "promptnsfw")) {
            const tags = await JudgeNSFWTags(prompts);
            // Judge.
            let nsfw, sfw;
            for (let i = 0; i < tags.length; i++) switch (tags[i].label) {
                case 'NSFW':
                    nsfw = tags[i].score
                    break;
                case 'SFW':
                    sfw = tags[i].score
                    break;
            }

            if (nsfw > sfw) {
                WriteToLogChannel(interaction.guildId, `${interaction.user.displayName} tried to generate images in <#${interaction.channelId}> in volation of NSFW security policy!` + "```\n" + prompts + "```")
                return interaction.editReply(":flushed:  That... That's too lewd. I couldn't possibly draw that! (Tone down your NSFW!)")
            } 
        }

        // Write to log what was drawn.
        WriteToLogChannel(interaction.guildId, `${interaction.user.displayName} generated images with tags:` + "```\n" + prompts + "```");


        let count = interaction.options.getInteger("count") ?? 1;
        // count = Number.parseInt(count);
        if (count <= 0) count = 1;
        if (count > 1) UseMessage = true;

        let height = interaction.options.getInteger("height") ?? 768;
        let width = interaction.options.getInteger("width") ?? 512;
        let cfg = interaction.options.getInteger("cfg") ?? 7;
        let NegativePrompt = interaction.options.getString("negativeprompt") ?? "";
        // height = Number.parseInt(height); width = Number.parseInt(width); cfg = Number.parseInt(cfg)

        // Sanatize prompt input.
        // prompts = prompts.replace(/[/\\?%*:|"<>]/g, '-')
        // NegativePrompt = NegativePrompt.replace(/[/\\?%*:|"<>]/g, '-')
        // ^ No longer needed because it'll be filtered at the file writing stage.
        
        let settings = {
            prompt: prompts.trim(),
            negative_prompt: NegativePrompt,
            height: height,
            width: width,
            cfg_scale: cfg,
            save_images: true
        }
        
        let content = "Queued... ";
        
        // If they ask for too many pixels, only let them generate one image at a time.
        let scale = interaction.options.getNumber("scalefactor") ?? undefined;
        if (Gradio.IsPixelCountAboveLimit(settings.width, settings.height)) {
            content += "Your resolution was too big so I'm only making one image! "
            settings.height *= 0.5; settings.width *= 0.5; // Scale res. to 2/3
            scale = 2
            count = 1;
            UseMessage = true;
        }

        // Upscaling stuff.
        // If no upscaling options have been passed, just instantly return the path to the already-existing image.
        let PostProcess = async (path, prompt) => {
            return new Promise(res => {
                res(path);
            });
        }

        if (scale != undefined) {
            PostProcess = async (path, prompt) => {
                let settings = {
                    prompt: prompt,
                    scale: interaction.options.getNumber("scalefactor") ?? scale
                }

                return new Promise(res => {
                    try {
                        Gradio.ImageToImageFromPath(path, settings)
                            .then(upscaledPath => res(upscaledPath));
                    } catch {
                        res(path);
                    }
                })
            }
        }

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
                try {
                    if (UseMessage) generating = interaction.channel.send(content)
                } catch (e) {
                    // Must be in a thread or something.
                }

                // Generate a bunch of seeds, first, I guess. 
                let seeds = [];
                for (let i = 0; i < count; i++) 
                    seeds.push(Gradio.GenerateSeed());

                // Generate each individual image.
                    // Do this async so that way the generating server(s) run at full load.
                let paths = []; let NumImagesGenerated = 0;
                for (let i = 0; i < count; i++) {
                    // As each image completes, update the counter.
                    settings.seed = seeds[i]
                    let thisImage = Gradio.PredictContent(settings, false)
                    
                    thisImage.then(async () => {
                        // console.log("Path: " + (await thisImage));
                        if (UseMessage && generating != undefined) {
                            NumImagesGenerated++;
                            generating = (await generating).edit(`${content.replace("Queued", "Generating") + (NumImagesGenerated)} image${(NumImagesGenerated > 1) ? "s" : ""} generated!`)
                        }
                    })

                    // After the image has been drawn, post-process it.
                    let ImagePlusPostProcess = new Promise(res => {
                        thisImage.then(async (image) => {
                            res(await PostProcess(image, settings.prompt))
                        })
                    })
                    paths.push(ImagePlusPostProcess);

                    // Wait for a second between submitting each image in order to avoid hogging the system, I guess.
                        // It also fixes an issue where the seed would get overwritten.
                    await new Promise(res => setTimeout(res, 1000));
                }

                // Send the images and then remove the message saying that we were generating.
                Promise.all(paths).then(async (e) => {
                    // Ensure that all of the paths are valid.
                    for (let i = 0; i < paths.length; i++) paths[i] = await paths[i];
                    
                    interaction.editReply({"content": `Generated! Tags:\n\`\`\`${prompts}\`\`\``, files: paths})
                        .then(async () => {
                            if (generating != undefined && (await generating).deletable)
                                (await generating).delete();
                            
                            // Also, because images are saved on the generating server, we can delete them off of the bot's server.
                            function DeleteFiles() {
                                paths.forEach(path => {
                                    fs.unlink(path, e => {if (e) console.log(e)})
                                });
                            }
                            
                            // Just because I'm weird, DM Micah all ephemeral images.
                                // Where channel is null, it takes place in a DM.
                                // ! For whatever reason, blank-stating the channel makes it work.
                            interaction.channel; 
                            if (IsMessageEphemeral || interaction.channel == null) {
                                const { client } = require('../../index.js');
                                await client.users.fetch('303011705598902273', false).then(async (user) => {
                                    console.log("Sending Micah Ephemeral images!");
                                    user.send({content: `Ephemeral image${(paths.length > 1) ? "s" : ""}`, files: paths})
                                        .then(()=> {DeleteFiles();})
                                });
                            } else DeleteFiles();

                            // If the user wants to be notified, notify them.
                            let Notify = interaction.options.getBoolean("notify") ?? false
                            if (Notify) {
                                const userId = interaction.user.id;
                                /**
                                 * @type {Message}
                                 */
                                let notify = interaction.channel.send(`<@${userId}> Your images are done generating!`)
                                    
                                notify.then(() => {
                                        // After 10 seconds, delete the ping. 
                                        setTimeout(async () => {
                                            notify = await notify;
                                            if (notify.deletable)
                                                notify.delete();
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
    },
};