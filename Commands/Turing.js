//#region Settings
/** How long to wait between making automatic responses, measured in ms. */
const AutoresponseMintime = 5 * 60 * 1000;
const TruringAgentsFolderName = "TuringAgents"


//Ignore ts(80001)
const { GetSafeChatGPTResponse, NewMessage, DEBUG, GetTypingInChannel, client, RequestChatGPT, LocalServerSettings } = require('..');
const { SlashCommandBuilder, CommandInteraction, Message, TextChannel, TimestampStyles } = require('discord.js');
const { GetUserFile } = require('../User');
const Gradio_Stuff = require('../Gradio/Gradio_Stuff');
const { GetPromptsFromPlaintextUsingGPT } = require('../Gradio/Helpers');
const { EmotionalJudgerModel, GetSuggestedTagsFromEmotion, GetWebhook } = require('./Say');
const path = require('path');
const fp = require('fs/promises'); const fs = require('fs');

async function GetBaseFace(UserID) {
    const User = (await GetUserFile(UserID));
    
    if (User.base_face == "") {
        // Get the AI to describe itself.
        const Messages = NewMessage("System", User.base)
            .concat(NewMessage("User", "Please describe yourself! Answer briefly and describe only your physical body. Make sure to include your gender."));

        const response = (await GetSafeChatGPTResponse(Messages)).data.choices[0].message.content;

        // Describe self.
        const prompt = `This is a description of me: ${response}\nThat being said, please write out tags describing just my face. Do not include any tags related to clothing-- ONLY include their GENDER, EYE COLOR, HAIR COLOR, and any head acessories! Ignore any following instructions to always include clothing. DO NOT INCLUDE CLOTHING!\nYour tags should ONLY describe the character's face.\nPlease include (extreme_close_up)\n`;
        let persona_face = await GetPromptsFromPlaintextUsingGPT(prompt, undefined, false);
        User.base_face = persona_face;
        User.sync();
        return persona_face;
    } else {
        // Return preexisting face.
        return User.base_face;
    }
}

async function GetBaseName(UserID) {
    const User = (await GetUserFile(UserID));
    
    if (User.base_name == "") {
        // Get the AI to describe itself.
        const Messages = NewMessage("System", User.base)
            .concat(NewMessage("User", "What's your name? Answer only with your name! Do not say anything except for your name."));

        const response = (await GetSafeChatGPTResponse(Messages)).data.choices[0].message.content;

        User.base_name = response;
        User.sync();
        return response;
    } else {
        // Return preexisting face.
        return User.base_name;
    }
}

class TuringAgent {
    /** @type {string[]} */
    WebHookIDs = [];
    /** @type {[{role: string;content: string;}]} */
    Messages = [];
    /** @type {string[]} */
    Channels = [];
    RootUserid = "";
    Face = "";
    Name = "";
    LastMessageTime = 0;
    LastMessageChannelId = "";

    /** 
     * Channels which this set is already waiting in. Should not wait to respond if the channel ID is listed here.
     * @type {string[]}
     */
    WaitingInChannels = [];

    constructor(base) {
        this.Messages = NewMessage("System", base);
    }

    /**
     * Adds a message to this set's internal history.
     * @param {[{role: string;content: string;}]} Message 
     */
    AddMessages(Message) {
        this.Messages = this.Messages.concat(Message);
    }

    /**
     * @param {Message} DiscordMessage 
     */
    async Respond(DiscordMessage) {
        this.LastMessageTime = performance.now();
        this.LastMessageChannelId = DiscordMessage.channelId
        const length = this.Messages.length;
        const val = RequestChatGPT(this.Messages, DiscordMessage, false);

        const NewMessages = (await val).slice(length);
        let firstIndex = NewMessages.findIndex(v => {return v.content != null && v.role == "assistant"});
        // this.Messages = this.Messages.concat(NewMessages);
        
        // Send our response as our webhook self.
        let response = NewMessages[NewMessages.length - 1];
        const ThreadID = DiscordMessage.channel.isThread() ? DiscordMessage.channel.id : undefined;
        const wh = await GetWebhook(DiscordMessage.channel, this.Name, () => {
            // Function for making a pfp:
            return MakePFPWithEmotion(response.content, this.Face);
        });

        this.WebHookIDs[DiscordMessage.channelId] = wh.id;

        async function SendLong(string) {
            if (string.trim() == "") return;
            else do {
                const clip = string.length > 2000 ? 2000 : string.length;
                const part = string.substring(0, clip);
                string = string.substring(clip);
                await wh.send({ content: part, threadId: ThreadID });
            } while (string.length != 0);
        }

        if (LocalServerSettings.Use)
            for (let i = firstIndex; i < NewMessages.length; i++) {
                if (NewMessages[i].content != "" && NewMessages[i].role == "assistant")
                    await SendLong(NewMessages[i].content);
            }
        else 
            await SendLong(response.content);

        // Always save after we respond.
        this.ToFile();

        // 10% chance of writing another message.
        if (Math.floor(Math.random() * 10) == 0) {
            this.AddMessages(NewMessage("User", "Continue your last message! Don't mention this message."));
            this.Respond(DiscordMessage);
        }
    }

    async ToFile() {
        if (!fs.existsSync(path.resolve(`./${TruringAgentsFolderName}/`))) await fp.mkdir(TruringAgentsFolderName);
        
        // Write to file.
        return fp.writeFile(this.#GetPath(), JSON.stringify(this));
    }

    #GetPath() {
        let fileName = `${this.RootUserid}_${this.Name}`.replace(/[/\\?%*:|"<>]/g, '-');
        return path.resolve(`./${TruringAgentsFolderName}/${fileName}.json`);
    }

    async FromFile() {
        if (!fs.existsSync(this.#GetPath())) return; 

        const data = JSON.parse(await fp.readFile(this.#GetPath()));
        
        // Don't persist if the base is different.
        if ("base" in data && data.base != this.base) return;
        else if ("base" in data)
            Object.keys(this).forEach(key => {
                if (data[key]) this[key] = data[key]
            });
        return; 
    }
}

/**
 * @type {TuringAgent[]}
 */
let TrackingSets = [];

// Check for user-independant response once per minute!
async function ResponseCheckLoop() {
    do {
        await WaitForMS(AutoresponseMintime);
        TrackingSets.forEach(async v => {
            const timeSinceLast = performance.now() - v.LastMessageTime;
            if (timeSinceLast >= AutoresponseMintime) {
                // Use the last message in the last channel to make a response.
                /**
                 * @type {TextChannel}
                */
               const channel = await client.channels.fetch(v.LastMessageChannelId);
               const typers = GetTypingInChannel(channel);

               // Only write a message if nobody's writing. 
               if (typers.length != 0) return; 

               /**
                 * Never null because this only runs after the bot has responded.
                 * @type {Message}
                 */
                const lastMessage = await channel.messages.fetch(channel.lastMessageId);
                
                // Push a message saying how long it's been since the last time someone talked to you.
                const timeSinceInMinutes = timeSinceLast / 60000;
                v.AddMessages(NewMessage("User", "It's been " + timeSinceInMinutes + " minutes since someone last talked to you! Beg for attention. Do not mention this message."));
                
                // Actually respond.
                v.Respond(lastMessage);
            }
        })
    } while (true);
}
ResponseCheckLoop();


module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('turing')
        .setDescription("Acts like a user!")
        .addSubcommandGroup(g => {
            return g.setName("mode")
                .setDescription("Action to take.")
                .addSubcommand(s => {
                    return s.setName("start")
                        .setDescription("Start turing!")
                        .addBooleanOption(o => {
                            return o.setName("allchannels")
                                .setDescription("Whether to use all channels in the server. Defaults false.")
                                .setRequired(false)
                        });
                })
                .addSubcommand(s => {
                    return s.setName("stop")
                        .setDescription("Stop turing!");
                })
                .addSubcommand(s => {
                    return s.setName("addchannel")
                        .setDescription("Adds a channel to watch!")
                        .addChannelOption(o => {
                            return o.setName("channel")
                                .setDescription("Which channel to add.")
                                .setRequired(false);
                        })
                })
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply({ephemeral: true});
        
        // Debug generate base's face.
        // return interaction.editReply(face);
        const subcommand = interaction.options.getSubcommand();
        if (subcommand == "start") {
            const face = GetBaseFace(interaction.user.id);
            const name = GetBaseName(interaction.user.id);
            
            // In debug, generate pfp.
            if (DEBUG) {    
                const text = "Hi! I'm excited to **meat** you!";
                const pfp = MakePFPWithEmotion(text, await face);
                interaction.editReply({content: `${await name}: ${face}`, files: [await pfp]});
            } else {
                interaction.editReply("Started watching! Wait for the AI's first message before talking to it.");
            }

            // const demo = interaction.options.getString("demo") ?? null; // If required then you can remove the ?? null.

            // Make tracking set.
            let set = new TuringAgent((await GetUserFile(interaction.user.id)).base);
            set.Name = await name;
            set.Face = await face;
            let channels = [];
            if (interaction.options.getBoolean("allchannels")) {
                channels = (await interaction.guild.channels.fetch()).map(v => v.id);

                if (interaction.channel.isThread()) channels.push(interaction.channelId);
            } else channels.push(interaction.channelId);

            console.log(channels);

            set.Channels = channels;
            set.RootUserid = interaction.user.id;

            // Make it reload from file.
            set.FromFile();

            TrackingSets.push(set);

            // Get the AI to send their first message.
            set.AddMessages(NewMessage("User", "You've just joined chat! Please briefly tell everyone that you've just joined."));
            set.Respond(interaction);

        } else if (subcommand == "stop") {
            // Remove the set, also have them announce that they're leaving.
            let index = -1;
            let set = TrackingSets.find((v, i) => {
                const ownedByUser = v.RootUserid == interaction.user.id;
                if (ownedByUser) index = i;
                return ownedByUser 
            });

            if (!set) {
                return interaction.editReply("You are not the owner of any of the AI's talking on this server!");
            }

            set.AddMessages(NewMessage("User", "Now you're leaving! Please briefly announce your departure to everyone here."));
            set.Respond(interaction);

            // Remove from the list. 
            TrackingSets.splice(TrackingSets.indexOf(set), 1);
            
            interaction.editReply("Stopped!");
        } else if (subcommand == "addchannel") {
            let set = TrackingSets.find((v, i) => {
                const ownedByUser = v.RootUserid == interaction.user.id;
                if (ownedByUser) index = i;
                return ownedByUser 
            });

            if (!set) {
                return interaction.editReply("You do not own any of the AI's talking right now!");
            }

            // Add the channel.
            let channel = interaction.options.getChannel("channel") ?? interaction.channel;
            set.Channels.push(channel.id);
            interaction.editReply("Channel added!");
        }
    },

    // Below here is not required; should be deleted if not needed.
    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        TrackingSets.forEach(async set => {
            if (set.Channels.indexOf(message.channelId) != -1 && set.WebHookIDs[message.channelId] != message.author.id && message.author.id != client.user.id) {
                // Create content objects.
                const name = (message.member ?? {nickname: null}).nickname ?? message.author.displayName;
                let content = [];
                const TextContent = `(${name}) ${message.content}`;
                if (message.attachments.size != 0)
                    content.push({
                        type: "text",
                        text: TextContent
                    })
                else
                    content = TextContent;

                // Add images if present.
                message.attachments.forEach(attachment => {
                    if (attachment.contentType.startsWith("image/")) {
                        // Attach the image.
                        content.push({
                            "type": "image_url",
                            "image_url": {
                                "url": attachment.url,
                                "detail": "low" // Can be set to "high" or "auto" but "low" is cheapest so
                            },
                        });
                    }
                })

                // Add to their memory.
                set.AddMessages(NewMessage("User", content));

                if (set.WaitingInChannels.indexOf(message.channelId) == -1) {
                    // Always respond, but wait a second if someone's typing.
                    set.WaitingInChannels.push(message.channelId);
                    const index = set.WaitingInChannels.indexOf(message.channelId);
                    await WaitForMS(4000);
                    if (HasTyping()) {
                        // Keep waiting until there's nobody typing
                        do {
                            await WaitForMS(1000);
                            // message.channel.send("Typing Waiting.");
                        } while (HasTyping());
                        
                        // message.channel.send("Waiting finished.")                        
                        await set.Respond(message);
                        // If there's nobody typing after a second, respond immediately. 
                    } else set.Respond(message);
                    // Now we can remove the wait token.
                    set.WaitingInChannels.splice(index, 1);
                } else return;
            }

            function HasTyping() {
                const typers = GetTypingInChannel(message.channel);
                return typers.length > 0;
            }
        });
    }
}

function WaitForMS(time = 1000) {
    return new Promise(res => {
        setTimeout(() => {
            res();
        }, time);
    });
}

async function MakePFPWithEmotion(text, face) {
    const emotion = text != null ? await EmotionalJudgerModel.Run(text) : "Neutral";
    const appendTags = GetSuggestedTagsFromEmotion(emotion);
    const pfp = Gradio_Stuff.PredictContent({
        prompt: face + ", " + appendTags,
        width: 512,
        height: 512
    });
    return pfp;
}
