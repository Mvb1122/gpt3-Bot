const Discord = require('discord.js')
const { Download } = require('../Gradio/Helpers.js');
const fs = require('fs');
const { convert: GetHTMLText } = require('html-to-text');
const { encode } = require("gpt-3-encoder");

module.exports = {
    keywords: "http",
    json: 
    {
      "name": "ReadPage",
      "description": "Gets the text of a webpage.",
      //  When text is on one line, followed by a link in brackets, the text on the line is the text of the link. Ex:\nHello [example.com]\n The above is a link to example.com
      "parameters": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string",
            "description": "The URL of the page.",
          }
        },
        "required": ["url"],
      }
    },

    /**
     * Code run when the module is executed.
     * @param {{ url: String }} parameters Parameters from AI.
     * @param {Discord.Message} DiscordMessage 
     */
    async execute(parameters, DiscordMessage) {
        // return JSON.stringify({ sucessful: false, reason: "No URL." });
        if (parameters.url != undefined) {
          const path = `./temp/${Math.floor(Math.random() * 10000)}.html`;

          if (DiscordMessage != null)
            DiscordMessage.channel.send(`Fetching <${parameters.url}>!`)

          // Download page.
          await Download(parameters.url, path);
          const page = fs.readFileSync(path).toString();

          // Parse to just text.
          let text = GetHTMLText(page);

          // If there's more than 500 tokens, crop it off past that. 
          const StartLength = encode(text).length;
          console.log(`File Length: ${StartLength}`)

          if (DiscordMessage != null) {
            let Cost = (StartLength * 0.000003);
            Cost = Cost.toFixed(2);
            DiscordMessage.channel.send("Just if you were curious... I had to pay $" + Cost + " to get the AI to read this page...")
          }
          /*
          if (StartLength > 500)  {
            do {
              // Chop off ten characters at once.
              text = text.substring(0, text.length - 100)
              console.log(encode(text).length);
            } while (encode(text).length > 500)
          }
          */

          // Delete the file.
          fs.unlink(path, (e) => {
            console.log(e);
          })

          // Send it back.
          if (StartLength < 10000) {
            return JSON.stringify({sucessful: true, text: text});
          } else {
            DiscordMessage.channel.send("That page is too long! The AI would crash with that much text!")
            return JSON.stringify({ sucessful: false, reason: "Page is too long." })
          }
        } else {
          return JSON.stringify({ sucessful: false, reason: "No URL." })
        }
    }
}

//#region Test code
/*
module.exports.execute({url: "https://drexel.edu/cci/stories/advantages-and-disadvantages-of-cad/?authuser=0"})
  .then((val) => {
    console.log(val);
  })
*/