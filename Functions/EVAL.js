const {SendMessage, DEBUG} = require('../index')
const Discord = require('discord.js');
const e2b = require('@e2b/code-interpreter');
const token = require('../token.js')

const IllegalCommands = ['fs', 'process.exit']

module.exports = {
    keywords: "EVAL, Evaluate, Calculate, Program",
    json: {
        "name": "EVAL",
        "description": "Evaluates the supplied code. YOU MUST SPECIFY THE LANGUAGE. Console.Log and process.exit() are not allowed. There are no predefined variables. Use a return statement to return a value.",
        "parameters": {
            "type": "object",
            "properties": {
                "language": {
                    "type": "string",
                    "description": "The language to use. Must be either: Python JavaScript R Java Bash",
                },
                "code": {
                    "type": "string",
                    "description": "Javascript code to be evaluated. You may use async-await. You should return the value you need to know.",
                }
            },
            "required": ["code"],
        }
    },

    /**
   * Code run when the module is executed.
   * @param {{code: string, language: string}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} message 
   */
    async execute(parameters, message) {
        console.log(parameters);

        let response = {
            "response": "sucessful"
        }

        for (let i = 0; i < IllegalCommands.length; i++) {
            if (parameters.code.includes(IllegalCommands[i])) {
                response.response = `The AI is not allowed to use ${IllegalCommands[i]}!`;
                return response.response.toString();
            }
        }

        return new Promise(async (res) => {
            // Let's send a double check to the user, asking if they're SURE that they want to run the code.
            const acceptButton = new Discord.ButtonBuilder()
                .setEmoji('✅')
                .setCustomId("yes")
                .setLabel("Yes")
                .setStyle(Discord.ButtonStyle.Success);

            const declineButton = new Discord.ButtonBuilder()
                .setEmoji('❌')
                .setCustomId("no")
                .setLabel("No")
                .setStyle(Discord.ButtonStyle.Danger);
                
            const row = new Discord.ActionRowBuilder()
                .addComponents(acceptButton, declineButton);
                
            // Send with capability for splitting.
            const permMessage = await SendMessage(message, "Are you sure that you want to run this code?\n```js\n" + parameters.code.replaceAll("\\n", "\n") + "\n```\nCode will be ran in a container! Not connected to previous evaluations!")
            
            // Add the button.
            permMessage.edit({
                components: [row]
            });

            const resp = await permMessage.awaitMessageComponent();
            const userIsDev = resp.user.id == token.GetToken("devDiscordID");

            if (resp.customId == "no" || !userIsDev) {
                response.response = "User declined running code!"
                await resp.reply({
                    ephemeral: true,
                    content: "Evaluation cancelled!" + (!userIsDev ? " You do not have permission to run!" : "") 
                });
                permMessage.delete();
            } else
                try {
                    await resp.reply({
                        ephemeral: true,
                        content: "Running now!"
                    });
                    permMessage.delete();
                    if (DEBUG)
                        console.log(`\nEvaluating: ${parameters.code}\n`);
        
                    let ResponseMessage;
                    if (message) 
                        ResponseMessage = SendMessage(message, "Evaluating: ```js\n" + parameters.code + "```")
        
                    try {
                        // Create a sandbox and execute there.
                        const sbx = await e2b.Sandbox.create({
                            apiKey: token.GetToken("e2bKey")
                        });

                        response.response = await sbx.runCode(parameters.code, { language: parameters.language.toLowerCase() });
                        console.log(response.response);
                        
                        sbx.kill();
                    } catch (e) {
                        console.log(e);
                        response.response = JSON.stringify({
                            sucessful: false,
                            resason: e.cause
                        })
                    }

                    if (typeof response.response === 'object') response.response = JSON.stringify(response.response);
                    
                    if (message)
                        ResponseMessage.then(v => {
                            if (v.editable) v.edit(v.content + "\nResponse: " + response.response)
                        })
                    
                    response.sucessful = true;
                } catch (e) {
                    console.log(e);
                    response.response = e.toString();
                    response.sucessful = false;
                }
    
            // return JSON.stringify(response);
            return res(response.response.toString());
        })
    }
}