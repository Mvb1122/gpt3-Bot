const fp = require('fs/promises');
const Discord = require('discord.js');
const path = require('path');
const FetchSources = require('./Marp/FetchSources');

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

        // Wrap in a promise so that file send can be handled asynchronously without blocking the AI.
        return new Promise(async res => {
            const sources = FetchSources(parameters.topic);
            const sourceText = (await sources).map((v, i) => `## ${i}: ${v.title}:\n${v.text}`).join("\n");

            if (DiscordMessage) DiscordMessage.channel.send("## Sources read:\n" + (await sources).map(v => `- [${v.title}](${v.link})`).join("\n"));

            res(sourceText);
        });
    }
}