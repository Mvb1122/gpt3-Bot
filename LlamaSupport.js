const SystemMessageString = `(SYSTEM) Returned data from function: %s\nPlease use this information to answer the user's last question. An empty response is not appropriate. The user cannot see this message, so you must relay this information to them. Do not add a name in parenthesis to your messages. I AM NOT THE USER, DO NOT THANK ME.`
const JSFinderRegex = new RegExp(/\{\s*\"name\"\s*:\s*\"[^\"]*\"\s*,\s*\"((parameters)|(arguments))\"\s*:\s*\"*\{[^}]*\}\"*\s*\}/g);
const { DEBUG } = require('./index.js');

const red = '\x1b[31m';
const green = '\x1b[32m';
const reset = '\x1b[0m';

function IsObject(ob) {
    return typeof ob != 'string'
}

/**
 * Module for handling Llama/No automatic function Support AI models.
 */
module.exports = {
    /**
     * Converts a message *to* Llama format.
     * @param {{role: String, content: String, name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}} m Input singular message.
     * @returns {{role: String, content: String, name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}}
     */
    MessageToLlama(m) {
        if (m.role == "tool") {
            // v.role = "ipython"
            m.role = "user"
            m.content = SystemMessageString.replace("%s", JSON.stringify(m.content))
        }
        else if (m.tool_calls != undefined) m.tool_calls.forEach((f, i) => {
            if (m.content == undefined) m.content = "";
            if (f.function.id)
                delete f.function.id;
            m.content += `\n${JSON.stringify(f.function)}`
        });

        else if (m.role == "user" && typeof(m.content) == 'object') {
            // This is a image request; remove all that's not text.
            m.content = m.content.filter(v => {
                return v.type == "text"
            })
        }

        m.content = m.content.trim();

        // Tool calls will stay there, we just put the text in so that the AI understands what it did.
        // delete m.tool_calls;
        return m;
    },

    /**
     * Converts a message *from* Llama format.
     * @param {{role: String, tool_call_id?: string, content: String, name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}} m Input singular message.
     * @returns {{role: String, content: String | {}[], name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}}
     */
    MessageFromLlama(m) {
        if (DEBUG) {
            console.log("Before:")
            console.log(m);
        }

        if (m.role == "user" && m.content.startsWith(SystemMessageString.substring(0, SystemMessageString.indexOf("%s")))) {
            // This is a converted tool message. Unconvert.
            const response = m.content.substring(SystemMessageString.indexOf("%s") + 1, m.content.indexOf("\nPlease use this"));
            m.role = "tool"; m.content = response;
        } else if (m.role == "assistant") {
            // Remove all Tool call json.
            const FunctionCalls = m.content.match(JSFinderRegex);
            if (FunctionCalls) {
                const NewMessage = m.tool_calls == undefined;
                if (NewMessage) m.tool_calls = [];
                // Go through the matches and remove them.
                FunctionCalls.forEach(f => {
                    const call = JSON.parse(f);
                    // Ensure that all *new* tool calls get put into the message's tool call array.
                    if (NewMessage) m.tool_calls.push({
                        id: Math.floor(Math.random() * 1000000000),
                        type: "function",
                        function: {
                          name: call.name,
                          arguments: JSON.stringify(call.parameters) // Bit of a wasteful stringify here, but it's just what's gotta be done.
                        }
                    });

                    m.content = m.content.replace(f, "");
                });

                if (m.content == "") 
                    m.content = null
                // m.content = "(Function calls were submitted.)"
            }
        }

        if (DEBUG) {
            console.log("After:")
            console.log(m);
        }
        return m;
    }
}

if (DEBUG) {
    const TestCommand = {"name": "recall", "parameters": {"text": "what I like to wear", "assist": true}};
    const TestCall = {
        id: 1,
        type: "function",
        function: TestCommand
    }
    
    const TestFunctionCall = {
        role: "assistant",
        content: null,
        tool_calls: [TestCall]
    }
    
    const TestFunctionResponse = {
        role: "tool",
        tool_call_id: "call_12345",
        content: "{\"sucessful\":true,\"reason\":\"Image queued! The user will be able to see it soon. Do not send the image yourself, it will be sent automatically. Do not send [Image: A] or whatever. Also, make sure to be creative next time you use this function.\nPassed prompt: A cute cat with big round eyes and fluffy tail\\nNumber of images: 1\"}"
    }
    
    function Loop(Start, DoLog = false) {
        if (DoLog)
            console.log(Start);
    
        const Mid = module.exports.MessageToLlama(Start)
    
        if (DoLog)
            console.log(Mid)
    
        const End = module.exports.MessageFromLlama(Mid);
    
        if (DoLog)
            console.log(End);
        return End;
    }
    
    const test = require('node:test');
    
    test('IsObject Test', (t) => {
        if (IsObject({a: "b"}) && !IsObject("hello")) return;
        else throw new Error("IsObject")
    });
    
    test('Loop Test', (t) => {
        if (Loop(TestFunctionCall) != TestFunctionCall) throw new Error("Loop failed on Function Call!");
        if (Loop(TestFunctionResponse, true) != TestFunctionResponse) throw new Error("Loop failed on Function Response!");
    });
}