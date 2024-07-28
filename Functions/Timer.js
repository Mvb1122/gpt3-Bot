const Discord = require('discord.js')
const { DEBUG, RequestChatGPT, NewMessage } = require('../index');
const { GetUserFile, fetchRootBase } = require('../User');

module.exports = {
  keywords: "remind, tell me",
  json:
  {
    "name": "remind",
    "description": "Keeps text content private from the user. Use this to remember things without telling them! Do not tell the user what you have thought if they don't ask. Feel free to use this function whenever it seems useful!",
    "parameters": {
      "type": "object",
      "properties": {
        "operation": {
          "type": "string",
          "description": "What to do. This will be passed to a seperate AI, so MAKE SURE TO BE SPECIFIC! It's just a plain-text instruction."
        },
        "time": {
          "type": "number",
          "description": "How long, in minutes, to wait."
        },
        "DoInDM": {
            "type": "boolean",
            "description": "Whether to execute in the user's direct messages. Defaults false."
        }
      }
    },
    "required": ["operation", "time"]
  },

  /**
   * Code run when the module is executed.
   * @param {{}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   */
  async execute(parameters, DiscordMessage = null) {
    const DoInDM = parameters.DoInDM ?? true;

    if (parameters.operation && parameters.time) {
        if (Number.isNaN(parameters.time)) return "Invalid time passed! Please retry with a valid number."
        else {
            setTimeout(async () => {
                const CommandContent = `You are responding to a reminder from ${parameters.time} minutes ago! ${parameters.operation}`;
                const FirstMessageContent = DiscordMessage ? (await GetUserFile(DiscordMessage.user.id)).base : await fetchRootBase();
                const messages = NewMessage("System", FirstMessageContent)
                    .concat(NewMessage("User", CommandContent));


                const response = await RequestChatGPT(messages, DiscordMessage);
                if (DiscordMessage) {
                    const messageLink = `https://discord.com/channels/${DiscordMessage.guildId}/${DiscordMessage.channelId}/${DiscordMessage.id}`;
                    const content = `[Source](${messageLink})\n${response[response.length - 1].content}`;
                    // Send response.
                    if (!DoInDM) {
                        if (DiscordMessage.followUp)
                            DiscordMessage.followUp(content);
                        else DiscordMessage.reply(content)
                    } else {
                        // Send in DM.
                        await DiscordMessage.member.createDM();
                        DiscordMessage.member.send(content);
                    }

                } else {
                    // Panic!
                    console.log("Something went wrong with a timer!");
                    console.log(response);
                }
            }, Number.parseFloat(parameters.time) * 60000);

            return "Timer set sucessful!"
        }

    }
  }
}
