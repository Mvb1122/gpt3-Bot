const {SendMessage, DEBUG} = require('../index')
const Discord = require('discord.js');

const IllegalCommands = ['fs', 'console.log', 'process.exit']
module.exports = {
    keywords: "EVAL, Evaluate, Calculate, Program",
    json: {
        "name": "EVAL",
        "description": "Evaluates the supplied NodeJS JavaScript code. Console.Log and process.exit() are not allowed. There are no predefined variables. Use a return statement to return a value.",
        "parameters": {
            "type": "object",
            "properties": {
                "CODE": {
                    "type": "string",
                    "description": "Javascript code to be evaluated. Your code must be the body of an async function.",
                }
            },
            "required": ["CODE"],
        }
    },

    /**
   * Code run when the module is executed.
   * @param {{CODE: string}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} message 
   */
    async execute(parameters, message) {
        let response = {
            "response": "sucessful"
        }

        for (let i = 0; i < IllegalCommands.length; i++) {
            if (parameters.CODE.includes(IllegalCommands[i])) {
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
            

            const permMessage = await message.channel.send({
                content: "Are you sure that you want to run this code?\n```js\n" + parameters.CODE + "\n```",
                components: [row]
            });

            const resp = await permMessage.awaitMessageComponent();

            if (resp.customId == "no") {
                response.response = "User declined running code!"
                await resp.reply({
                    ephemeral: true,
                    content: "Evaluation cancelled!"
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
                        console.log(`\nEvaluating: ${parameters.CODE}\n`);
        
                    let ResponseMessage;
                    if (message) 
                        ResponseMessage = SendMessage(message, "Evaluating: ```js\n" + parameters.CODE + "```")
        
                    try {
                        response.response = await eval('(function() {' + parameters.CODE + '}())');
                        console.log(response.response);
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