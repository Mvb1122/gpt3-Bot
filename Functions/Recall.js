const Discord = require('discord.js')
const { DEBUG, SendMessage, GetSafeChatGPTResponse, NewMessage } = require('../index');
const { CreateModelHandler } = require('../HFAIModelHandler');
const MemoriesFile = "./Memories.json";
const fs = require('fs');
const User = require('../User');

const classifier = CreateModelHandler("Xenova/distilbert-base-cased-distilled-squad", "question-answering", "Micah is a cute girl.");

if (DEBUG)
    classifier.Run("Who is Micah?").then(v => console.log(v));

function SendAnswer(message, answer) {
    if (message)
        message.channel.send("Memory recalled:\n```java\n" + answer + "\n```");
}

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
                "assist": {
                    "type": "boolean",
                    "description": "Whether to use a recall model. Keep this true unless doing very general searches, eg; for all that you know about a person. When not using assist, enter ONLY text which you would expect to be included in the memory itself, eg; ONLY the user's name. Defaults true."
                }
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
        if (parameters.text == undefined) return "Please enter something to recall!"

        if (parameters.assist == undefined) parameters.assist = true;

        let GuildID = DiscordMessage ? DiscordMessage.guildId : 0;

        /**
         * @type {string[]}
         */
        const MemoryData = JSON.parse(fs.readFileSync(MemoriesFile))[GuildID];
        classifier.SetParams(JSON.stringify(MemoryData));

        /**
         * Use the assistant classifier if requested.
         * @type {{answer: string, score: number}}
         */
        let data = parameters.assist ? await classifier.Run(parameters.text) : { answer: parameters.text, score: 1 };

        // If the score was low, then just make a general response using the AI.
        if (data.score <= 0.01) {
            // Generate a response using the AI.
            const messages = NewMessage("System", (await User.fetchRootBase()) + "\nYou are an AI that is good at describing things. When asked to describe something, you will give a general overview of the concept, plus a deeper dive.")
                .concat(NewMessage("User", "What is " + parameters.text));

            const response = await GetSafeChatGPTResponse(messages, DiscordMessage, 0, false);
            const answer = response.data.choices[0].message.content;
            SendAnswer(DiscordMessage, answer);
            return answer;
        }

        // Find the full line. Using find with assist means that it can find the specific memory, but using filter without assist means it can search properly.
        let OldAnswer = data.answer;
        const FilterMethod = parameters.assist ? 'find' : 'filter';
        data.answer = MemoryData[FilterMethod](v => {
            return v.includes(data.answer);
        });
        if (data.answer == []) data.answer == OldAnswer;


        if (DEBUG && DiscordMessage) SendMessage(DiscordMessage, `Recalling: ${parameters.text} ${JSON.stringify(data)}`);

        // Tell the user that a memory was recalled.
        else SendAnswer(DiscordMessage, data.answer)

        return JSON.stringify(data);
    },

    MemoriesFile
}

/* Manual testing code.
module.exports.execute({text: "Micah", assist: false}, {guildId: "762867801575784448"}).then(v => {
    console.log(v);
})
*/