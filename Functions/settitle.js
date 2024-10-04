const Discord = require('discord.js')
const { DEBUG } = require('../index');

module.exports = {
  keywords: "title, name, thread, topic",
  json:
  {
    "name": "settitle",
    "description": "Renames the title of the conversation.",
    "parameters": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name to set the conversation title to."
        },
      }
    },
    "required": ["name"]
  },

  /**
   * Code run when the module is executed.
   * @param {{ name: string}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   */
  async execute(parameters, DiscordMessage = null) {
    if (!parameters.name) return "You need to provide a name! Please call this function again, but CAREFULLY provide a name."

      // Only execute if DiscordMessage != null && we're in a thread.
    if (DiscordMessage && DiscordMessage.channel.isThread()) {
        // Rename the title. 
        DiscordMessage.channel.setName(parameters.name);
        return "Title set to " + parameters.name.trim() + " sucessfully!"
    } else return "This function cannot be used right now."
  }
}
