const Discord = require('discord.js')

module.exports = {
    keywords: "blow up, explode, detonate, nuke",
    json: 
    {
      "name": "DetonateNuclearBomb",
      "description": "Detonates the preset nuclear bomb. No calls are required before this one, as everything's been prepared already.",
      "parameters": {
        "type": "object",
        "properties": {
          "town": {
            "type": "string",
            "description": "The town to detonate. If left blank, it will automatically use the last target."
          }
        },
        "required": [],
      }
    },

    /**
     * Code run when the module is executed.
     * @param {{}} parameters Parameters from AI.
     * @param {Discord.Message} DiscordMessage 
     */
    async execute(parameters, DiscordMessage) {
      // Send the silly funny.
      let prepend = "";
      if (parameters.town) {
        prepend = parameters.town + "で"
      }

      if (DiscordMessage) {
        DiscordMessage.channel.send(prepend + "エクスプロージョン!!!!!!!!");
        DiscordMessage.channel.send("https://tenor.com/view/konosuba-megumim-explosion-magic-anime-gif-16686316");
      }
      
      return "Nuclear bomb sucessfully detonated."
    }
}