const {SendMessage, DEBUG} = require('../index')

const IllegalCommands = ['fs', 'console.log', 'process.exit(']
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

        try {
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
        return response.response.toString();
    }
}