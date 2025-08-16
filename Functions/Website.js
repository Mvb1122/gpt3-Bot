const Discord = require('discord.js');
const TemporaryModel = require('../Model Configs/TemporaryModel');
const RecommendedModels = require('../Model Configs/RecommendedModels');
const { NewMessage, GetSafeChatGPTResponse } = require('..');
const rootURL = "https://micahb.dev/"; 

module.exports = {
  keywords: "website, host, create, page",
  json:
  {
    "name": "website",
    "description": "Creates a website. You will send one HTML file to the hosting service, and it will return a link for you to give to the user.",
    "parameters": {
      "type": "object",
      "properties": {
        "data": {
          "type": "string",
          "description": "The content of ONE HTML FILE. This will be hosted. You should use only publically-available or links given to you."
        },
        "title": {
          "type": "string",
          "description": "The name of the site. Make sure to type it exactly as instructed if given, otherwise create your own name."
        },
        "update": {
            "type": "boolean",
            "description": "Whether you're creating a new version of a previous site. Use the same name if so."
        }
      }
    },
    "required": ["data", "title"]
  },

  /**
   * Code run when the module is executed.
   * @param {{data: string, title: string, update: boolean}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   */
  async execute(parameters, DiscordMessage = null) {
    const originalHtml = parameters.data;

    // Send a status message.
    let message, content = message = null;
    if (DiscordMessage) {
      content = "Creating website with title " + parameters.title + "...";
      message = DiscordMessage.channel.send(content); // \nInputted html: ```html\n" + originalHtml + "```\nCleaned html: ```html\n" + parameters.data + "```
    }

    // Let's clean up the HTML quickly.
    // const temp = new TemporaryModel(RecommendedModels.fast);
    const messages = NewMessage("System", "You are an AI which is EXTREEMLY good at cleaning up and improving the visual look and feel of HTML websites. You will intake errored or ugly HTML and clean it up using refactors and design changes. You will output only the corrected HTML file. You should make the HTML look as good as possible. You may use extremely common libraries, but act carefully. YOU MUST ENSURE THAT ALL INFORMATIONAL TEXT CONTENT REMAINS ON THE FINAL VERSION OF THE PAGE. YOU WILL NOT START YOUR RESPONSE WITH A MARKDOWN CODE BLOCK.")
      .concat(NewMessage("User", parameters.data));
    const output = await GetSafeChatGPTResponse(messages, null, 0, false);
    // temp.end();
    parameters.data = output.data.choices[0].message.content;

    if (DiscordMessage) {
      content += "\nPost-process finished, uploading to server now...";
      (await message).edit(content);
    }

    // This is done synchronously so that way we can tell the AI what the link is.
    const url = rootURL + 'AI_Pages/Post_Modules/CreatePage.js';

    const data = JSON.stringify({
      data: parameters.data,
      title: parameters.title,
      update: parameters.update
    }); // Could just stringify parameters but I don't trust the AI, so we're gonna chop off anything extra.

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data,
    });

    /**
     * @type {{sucessful: boolean, reason: string | null, location: string}}
     */
    const json = await response.json();

    if (json.sucessful) {
      return "Hosting complete! Site available at " + rootURL + json.location;
    } else {
      return "Something went wrong! Here's the reason the host provided: `" + json.reason + "`";
    }
  }
}