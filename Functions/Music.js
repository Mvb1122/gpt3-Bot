const Discord = require('discord.js')
const { DEBUG } = require('../index');

module.exports = {
  keywords: "play, music, song",
  json:
  {
    "name": "music",
    "description": "Plays a song to the user.",
    "parameters": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "The song name."
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
    if (DiscordMessage != null && parameters.text) {
      // This relies on the Catgirl Engineer Gaming bot to be in the same guild.
      if (DiscordMessage.guild.members.fetch("799118924700450836")) {
        DiscordMessage.channel.send(`mew!play ${parameters.text}`);
        return `Playback of ${parameters.text} requested! It should begin playing soon.`
      }
      else {
        const NotInThisServer = "The Catgirl Engineer Gaming bot isn't in this server! I can't play music!";
        DiscordMessage.channel.send(NotInThisServer)
        return NotInThisServer;
      }
    }

    return `Playback of ${parameters.text} could not be requested. Something went wrong.`;
  }
}
