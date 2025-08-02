const { NewMessage, RequestChatGPT, DEBUG } = require("..");
const { GPTMessage } = require('../GPTMessage');
const { GetRandomVoice } = require("../Commands/TTSToVC");
const Discord = require('discord.js');

exports.Agent = class Agent {
    /** @type [{role: string;content: string;}] */
    messages = [];
    
    base = "";

    name = "";

    PreferredVoice = "";

    /**
     * Adds the message to this client's list. Does not add it if it's from itself.
     * @param {{role: string;content: string;}} message The message to add.
     * @param {string} SourceName The name of the source where the message came from.
     * @returns {Number} The number of messages.
     */
    AddMessage(message, SourceName) {
        if (DEBUG) {
            console.log(this.messages);
            console.log(message);
            console.log(SourceName);
        }

        if (SourceName != this.name)
            // Make a new message to avoid transferring any reasoning content.
            return this.messages.push(NewMessage(message.role, `(${SourceName}) ${message.content}`)[0]);
        else return this.messages.length;
    }

    /**
     * Responds to the conversation as it's currently positioned.
     * @param {Discord.Message | Discord.CommandInteraction} RelativeMessage Message to respond to in the channel of.
     * @returns {Promise<{role: string; content: string; name: string;}>}
     */
    Respond(RelativeMessage) {
        return new Promise(async resolve => {
            const v = await RequestChatGPT(this.messages, RelativeMessage)

            console.log(this.messages);

            resolve(v[v.length - 1]);
        })
    }

    /**
     * Resets the agent's brain to default with the given basic text.
     * @param {string} content 
     */
    Initialize(content) {
        this.messages = NewMessage("System", `${content}\n${this.base}`);
    }

    constructor(name, base, PreferredVoice) {
        this.name = name;
        this.base = base + `\nYour name is ${name}!`;
        this.PreferredVoice = PreferredVoice ?? GetRandomVoice();
    }
}