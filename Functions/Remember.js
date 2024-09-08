const fp = require('fs/promises');
const fs = require('fs');
const { MemoriesFile } = require('./Recall');
const Discord = require('discord.js');

module.exports = {
  keywords: "",
  json:
  {
    "name": "remember",
    "description": "Saves a fact for acessing in the future. Feel free to use this at any time! Everytime you learn something new, make sure to remember it! If information is factual rather than personal, use other functions.",
    "parameters": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "The fact to remember. Refer to the user by their name, rather than by \"user\". Write something like \"Micah wears thigh high socks\" instead of \"User 'Micah' wears thigh high socks.\""
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
    let text = {
        0: []
    }
    
    if (fs.existsSync(MemoriesFile))
        text = JSON.parse((await fp.readFile(MemoriesFile)).toString());

    const GuildID = DiscordMessage ? DiscordMessage.guildId : 0;
    if (text[GuildID] == undefined) text[GuildID] = [];
    if (text[GuildID].indexOf(parameters.text) == -1) {
      text[GuildID].push(parameters.text);
  
      fp.writeFile(MemoriesFile, JSON.stringify(text));
  
      // Tell the user that a memory was added.
      if (DiscordMessage)
        DiscordMessage.channel.send("```java\n// Memory added:\n" + parameters.text + "\n```")
      return `Memory saved! Content: ${parameters.text}`;
    } else return "You already know that!"
  }
}