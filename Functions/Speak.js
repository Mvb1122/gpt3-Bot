const Discord = require('discord.js')
const {SendMessage, DEBUG} = require('../index');
const { Voice, DefaultEmbedding } = require('../VoiceV2');
const Path = require('path');
const fp = require('fs/promises');

module.exports = {
    keywords: "voice, speak, read aloud",
    json:
    {
      "name": "Speak",
      "description": "Reads text aloud to the user.",
      "parameters": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "description": "The specified string to read."
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
        const text = parameters.text;
        if (text == undefined) return JSON.stringify({
            sucessful: false,
            reason: "Invalid JSON passed!"
        })
        
        /**
         * @type {Discord.Message}
         */
        let Message = undefined;
        if (DiscordMessage != null) {
          Message = await SendMessage(DiscordMessage, "Reading: ```" + text + "```");
        }
      
        new Promise(async res => {
            const path = Path.normalize(__dirname + `\\..\\Temp\\${(DiscordMessage.author ?? DiscordMessage.user).id}_tts.wav`);
            await Voice(text, path, DefaultEmbedding);
            Message.edit({
                files: [path]
            }).then(() => {
                if (!DEBUG) fp.unlink(path);
            })
        })

        return "Voicing queued! It will be read to the user shortly."
    }
}