const Discord = require('discord.js')
const {SendMessage, DEBUG} = require('../index')

module.exports = {
    keywords: "Wikipedia, search, look up",
    json:
    {
      "name": "WikipediaIntro",
      "description": "DO NOT USE THIS UNLESS SPECIFICALLY ASKED! Fetches Wikipedia's introduction about the provided query. Use it to search stuff up BUT ONLY WHEN THE USER ASKS!",
      "parameters": {
        "type": "object",
        "properties": {
          "Query": {
            "type": "string",
            "description": "The specified string to search for."
          },
          "ShowUser": {
            "type": "boolean",
            "description": "If true, the user is shown the search results. If left empty, the user will not be shown the result. Don't show them unless asked!"
          }
        }
      },
      "required": ["Query"]
    },

    /**
     * Code run when the module is executed.
     * @param {{}} parameters Parameters from AI.
     * @param {Discord.Message} DiscordMessage 
     */
    async execute(parameters, DiscordMessage = null) {
        if (parameters.ShowUser == undefined) parameters.ShowUser = false;
        let message = null;
        if (DiscordMessage != null) {
          message = await SendMessage(DiscordMessage, "Searching Wikipedia for: " + parameters.Query);
        }
      
        return new Promise(res => {
          fetch("https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=" + escape(parameters.Query))
            .then(resp => resp.json())
            .then(json => {
              if (Object.keys(json.query.pages).length > 0) {
                let Data = json.query.pages;
                Data = Data[Object.keys(Data)[0]]
                if (message != null && parameters.ShowUser) {
                  const Content = `Response from Wikipedia:\n# ${Data.title}\n\`\`\`*${Data.extract}*\`\`\``;
                  if (Content.length + message.content.length > 1900)
                    SendMessage(DiscordMessage, Content);
                  else 
                    try {
                      message.edit(message.content + "\n" + Content);
                    } catch {
                      SendMessage(DiscordMessage, Content);
                    }
                }
                if (DEBUG) console.log(Data);
                res(JSON.stringify(Data));
              } else
                res(JSON.stringify({
                  sucessful: false,
                  reason: "No article found!"
                }))
            })
        })
    }
}