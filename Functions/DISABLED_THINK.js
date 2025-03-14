const Discord = require('discord.js')
const { DEBUG } = require('../index');

module.exports = {
  keywords: "",
  json:
  {
    "name": "think",
    "description": "Keeps text content private from the user. Use this to remember things without telling them! Do not tell the user what you have thought if they don't ask. Feel free to use this function whenever it seems useful! WHAT YOU WRITE WILL NOT BE SHOWN TO THE USER! YOU MUST TELL THEM WHAT THEY WANT TO BE TOLD. YOU MUST ACTUALLY CALL THIS FUNCTION INSTEAD OF JUST ENDING YOUR ANSWER.",
    "parameters": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "The specified message to send."
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
    // Secretly show this to the user.
    DiscordMessage.channel.send(`AI Thought: ||${parameters.text}||`);
    
    return parameters.text;
  }
}
