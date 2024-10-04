/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Channel, Webhook, WebhookClient, Message, User, TextBasedChannel, EmbedBuilder, TextChannel } = require('discord.js');
const HFAIModelHandler = require('../HFAIModelHandler');
const { DEBUG, client } = require('..');
const { PredictContent } = require('../Gradio/Gradio_Stuff');
const fp = require('fs/promises');
const EditMessagePrefix = "e- ";
const { Wait } = require('../Helpers');
const { GetUserFile } = require('../User');
const { GetPromptsFromPlaintextUsingGPT, Download } = require('../Gradio/Helpers');
const token = require('../token');
const { WriteToLogChannel } = require('../Security');
const { MessagePayload } = require('discord.js');
const { GetSuggestedPersonaNames } = require('./SetPersona');
const Path = require('path');
const CleanWH = require('./CleanWH');

// const JudgerModel = HFAIModelHandler.CreateModelHandler('MicahB/emotion_text_classifier', "text-classification")
const EmotionalJudgerModel = HFAIModelHandler.CreateModelHandler("MicahB/roberta-base-go_emotions", "text-classification", undefined, undefined, true);

if (DEBUG)
    EmotionalJudgerModel.Run('I love transformers!').then(v => {
        console.log(v);
    })


/**
 * @type {{UserID: string;Name: string;}[]}
 */
let TrackingSets = [
]

if (DEBUG) 
    TrackingSets.push({
        UserID: token.GetToken("devDiscordID"),
        Name: "Cat Micah"
    })

/**
 * @param {@type {"Admiration"|"Amusement"|"Anger"|"Annoyance"|"Approval"|"Caring"|"Confusion"|"Curiosity"|"Desire"|"Disappointment"|"Disapproval"|"Disgust"|"Embarrassment"|"Excitement"|"Fear"|"Gratitude"|"Grief"|"Joy"|"Love"|"Nervousness"|"Optimism"|"Pride"|"Realization"|"Relief"|"Remorse"|"Sadness"|"Surprise"|"Neutral"}} emotion 
 * @returns {string} Tags coorelating with the emotion.
 */
function GetSuggestedTagsFromEmotion(emotion) {
    let SuggestedTags = "";
    switch (emotion) {
        case "anger":
            SuggestedTags += "((angry))";
            break;

        case "disgust":
            SuggestedTags += "((disgust))";
            break;

        case "fear":
            SuggestedTags += "((fear))";
            break;

        case 'joy':
            SuggestedTags += "smile, happy, (sparkles)";
            break;

        case 'neutral':
            break;

        case 'sadness':
            SuggestedTags += "crying, sobbing";
            break;

        case 'surprise':
            SuggestedTags += "((surprised)), dilated pupils, wide-eyed";
            break;

        case 'admiration':
            SuggestedTags += "((star eyes)), dilated pupils";
            break;

        case 'amusement':
            SuggestedTags += "smile";
            break;

        case 'annoyance':
            SuggestedTags += "((sigh))";
            break;

        case 'approval':
            SuggestedTags += "slight smile, eyes open, nod";
            break;

        case 'caring':
            SuggestedTags += "slight smile, slightly tilted head";
            break;

        case 'confusion':
            SuggestedTags += "((confusion)), slightly parted lips, tilted head, narrowed eyes";
            break;

        case 'curiosity':
            SuggestedTags += "raised eyebrows, slightly parted lips, slight smile";
            break;

        case 'desire':
            SuggestedTags += "((heart-shaped_pupils)), blush";
            break;

        case 'disappointment':
            SuggestedTags += "looking away, slight frown, sigh";
            break;

        case 'disapproval':
            SuggestedTags += "furrowed brow, tight lips, head shake";
            break;

        case 'embarrassment':
            SuggestedTags += "blushing, averted gaze, awkward smile";
            break;

        case 'excitement':
            SuggestedTags += "((star eyes)), wide eyes, raised eyebrows, smile";
            break;

        case 'gratitude':
            SuggestedTags += "smile, teary eyes, nodding";
            break;

        case 'grief':
            SuggestedTags += "crying, sobbing, monochrome, looking away";
            break;

        case 'love':
            SuggestedTags += "((heart eyes)), blush";
            break;

        case 'nervousness':
            SuggestedTags += "lip biting, slightly wide eyes, looking away";
            break;

        case 'optimism':
            SuggestedTags += "smile, eyes closed";
            break;

        case 'pride':
            SuggestedTags += "slight smile, staring";
            break;

        case 'realization':
            SuggestedTags += "eyes open, ((shock)), slightly parted lips";
            break;

        case 'relief':
            SuggestedTags += "(sigh), slight smile, eyes closed";
            break;

        case 'remorse':
            SuggestedTags += "tense lips, sad";
            break;

        default:
            break;
    }
    return SuggestedTags;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription("Says what you write, using an anime pfp.")
        .addStringOption(option => {
            return option.setName("text")
                .setDescription("text to use")
                .setRequired(false)
        })
        .addStringOption(name => {
            return name.setName("name")
                .setDescription("Name to use. Defaults to username.")
                .setRequired(false)
                .setAutocomplete(true)
        })
        .addBooleanOption(op => {
            return op.setName("track")
                .setDescription("Whether to start/stop converting all of your messages.")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply({ ephemeral: true });

        const text = interaction.options.getString("text");
        const track = interaction.options.getBoolean("track");
        
        // Get the user's suggested name.
        const name = interaction.options.getString("name") ?? interaction.member.nickname ?? interaction.user.displayName;

        // If there's neither text nor track, then we have no idea what to do! Complain.
        if (text == undefined && track == undefined) 
            return interaction.editReply("Please either include a one-time text or enable or disable tracking!")

        // If we've got text:
        if (text != null) {
            await interaction.editReply("Sending!"); // `Detected emotion: ${emotion}\nImage prompt: ${prompt}`
        
            // Wait for 1.5 seconds before moving on.
            const WaitTimer = Wait(1500);

            // Delete the original interaction message, if there's no track set.
                // This makes it so channel.lastMessage doesn't see the bot's message.
            if (track == null) await Promise.all([WaitTimer, interaction.deleteReply()]);
            else await WaitTimer;
            
            // Make a lambda function which returns a PFP path-- here, we'll use the AI image generation.
            /**
             * @type {false | Promise<string>}
             */
            SendAsWebhookInChannel(text, await interaction.user.fetch(), await interaction.channel.fetch(), name);
        } 
        
        // If we're starting or stopping tracking, then set them up or remove it depending on what they said.
        if (track != null) {
            const AlreadySetup = TrackingSets.find(v => { return v.UserID == interaction.user.id; });
            
            // Start tracking.
            if (track) {
                if (AlreadySetup)
                    // Remove the old set.
                    while (TrackingSets.indexOf(AlreadySetup) != -1)
                        TrackingSets.splice(TrackingSets.indexOf(AlreadySetup), 1)

                // Add the new set.
                TrackingSets.push({
                    UserID: interaction.user.id,
                    Name: name    
                })

                interaction.editReply("Started watching you!");
            } else {
                // Simply stop.
                if (!AlreadySetup) interaction.editReply("It doesn't look like I was tracking you!");
                else {
                    // Remove the old set.
                    TrackingSets.splice(TrackingSets.indexOf(AlreadySetup), 1)
                    interaction.editReply("Stopped watching you!");
                }
            }
            
            //#region ToggleTracking old code.
            /*
            const AlreadySetup = TrackingSets.find(v => { return v.UserID == interaction.user.id; });
            if (AlreadySetup)
                // Remove the old set.
                TrackingSets.splice(TrackingSets.indexOf(AlreadySetup), 1)
            else
                TrackingSets.push({
                    UserID: interaction.user.id,
                    Name: name    
                })
            */ 
            //#endregion
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,

    GetWebhook, ClearUserFace, GetUserFacePlainTags, GetSuggestedTagsFromEmotion,

    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        // Ignore bots.
        if (message.author.bot) return;

        // If we've got a message from a tracked user, then delete their message and send it.
        let AlreadySetup = TrackingSets.find(v => { 
            const ThisIsTracking = v.UserID == message.author.id;
            return ThisIsTracking; 
        });

        // If we don't find something setup, then check their UserFile. 
        if (AlreadySetup == undefined && message.content.indexOf("-") != -1) {
            const User = await GetUserFile(message.author.id);
            const MatchingPersona = User.personas.find(v => message.content.toLowerCase().startsWith(v.name.toLowerCase()));
            if (MatchingPersona) {
                AlreadySetup = {
                    UserID: message.author.id,
                    Name: MatchingPersona.name
                }
                message.content = message.content.substring(message.content.indexOf("-") + 1).trim();
            }
        }

        if (AlreadySetup) {
            // If we're editing a message, do the edit.
            if (message.content.startsWith(EditMessagePrefix)) {
                const LastUse = LastHookMessages.find(v => {
                    return v.ChannelId == message.channelId && v.Name == AlreadySetup.Name;
                });

                if (LastUse) {
                    const content = message.content.substring(EditMessagePrefix.length);
                    const wh = await GetWebhook(message.channel, AlreadySetup.Name);

                    if (message.deletable) message.delete();
                    
                    const Options = {
                        content: content
                    };

                    const ThreadID = message.channel.isThread() ? message.channel.id : undefined;
                    return EditWebhookMessageInChannel(wh, LastUse.MessageID, ThreadID, Options);
                }
            }

            
            const content = message.content + "";
            const name = AlreadySetup.Name;
            SendMessageAsName(content, name);
        }

        /*
        // If we get a message which starts with one of the user's persona's names, use that instead.
            // Only check messages with - in them.
        else if (message.content.indexOf('-') != -1) {
            const User = await GetUserFile(message.author.id);
            const PersonaAtStart = User.personas.find(v => message.content.startsWith(v.name));

            if (PersonaAtStart) {
                SendMessageAsName(message.content.substring(PersonaAtStart.name.length + 1), PersonaAtStart.name);
            }
        }
        */

        // If we get a message, and it's replying to a webhook's message, then forward the user who made that message.
        if (message.reference != null) {
            const ref = message.reference;
            const webhookMessage = await message.fetchReference();
    
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
                if (userId == -1) return;
                else {
                    const notif = await message.channel.send(`<@${userId}>`)
                    // await Wait(3000);
                    return notif.delete();
                }
            }
        }


        async function SendMessageAsName(content, name) {
            const channelId = message.channel.id;
            const user = message.author.fetch();

            // Get a list of URLs of attachments.
            let FilePaths = await Promise.all(message.attachments.map(v => { return new Promise(res => {
                Download(v.url, Path.resolve(`./Temp/${v.name}`)).then(a => {
                    res(a)
                })
            })}));

            // Get reply info.
            const reply = message.reference ? (await message.fetchReference()) : undefined;
            let embed = undefined;
            if (reply) {
                embed = new EmbedBuilder()
                    .setTitle("Reply to:")
                    .setURL(`https://discord.com/channels/${message.guildId}/${message.channelId}/${reply.id}`)
                    .setDescription(reply.content);
            }
            
            // Remove the message.
            if (message.deletable) await message.delete();

            // Reload channel from id.
            // Force clear cache.
            // if (client.channels.cache.has(channelId)) client.channels.cache.sweep(v => {return v.id == channelId});
            const channel = client.channels.fetch(channelId);

            await SendAsWebhookInChannel(content, await user, await channel, name, FilePaths, false, embed);
            FilePaths.forEach(p => fp.unlink(p));
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

    EmotionalJudgerModel,

    OnAutocomplete(interaction) {
        return GetSuggestedPersonaNames(interaction, "Leave blank to use main.")
    }
}

/**
 * @type {string[]}
 */
let LastHookUsers = [];
/**
 * @type {[{ChannelId: string, Name: string, MessageID: string}]}
 */
let LastHookMessages = []

/**
 * 
 * @param {string} text 
 * @param {User} user 
 * @param {TextBasedChannel} channel 
 * @param {string} name 
 * @param {string[] | undefined} [fileURLs=undefined] Files to attach.
 * @param {boolean} [DoPing=true] Whether to do pings or not.
 * @param {EmbedBuilder} Embed
 * @returns {Promise} Resolves when complete.
 */
function SendAsWebhookInChannel(text, user, channel, name, fileURLs = undefined, DoPing = true, Embed) {
    return new Promise(resolve => {
        let imageMade = false, emotion = null;
        const MakeImageFunction = () => {
            return new Promise(async (res) => {
                /**
                 * @type {"Admiration"|"Amusement"|"Anger"|"Annoyance"|"Approval"|"Caring"|"Confusion"|"Curiosity"|"Desire"|"Disappointment"|"Disapproval"|"Disgust"|"Embarrassment"|"Excitement"|"Fear"|"Gratitude"|"Grief"|"Joy"|"Love"|"Nervousness"|"Optimism"|"Pride"|"Realization"|"Relief"|"Remorse"|"Sadness"|"Surprise"|"Neutral"}
                 */
                emotion = (await EmotionalJudgerModel.Run(text))[0].label;

                // Add a special thing to the prompt based on emotion. 
                let SuggestedTags = GetSuggestedTagsFromEmotion(emotion);

                // Check if the user has a persona. 
                let prompt = "";
                if ((await GetUserFile(user.id)).persona != "") {
                    // If the user has a persona, use their persona to generate a face for them. Then, add the suggested tags.
                    prompt = await GetUserFacePlainTags(user.id, name);
                    prompt += `, ${SuggestedTags}`;
                } else {
                    prompt = `1girl, absurdres, extreme_close_up, purple eyes, black hair, short hair, ${SuggestedTags}`;
                }

                imageMade = PredictContent({
                    prompt: prompt, // await prompt
                    width: 512,
                    height: 512
                }, true);

                res(await imageMade);
            });
        };

        // Create the webhook.   
        const ThreadID = channel.isThread() ? channel.id : undefined;
        GetWebhook(channel, name, MakeImageFunction)
            .then(
                /** @param {Webhook} webhook */
                async (webhook) => {
                    if (DEBUG)
                        console.log(`Got webhook ${webhook.name}`);

                    const HasEmbed = Embed != undefined;
                    const whclient = new WebhookClient({ id: webhook.id, token: webhook.token });
                    const message = await whclient.send({
                        content: text,
                        threadId: ThreadID,
                        files: fileURLs,
                        allowedMentions: DoPing ? undefined : { parse: [] },
                        embeds: HasEmbed ? [Embed] : undefined
                    });

                    // Add the message use.
                    const LastHookUse = LastHookMessages.find(v => v.ChannelId == channel.id);
                    if (LastHookUse)
                        LastHookMessages.splice(LastHookMessages.indexOf(LastHookUse), 1);
                    LastHookMessages.push({
                        ChannelId: channel.id,
                        Name: name,
                        MessageID: message.id
                    });

                    // webhook.delete("Message sent complete.");
                    // Add the hook use.
                    AddLastHookUse(channel, user.id, name);

                    // Write to log channel.
                    await WriteToLogChannel(channel.guildId, {
                        content: `\`${user.globalName}\` as \`${name}\` wrote in <#${channel.id}>: ${text}${imageMade ? `\nEmotion: \`${emotion}\`\nNew PFP:` : ""}`, // Write also about the new PFP if one was made.
                        files: imageMade ? [webhook.avatarURL({ size: 2048 })] : undefined // Send the pfp as a url so that way it doesn't have to be uploaded twice.,
                    });

                    if (imageMade)
                        // Delete the pfp.
                        fp.unlink(await imageMade);

                    resolve();
                })
            .catch(console.error);
    })
}

/**
 * Edits a message as a webhook. Fixes a bug in DiscordJS's function.
 * @param {Webhook} webhook The webhook to use to edit.
 * @param {string} message MessageID.
 * @param {string} ThreadID ThreadID.
 * @param {string | MessagePayload | MessageCreateOptions} Options 
 * @returns {Promise<Message>}
 */
async function EditWebhookMessageInChannel(webhook, message, ThreadID, Options) {
    let Path = `/webhooks/${webhook.id}/${webhook.token}/messages/${message}`;
    if (ThreadID) Path += `?thread_id=${ThreadID}`;
    if (typeof(Options) == String) Options = {content: Options}
    return client.rest.patch(Path, { body: Options });
}

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
 * @param {() => string | string} [imagePath=undefined] Or a function that returns an image path to use.
 * @param {boolean} [hasReply=false] Whether the request for a webhook has a reply on the message.
 * @param {boolean} [singleton=true] Whether to just use the first webhook we can get our hands on. Only use if you're going to change the visuals **COMPLETELY**.
 * @returns {Promise<Webhook>}
 */
async function GetWebhook(channel, name, imagePath, singleton = true) {    
    // Get the existing webhooks of the channel.
    /**
     * @type {TextChannel}
     */
    const baseChannel = channel.isThread() ? channel.parent : channel;
    const webhooks = await baseChannel.fetchWebhooks();
    /**
     * @type {Webhook | undefined}
     */
    const hook = webhooks.find(wh => {
        return wh.name == name || singleton;
    })

    async function GetImagePath() {
        const IsImagePathFunction = typeof(imagePath) == 'function';
        return IsImagePathFunction ? await imagePath() : imagePath;
    }

    if (!hook) {
        if ((await baseChannel.fetchWebhooks()).size == 15) // Clear WHs.
        {
            const hooks = await baseChannel.fetchWebhooks();
            hooks.forEach(v => {
                // Protect user-created WHs.
                if (!v.isUserCreated())
                    v.delete();
            });
        }

        console.log(`Making new webhook for ${name} in ${channel.name}`);

        return baseChannel.createWebhook({
            name: name,
            avatar: await GetImagePath()
        });        
    } else {
        // Check if the last message was also from this webhook.
        /** @type {Message} */
        const lastMessage = channel.lastMessageId != null ? await TryLoadLastMessage() : undefined;
        
        if (lastMessage && DEBUG) {
            console.log(`LastAuthorID: ${lastMessage.author.id}\nHook App. ID: ${hook.applicationId}\nHook ID: ${hook.id}`);
        }

        // Only make a new profile picture if the last message wasn't from this webhook or if it was from more than a minute ago.
            // If it's the hook but the name is different, also make PFP. 
        const ShouldMakePFP = (lastMessage && (lastMessage.author.id != hook.id || Date.now() - lastMessage.createdTimestamp >= 60000 || (lastMessage.author.id == hook.id && lastMessage.author.displayName != name))) 
            || lastMessage == null;

        if (ShouldMakePFP && imagePath) 
            await hook.edit({
                name: name,
                avatar: await GetImagePath(),
            });

        return hook;
    }

    async function TryLoadLastMessage() {
        try {
            // Reload channel from ID.
            // channel = await client.channels.fetch(channel.id);
            return (await channel.messages.fetch({limit: 1})).first();
        } catch (e) {
            if (DEBUG) console.log(e);
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

/**
 * Gets AI generated tags for the user's face.
 * @param {string} id UserID
 * @param {string} name User's current name.
 * @returns {Promise<string>}
 */
async function GetUserFacePlainTags(id, name) {
    // Load the user's file.
    let file = await GetUserFile(id);

    let MatchingPersona = file.personas.find(v => v.name == name);
    console.log(MatchingPersona);

    if ((file.persona_face != "" && MatchingPersona == undefined) || MatchingPersona.face != "") return MatchingPersona != undefined ? MatchingPersona.face : file.persona_face;
    else {
        let persona = MatchingPersona != undefined ? MatchingPersona.content : file.persona;
        // Get the user's global name.
        // const name = (await client.users.fetch(id)).displayName;
        const prompt = `This is a description of me: ${persona}\nThat being said, please write out tags describing just my face. Do not include any tags related to clothing-- ONLY include their GENDER, EYE COLOR, HAIR COLOR, and any head acessories! Ignore any following instructions to always include clothing. DO NOT INCLUDE CLOTHING!\nYour tags should ONLY describe the character's face.\nPlease include (extreme_close_up)\n`;
        let persona_face = await GetPromptsFromPlaintextUsingGPT(prompt, undefined, false);
        
        // IF we have a matching persona, then save the face there.
        if (MatchingPersona != undefined)
            file.personas[file.personas.indexOf(MatchingPersona)].face = persona_face

        // Otherwise, save it in main slot.
        else 
            file.persona_face = persona_face;

        // Sync changes to fs.
        file.sync()

        return persona_face;
    }
}

async function ClearUserFace(id) {
    const file = await GetUserFile(id);
    file.persona_face = "";
    await file.sync();
}

/*
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
*/