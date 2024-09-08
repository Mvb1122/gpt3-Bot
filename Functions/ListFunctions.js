const fs = require('fs');
const path = require('path');

module.exports = {
  keywords: "what functions, what tools, what can you do, functions, tools",
  json:
  {
    "name": "ListFunctions",
    "description": "Returns a list of functions and their keywords.",
    "parameters": {},
    "required": []
  },

  /**
   * Code run when the module is executed.
   * @param {{}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   */
  async execute(parameters, DiscordMessage = null) {
    const files = fs.readdirSync(__dirname)
    .filter(v => v.includes("js"))
    .map(v => {
        const f = require(path.resolve(__dirname + "/" + v));
        return {
            name: f.json.name,
            description: f.json.description,
            keywords: f.keywords,
        }
    })

    return JSON.stringify(files);
  }
}