const fp = require('fs/promises');
const Discord = require('discord.js');
const path = require('path');
const FetchSources = require('./Marp/FetchSources');
const { NewMessage } = require('..');

module.exports = {
    keywords: "research, look up",
    json:
    {
        "name": "research",
        "description": "Does some basic research.",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "The topic to search about."
                },
            }
        },
        "required": ["topic"]
    },

    /**
     * Code run when the module is executed.
     * @param {{topic: string}} parameters Parameters from AI.
     * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
     */
    execute(parameters, DiscordMessage = null) {
        if (!parameters.topic) return "No topic for research!";

        // This is in a promise so that we can use async. We could refactor the whole function also.
        return new Promise(async res => {
            const sources = FetchSources(parameters.topic);
            
            if (DiscordMessage) DiscordMessage.channel.send("## Sources read:\n" + (await sources).map(v => `- [${v.title}](${v.link})`).join("\n"));
            
            // Old method: return as just the title and then the text.
            /*
            const sourceText = (await sources).map((v, i) => `## ${i}: ${v.title}:\n${v.text}`).join("\n");
            res(sourceText);
            */

            // New method: Each source as its own method; LLMs benefit from having context as past messages.
            res((await sources).map((v, i) => NewMessage('User', `## ${i}: ${v.title}:\n${v.text}`)[0]));
        });
    }
}