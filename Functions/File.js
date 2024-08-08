const fp = require('fs/promises');
const Discord = require('discord.js');
const path = require('path');

module.exports = {
  keywords: "file",
  json:
  {
    "name": "file",
    "description": "Sends text as a file to the user. DO NOT include any links. Files will be sent automatically without any future linking.",
    "parameters": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "The content of the file to send."
        },
        "type": {
          "type": "string",
          "description": "The file extension to use. Defaults to txt. Do not include a period."
        }
      }
    },
    "required": ["text"]
  },

  /**
   * Code run when the module is executed.
   * @param {{text: string, type: string}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   */
  execute(parameters, DiscordMessage = null) {
    // Wrap in a promise so that file send can be handled asynchronously without blocking the AI.
    return new Promise(async res => {
      if (DiscordMessage && DiscordMessage.SourceWeb) {
        // If this is a web message, just send the text normally.
        DiscordMessage.channel.send(parameters.text);
        res("File sent to web client sucessfully!")
      }
      else if (DiscordMessage && DiscordMessage.channel) {
        res("File sucessfully written!");
        const extension = parameters.type ?? "txt"
        const p = path.resolve(`./Temp/${Math.floor(Math.random() * 1000000)}.${extension}`);
        await fp.writeFile(p, parameters.text);
        await DiscordMessage.channel.send({
          files: [p]
        })
        fp.unlink(p);
      }
      else return res("Something went wrong!");
    })
  }
}