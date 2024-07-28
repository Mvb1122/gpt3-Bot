const Discord = require('discord.js')
const { DEBUG, SendMessage } = require('../index');
const { CreateModelHandler } = require('../HFAIModelHandler');
const MemoriesFile = "./Memories.json";
const fs = require('fs');

const classifier = CreateModelHandler("Xenova/distilbert-base-cased-distilled-squad", "question-answering", "Micah is a cute girl.");

if (DEBUG)
    classifier.Run("Who is Micah?").then(v => console.log(v));

module.exports = {
    keywords: "",
    json:
    {
        "name": "recall",
        "description": "Remembers facts from past conversations. Use this function to remember things when people refer back to past conversations. Ask questions to it to get answers back. If you don't know something, recall it! Feel free to use this at any time!",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The question to answer."
                },
            }
        },
        "required": ["text"]
    },

    /**
     * Code run when the module is executed.
     * @param {{}} parameters Parameters from AI.
     * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
     */
    async execute(parameters, DiscordMessage = null) {
        let GuildID = DiscordMessage ? DiscordMessage.guildId : 0;
        const Data = JSON.parse(fs.readFileSync(MemoriesFile))[GuildID];
        classifier.SetParams(JSON.stringify(Data));
        const x = classifier.Run(parameters.text);
        if (DEBUG && DiscordMessage) SendMessage(DiscordMessage, `Recalling: ${parameters.text} ${JSON.stringify(await x)}`);
        return JSON.stringify(await x);
    },

    MemoriesFile
}