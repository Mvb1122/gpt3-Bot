const Discord = require('discord.js')
const SerpApi = require('google-search-results-nodejs');
const { escape } = require("querystring");
let SnippetCache = {}; // { ${query}: {result} }

module.exports = {
    keywords: "Google, search, look up",
    json: 
    {
      "name": "GoogleSnippet",
      "description": "DO NOT USE THIS UNLESS SPECIFICALLY ASKED! Fetches Google's featured snippet about the provided query. Use it to search stuff up BUT ONLY WHEN THE USER ASKS!",
      "parameters": {
        "type": "object",
        "properties": {
          "Query": {
            "type": "string",
            "description": "The specified string to search for."
          },
          "ShowUser": {
            "type": "boolean",
            "description": "If true, the user is shown the search results. If left empty, the user will not be shown the result."
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
      if (parameters.Query == undefined) return JSON.stringify({ sucessful: false, reason: "No query provided!" });
      return new Promise(res => {
        // First check if this request was cached...
        if (SnippetCache[parameters.Query] != undefined) {
          if (DEBUG) console.log(`Using cached google snippet for ${parameters.Query}`)
          res(SnippetCache[parameters.Query]);
        }
        
        const search = new SerpApi.GoogleSearch("b223b0bed74d870bfde889d09b854b8b47a20808fabea83207399e80d42bfd56");
    
        if (DiscordMessage != null) {
          let end = "";
          // if (!parameters.ShowUser) end = "\nHiding results from user!"
          SendMessage(DiscordMessage, "Searching for: " + parameters.Query + end);
          // DiscordMessage.channel.send("Searching for: " + parameters.Query);
        }
        const params = {
          engine: "google",
          q: parameters.Query,
          location: "Albuquerque, New Mexico, United States",
          google_domain: "google.com",
          gl: "us",
          hl: "en",
          safe: "active"
        };
    
        const callback = function (data) {
          let dataOut = data["answer_box"];
          if (dataOut == undefined) {
            /* Instead of looking for a wikipedia link, just take the first result. 
            // If there's no answer_box, look for a wikipedia entry in the list.
            for (let i = 0; i < data.organic_results.length; i++) {
              const Result = data.organic_results[i];
              if (Result.link.includes("wikipedia.org")) {
                dataOut = Result;
                break;
              }
            }
            if (dataOut == undefined) */ 
              dataOut = data.organic_results[0];
          }
    
          dataOut = JSON.stringify(dataOut);
          if (DiscordMessage != null && parameters.ShowUser) {
            DiscordMessage.channel.send("Response from Google: ");
            SendMessage(DiscordMessage, "```json\n" + dataOut + "```")
            // DiscordMessage.channel.send("```json\n" + dataOut + "```");
          }
          // fs.writeFile("./Search_Results.json", JSON.stringify(data), () => {})
    
          // Cache this request.
          SnippetCache[parameters.Query] = dataOut;
    
          res(dataOut);
        };
    
        // Show result as JSON
        search.json(params, callback);
      })
    }
    // GoogleSnippet({ Query: "Coffee" }, null);
}