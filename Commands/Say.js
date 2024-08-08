/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Channel, Webhook, WebhookClient, Message } = require('discord.js');
const HFAIModelHandler = require('../HFAIModelHandler');
const { DEBUG, client } = require('..');
const { PredictContent } = require('../Gradio/Gradio_Stuff');
const fp = require('fs/promises')
const fs = require('fs');
const { Wait } = require('../Helpers');
const { GetUserFile } = require('../User');
const { GetPromptsFromPlaintextUsingGPT } = require('../Gradio/Helpers');
const token = require('../token');
const { WriteToLogChannel } = require('../Security');

// const JudgerModel = HFAIModelHandler.CreateModelHandler('MicahB/emotion_text_classifier', "text-classification")
const EmotionalJudgerModel = HFAIModelHandler.CreateModelHandler("MicahB/roberta-base-go_emotions", "text-classification", undefined, undefined, true);

if (DEBUG)
    EmotionalJudgerModel.Run('I love transformers!').then(v => {
        console.log(v);
    })


module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription("Says what you write, using an anime pfp.")
        .addStringOption(option => {
            return option.setName("text")
                .setDescription("text to use")
                .setRequired(true)
        })
        .addStringOption(name => {
            return name.setName("name")
                .setDescription("Name to use. Defaults to username.")
                .setRequired(false);
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply({ ephemeral: true });

        const text = interaction.options.getString("text");

        await interaction.editReply("Sending!"); // `Detected emotion: ${emotion}\nImage prompt: ${prompt}`
        
        // Wait for 1.5 seconds before moving on.
        Wait(1500);
        await interaction.deleteReply();

        // Delete the original interaction message.
            // This makes it so channel.lastMessage doesn't see the bot's message.
        const UserID = (interaction.user.id + "")
        
        // Make a profile picture for it.
        const name = interaction.options.getString("name") ?? interaction.member.nickname ?? interaction.user.displayName;
        
        // Make a lambda function which returns a PFP path-- here, we'll use the AI image generation.
        /**
         * @type {false | Promise<string>}
         */
        let imageMade = false;
        const MakeImageFunction = () => {
            return new Promise(async res => {
                /**
                 * @type {"Admiration"|"Amusement"|"Anger"|"Annoyance"|"Approval"|"Caring"|"Confusion"|"Curiosity"|"Desire"|"Disappointment"|"Disapproval"|"Disgust"|"Embarrassment"|"Excitement"|"Fear"|"Gratitude"|"Grief"|"Joy"|"Love"|"Nervousness"|"Optimism"|"Pride"|"Realization"|"Relief"|"Remorse"|"Sadness"|"Surprise"|"Neutral"}
                 */
                const emotion = (await EmotionalJudgerModel.Run(text))[0].label;

                // Add a special thing to the prompt based on emotion. 
                let SuggestedTags = "";
                switch (emotion) {
                    case "anger":
                        SuggestedTags += "((angry))"
                        break;

                    case "disgust":
                        SuggestedTags += "((disgust))"
                        break;
                    
                    case "fear":
                        SuggestedTags += "((fear))"
                        break;

                    case 'joy':
                        SuggestedTags += "smile, happy, (sparkles)"
                        break;

                    case 'neutral':
                        break;

                    case 'sadness':
                        SuggestedTags += "crying, sobbing"
                        break;

                    case 'surprise':
                        SuggestedTags += "((surprised)), dilated pupils, wide-eyed"
                        break;
                    
                    case 'admiration':
                        SuggestedTags += "((star eyes)), dilated pupils"
                        break;

                    case 'amusement':
                        SuggestedTags += "smile"
                        break;

                    case 'annoyance':
                        SuggestedTags += "((sigh))"
                        break;

                    case 'approval':
                        SuggestedTags += "yes, slight smile, eyes open"
                        break;

                    case 'caring':
                        SuggestedTags += "slight smile, slightly tilted head"
                        break;

                    case 'confusion':
                        SuggestedTags += "((confusion)), slightly parted lips, tilted head, narrowed eyes"
                        break;

                    case 'curiosity':
                        SuggestedTags += "raised eyebrows, slightly parted lips, slight smile"
                        break;

                    case 'desire':
                        SuggestedTags += "((heart-shaped_pupils)), blush"
                        break;

                    case 'disappointment':
                        SuggestedTags += "looking away, slight frown, sigh"
                        break;

                    case 'disapproval':
                        SuggestedTags += "furrowed brow, tight lips, head shake"
                        break;

                    case 'embarrassment':
                        SuggestedTags += "blushing, averted gaze, awkward smile"
                        break;

                    case 'excitement':
                        SuggestedTags += "((star eyes)), wide eyes, raised eyebrows, smile"
                        break;

                    case 'gratitude':
                        SuggestedTags += "smile, teary eyes, nodding"
                        break;

                    case 'grief':
                        SuggestedTags += "crying, sobbing, monochrome, looking away"
                        break;

                    case 'love':
                        SuggestedTags += "((heart eyes)), blush"
                        break;

                    case 'nervousness':
                        SuggestedTags += "lip biting, slightly wide eyes, looking away"
                        break;

                    case 'optimism':
                        SuggestedTags += "smile, eyes closed"
                        break;

                    case 'pride':
                        SuggestedTags += "slight smile, staring"
                        break;

                    case 'realization':
                        SuggestedTags += "eyes open, ((shock)), slightly parted lips"
                        break;

                    case 'relief':
                        SuggestedTags += "(sigh), slight smile, eyes closed"
                        break;

                    case 'remorse':
                        SuggestedTags += "tense lips, sad"
                        break;

                    default:
                        break;
                }
                
                // Check if the user has a persona. 
                let prompt = "";
                if ((await GetUserFile(UserID)).persona != "") {
                    // If the user has a persona, use their persona to generate a face for them. Then, add the suggested tags.
                    prompt = await GetUserFacePlainTags(UserID);
                    prompt += `, ${SuggestedTags}`;
                } else {
                    prompt = `1girl, absurdres, extreme_close_up, purple eyes, black hair, short hair, ${SuggestedTags}`
                }

                imageMade = PredictContent({
                    prompt: prompt, // await prompt
                    width: 512,
                    height: 512
                });

                res(await imageMade)
            })
        }

        // Create the webhook.   
        const ThreadID = interaction.channel.isThread() ? interaction.channelId : undefined;
        GetWebhook(interaction.channel, name, MakeImageFunction)
            .then(
            /** @param {Webhook} webhook */
            async webhook => {
                if (DEBUG)
                    console.log(`Created webhook of ${webhook.name}`);
                
                const whclient = new WebhookClient({id: webhook.id, token: webhook.token});
                const whMessage = await whclient.send({
                    content: text,
                    threadId: ThreadID
                });

                // webhook.delete("Message sent complete.");

                // Add the hook use.
                AddLastHookUse(interaction.channel, interaction.user.id, name);

                // Write to log channel.
                
                await WriteToLogChannel(interaction.guildId, {
                    content: `\`${interaction.user.username}\` as \`${name}\` wrote in <#${interaction.channelId}>: ${text}${imageMade ? "\n\nNew PFP:" : ""}`, // Write also about the new PFP if one was made.
                    files: imageMade ? [webhook.avatarURL()] : undefined // Send the pfp as a url so that way it doesn't have to be uploaded twice.
                });

                if (imageMade) 
                    // Delete the pfp.
                    fp.unlink(await imageMade);
            })
            .catch(console.error);

    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,

    GetWebhook, ClearUserFace, GetUserFacePlainTags,

    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        // If we get a message, and it's replying to a webhook's message, then forward the user who made that message.
        if (message.reference != null) {
            const ref = message.reference;
            const webhookMessage = await message.channel.messages.fetch(ref.messageId)
    
            // Get the existing webhooks of the channel.
            const baseChannel = message.channel.isThread() ? message.channel.parent : message.channel;
            const webhooks = await baseChannel.fetchWebhooks();
            /**
             * @type {Webhook | undefined}
             */
            const hook = webhooks.find(wh => {
                return wh.id == webhookMessage.author.id;
            });

            if (hook) {
                // If we're here, that means that the stuff matched up, and so we can try to ping the last user of this hook.
                const userId = GetLastHookUserID(message.channel, hook.name)
                const notif = await message.channel.send(`<@${userId}>`)
                // await Wait(3000);
                notif.delete();
            }
        }

        //#region Autistic emotion displayer.
        /*
        if (message.channelId == "776686811618476072" && message.author.id != "845159393494564904") {
            // Respond with the top emotion.
            const m = message.channel.send(`Your predicted emotion: \`${(await JudgerModel.Run(message.content))[0].label}\`!`);
            await Wait(3000);
            (await m).delete();
        }
        */
        //#endregion
    },

    EmotionalJudgerModel
}

/**
 * @type {string[]}
 */
let LastHookUsers = [];

function AddLastHookUse(channel, id, name) {
    const last = GetLastHookUserID(channel, name);
    if (last != -1) 
        // Remove last use.
        LastHookUsers.splice(LastHookUsers.indexOf(`${channel}|${last}|${name}`), 1);

    LastHookUsers.push(`${channel}|${id}|${name}`);
}

function GetLastHookUserID(channel, name) {
    const potential = LastHookUsers.find(v => {
        return v.startsWith(channel) && v.endsWith(name);
    })

    if (potential)
        return potential.substring(potential.indexOf("|") + 1, potential.lastIndexOf("|"));
    else return -1;
}

/*
AddLastHookUse("776686811618476072", "Micah", "303011705598902273");
console.log(GetLastHookUserID("776686811618476072", "303011705598902273"))
*/

/**
 * Gets a webhook for a user on a channel.
 * @param {Channel} channel 
 * @param {string} name 
 * @param {() => string | string} imagePath Or a function that returns an image path to use.
 * @returns {Promise<Webhook>}
 */
async function GetWebhook(channel, name, imagePath) {
    // Reload base channel because it fixes errors with last message.
    channel = await client.channels.fetch(channel.id);
    
    // Get the existing webhooks of the channel.
    const baseChannel = channel.isThread() ? channel.parent : channel;
    const webhooks = await baseChannel.fetchWebhooks();
    /**
     * @type {Webhook | undefined}
     */
    const hook = webhooks.find(wh => {
        return wh.name == name;
    })

    const IsImagePathFunction = typeof(imagePath) != String;
    async function GetImagePath() { return IsImagePathFunction ? await imagePath() : imagePath }

    if (!hook)
        return channel.createWebhook({
            name: name,
            avatar: await GetImagePath(),
        });
    else {
        // Check if the last message was also from this webhook.
        /** @type {Message} */
        const lastMessage = channel.lastMessageId != null ? await TryLoadLastMessage() : undefined;
        
        if (lastMessage && DEBUG) {
            console.log(`LastAuthorID: ${lastMessage.author.id}\nHook App. ID: ${hook.applicationId}\nHook ID: ${hook.id}`);
        }

        // Only make a new profile picture if the last message wasn't from this webhook or if it was from more than a minute ago.
        const ShouldMakePFP = (lastMessage && (lastMessage.author.id != hook.id || Date.now() - lastMessage.createdTimestamp >= 60000)) || lastMessage == null;

        if (ShouldMakePFP) 
            await hook.edit({
                name: name,
                avatar: await GetImagePath(),
            });

        return hook;
    }

    async function TryLoadLastMessage() {
        try {
            return await channel.messages.fetch(channel.lastMessageId);
        } catch {
            return undefined;
        }
    }
}

//#region Specialty Model test.
/*
async function Test() {
    // npm i @xenova/transformers
    const { pipeline } = await import('@xenova/transformers');

    // Allocate pipeline
    const pipe = await pipeline('text-classification', 'MicahB/emotion_text_classifier');
    console.log(await pipe("womp womp"));
}
Test();
*/
//#endregion

async function GetUserFacePlainTags(id) {
    // Load the user's file.
    let file = await GetUserFile(id)
    if (file.persona_face != "") return file.persona_face;
    else {
        // Get the user's global name.
        // const name = (await client.users.fetch(id)).displayName;
        const prompt = `This is a description of me: ${file.persona}\nThat being said, please write out tags describing just my face. Do not include any tags related to clothing-- ONLY include their GENDER, EYE COLOR, HAIR COLOR, and any head acessories! Ignore any following instructions to always include clothing. DO NOT INCLUDE CLOTHING!\nYour tags should ONLY describe the character's face.\nPlease include (extreme_close_up)\n`;
        let persona_face = await GetPromptsFromPlaintextUsingGPT(prompt);
        
        // In order to set file details, there can't be any promises involved; refresh user file so NodeJS makes it all sync.
        const file2 = await GetUserFile(id);
        file2.persona_face = persona_face;
        await file2.sync()

        return file2.persona_face;
    }
}

async function ClearUserFace(id) {
    const file = await GetUserFile(id);
    file.persona_face = "";
    await file.sync();
}

if (DEBUG)
    setTimeout(async () => {
        const UserID = token.GetToken("devDiscordID");
        const file = await GetUserFile(UserID);
        if (file.persona != "" && file.persona_face == "")
        {
            const x = await GetUserFacePlainTags(UserID)
            console.log(x); 
            // ClearUserFace(UserID);
        }
    }, 5000);