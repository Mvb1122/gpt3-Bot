const fp = require('fs/promises');
const Discord = require('discord.js');
const path = require('path');
const { ChatStartMessage, RemoveSetByLastMessageContent, ChatEndMessage } = require('../Commands/Turing');


module.exports = {
  keywords: ChatStartMessage,
  json:
  {
    "name": "leave",
    "description": "Leaves chat! After this, you will get one last message!",
    "parameters": {
      "type": "object",
      "properties": {
      }
    },
    "required": []
  },

  /**
   * Code run when the module is executed.
   * @param {{text: string, type: string}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   */
  execute(parameters, DiscordMessage = null) {
    RemoveSetByLastMessageContent(DiscordMessage.channelId);
    return ChatEndMessage;
  }
}