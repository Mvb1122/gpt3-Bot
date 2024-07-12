const Discord = require('discord.js')
const { SendMessage, DEBUG, client, RequestChatGPT, NewMessage, fetchUserBase } = require('../index');
const Path = require('path');
const token = require('../token');
const { GetUserFile } = require('../User');

let LastCall = null;
module.exports = {
    keywords: "message, dm, send",
    json:
    {
        "name": "DirectMessage",
        "description": "Privately messages a user. Don't call this multiple times with the same parameters unless SPECIFICALLY asked for.",
        "parameters": {
            "type": "object",
            "properties": {
                "user": {
                    "type": "string",
                    "description": "The User-to-message's nickname or ID. Defaults to current user if blank. Should be either a simple number or a short name."
                },
                "sublet": {
                    "type": "boolean",
                    "description": "Whether to pass the message to another AI in the user's DMs. Set this to false unless a tool or function needs to be called in the User's DMs. If it does need to be used, pass the user's message along with any relevant context into the text parameter. DO NOT pass any text which will cause the other AI to send a DM."
                },
                // NOTE: text is at the bottom because parameters are generated from top to bottom. Thus, the AI will know whether it's going to sublet or not by the time it reaches this parameter.
                "text": {
                    "type": "string",
                    "description": "The specified message to send"
                }
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
        const text = parameters.text;
        if (text == undefined) return JSON.stringify({
            sucessful: false,
            reason: "Invalid JSON passed!"
        })

        try {
            /**
             * @type {Discord.User}
             */
            let user = DiscordMessage.author ?? DiscordMessage.user;
            let outputUser = user.displayName ?? user.globalName;

            if (parameters.user) {
                // Support just an ID.
                if (IsValidNumber(parameters.user)) {
                    user = await client.users.fetch(parameters.user);
                    outputUser = user.displayName ?? user.globalName
                }
                // If we're in a guild, use displaynames.
                else if (DiscordMessage.guild) {
                    // If this isn't a number ID, check if it matches a nickname.
                    const members = await DiscordMessage.guild.members.fetch();
                    const SearchUser = parameters.user.toLowerCase().trim();
                    console.log(SearchUser);

                    const PossibleUser = members.find(member => {
                        const name = member.displayName.toLowerCase().trim();
                        const Nick = (member.nickname ?? "").toLowerCase().trim();
                        return name == SearchUser || Nick == SearchUser;
                    });

                    if (PossibleUser) {
                        user = PossibleUser;
                        outputUser = user.displayName ?? user.globalName;
                    }
                } else
                    return JSON.stringify({
                        sucessful: false,
                        reason: "Couldn't locate user to send to! Ask user to clarify!"
                    });
            }

            if (parameters.sublet) {
                // Use another AI call into their DMs.
                const message = await SendMessage({ channel: (user.dmChannel ?? await user.createDM()) }, "```java\n// Passed information: " + text + "```");
                
                // Use original user's base, not the user we're sending to's base.
                const Base = (await GetUserFile((DiscordMessage.author ?? DiscordMessage.user ?? {id: token.GetToken("devDiscordID")}).id)).base;
                
                const messages = NewMessage("System", Base)
                    .concat(NewMessage("User", text));
                    
                RequestChatGPT(messages, message).then(async (v) => {
                    SendMessage({ channel: (user.dmChannel ?? await user.createDM()) }, v[v.length - 1].content);
                });
            } else {
                SendMessage({ channel: (user.dmChannel ?? await user.createDM()) }, text);
            }

            return JSON.stringify({
                sucessful: true,
                user: outputUser,
                content: text
            });
        } catch (e) {
            if (true) console.log(e);

            return JSON.stringify({
                sucessful: false,
                reason: `Something went wrong! Content: ${text}`
            });
        }

        // return DiscordMessage == null ? "Something went horribly wrong!" : "Sent successfully!";
    }
}

function IsValidNumber(userId) {
    return !isNaN(userId);
}
