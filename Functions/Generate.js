const Discord = require('discord.js')
const Generate = require('../Gradio/Gradio_Stuff').PredictContentDefault
const GetTags = require("../Gradio/Helpers").GetPromptsFromPlaintextUsingGPT
const fs = require('fs')
const { client } = require('..')
const Gradio_Stuff = require('../Gradio/Gradio_Stuff')

module.exports = {
  keywords: "generate, draw, image",
  json:
  {
    "name": "draw",
    "description": "Makes an image of the provided content. Be creative and make sure to give adjectives when asking for stuff to be drawn! When you use this function, your response will be sent first, then the image.",
    "parameters": {
      "type": "object",
      "properties": {
        "content": {
          "type": "string",
          "description": "The plain-text content of the image.",
        },
        "count": {
          "type": "number",
          "description": "An integer greater-than-or equal to 1 and less than 10 which says how many images to make."
        }
      },
      "required": ["content"],
    }
  },

  /**
   * Code run when the module is executed.
   * @param {{content: String, count: Number}} parameters Parameters from AI.
   * @param {Discord.CommandInteraction} DiscordMessage 
   */
  async execute(parameters, DiscordMessage) {
    if (!Gradio_Stuff.isConnected()) return JSON.stringify({ sucessful: false, reason: "Image generation is currently offline. Please tell the user to try again later." })

    const channel = await client.channels.fetch(DiscordMessage.channelId);
    if (parameters.content == undefined) {
      channel.send("No content provided!");
      return JSON.stringify({ sucessful: false, reason: "No content provided." })
    }

    if (parameters.count == undefined) {
      parameters.count = 1;
    } else if (parameters.count > 10) parameters.count = 10;

    // Get tags.
    new Promise((resolve) => {
      GetTags(parameters.content, DiscordMessage.user != null ? DiscordMessage.user.id : undefined).then(async tags => {
        let generating = await (channel.send(`Generating ${parameters.count} image${(parameters.count > 1) ? "s" : ""}` + "... Tags: ```" + tags + "```"));

        /**
         * @type {[Promise<String>]}
         */
        let images = [];
        for (let i = 0; i < parameters.count; i++) {
          const ThisImage = Generate(tags);
          images.push(ThisImage)
        }

        Promise.all(images)
          .then(async f => {
            for (let i = 0; i < images.length; i++) {
              images[i] = await images[i];
            }

            channel.send({
              content: "Generated... Original input: ```" + parameters.content + "``` Tags: ```" + tags + "```",
              files: images
            }).then(() => {
              // Delete images after they're sent.
              for (let i = 0; i < images.length; i++) {
                fs.unlink(images[i], (e) => {if (e) console.log(e)});
              }
            })

            if (generating.deletable)
              generating.delete()

            resolve(true);
          })
      })
    })

    return JSON.stringify({ sucessful: true, reason: `Image queued! The user will be able to see it soon. Do not send the image yourself, it will be sent automatically. Do not send [Image: ${parameters.content.substring(0, parameters.content.indexOf(" "))}] or whatever. Also, make sure to be creative next time you use this function.\nPassed prompt: ${parameters.content}\nNumber of images: ${parameters.count}` });
  }
}