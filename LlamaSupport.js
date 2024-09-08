const SystemMessageString = `(SYSTEM) Returned data from function: %s\nPlease use this information to answer the user's last question. An empty response is not appropriate. The user cannot see this message, so you must relay this information to them. Do not add a name in parenthesis to your messages. I AM NOT THE USER, DO NOT THANK ME.`
const FunctionFinderRegex = new RegExp(/(<[a-z]*>)?\{\s*\"name\"\s*:\s*\"[^\"]*\"\s*,\s*\"((parameters)|(arguments))\"\s*:\s*\"*\{[^}]*\}\"*\s*\}(<\/[a-z]*>)?/g);
const TextInGLTSymbolsRegex = new RegExp(/<\/*[a-z]*>/g);

const { DEBUG } = require('./index.js');
const VoiceV2 = require('./VoiceV2.js');

function IsObject(ob) {
    return typeof ob == 'object'
}

const CaptionCache = {};

/**
 * Module for handling Llama/No automatic function Support AI models.
 */
module.exports = {
    /**
     * Converts a message *to* Llama format.
     * @param {{role: String, content: String | {type: string, image_url: {url: string, detail: "low" | "high"} | undefined, text: string | undefined}[], name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}} m Input singular message.
     * @returns {Promise<{role: String, content: String | {type: string, text: string}[], name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}>}
     */
    async MessageToLlama(m) {
        if (m.role == "tool") {
            // v.role = "ipython"
            m.role = "user"
            m.content = SystemMessageString.replace("%s", typeof(m.content) != 'string' ? JSON.stringify(m.content) : m.content);
        }
        else if (m.tool_calls != undefined) m.tool_calls.forEach((f, i) => {
            if (m.content == undefined) m.content = "";
            if (f.function.id)
                delete f.function.id;
            m.content += `\n<function>${JSON.stringify(f.function)}</function>`
        });

        else if (m.role == "user" && typeof(m.content) == 'object') {
            // This is a image request; caption images.
            m.content = m.content.map(v => {
                return new Promise(async p => {
                    if (v.type == "image_url") {
                        if (DEBUG) console.log(v.image_url.url);


                        // Download it.
                        /*
                        if (v.image_url.url.endsWith("&")) v.image_url.url = v.image_url.url.substring(0, v.image_url.url.length - 2);
                        const safeName = v.image_url.url.substring(v.image_url.url.lastIndexOf('/') + 1, v.image_url.url.indexOf('?'));
                        const path = await Download(v.image_url.url, Path.resolve(`./Temp/${safeName}`));
                        */
                        const path = v.image_url.url;
                        const caption = CaptionCache[path] ?? await VoiceV2.Caption(path, "<MORE_DETAILED_CAPTION>");
                        CaptionCache[path] = caption;

                        p({
                            type: "text",
                            text: caption
                        });
                    }
                    p(v);
                })
            })
            m.content = await Promise.all(m.content);

            // Put it all down into just one text message.
            m.content = m.content.map(v => v.text).join('\n');
        } else if (m.role == "user") m.content = m.content.trim();

        // Tool calls will stay there, we just put the text in so that the AI understands what it did.
        // delete m.tool_calls;
        return m;
    },

    // | {type: string, image_url: string | undefined, text: string | undefined}[]
    /**
     * Converts a message *from* Llama format.
     * @param {{role: String, tool_call_id?: string, content: String , name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}} m Input singular message.
     * @returns {{role: String, content: String | {type: string, image_url: string | undefined, text: string | undefined}[], name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}}
     */
    MessageFromLlama(m) {
        if (DEBUG) {
            console.log("Before:")
            console.log(m);
        }

        if (m.role == "user" && typeof(m.content) == 'string' && m.content.startsWith(SystemMessageString.substring(0, SystemMessageString.indexOf("%s")))) {
            // This is a converted tool message. Unconvert.
            const response = m.content.substring(SystemMessageString.indexOf("%s") + 1, m.content.indexOf("\nPlease use this"));
            m.role = "tool"; m.content = response;
        } else if (m.role == "assistant" && typeof m.content == 'string') {
            // Remove all Tool call json.
            const FunctionCalls = m.content.match(FunctionFinderRegex);
            if (FunctionCalls) {
                const NewMessage = m.tool_calls == undefined;
                if (NewMessage) m.tool_calls = [];
                // Go through the matches and remove them.
                FunctionCalls.forEach(f => {
                    let full = f;
                    // Check if it has the stuffs on the edges.
                        // If it has them, remove them.
                    let edges = f.match(TextInGLTSymbolsRegex);
                    if (edges) edges.forEach(v => { f = f.replace(v, "")});

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

                    m.content = m.content.replace(full, "");
                });

                if (m.content == "") 
                    m.content = null
                else m.content = m.content.trim();
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

    const TestFunctionCallFromLlama = {
        role: "assistant",
        content: `<function>${JSON.stringify(TestCommand)}</function>`
    };

    // console.log(JSON.stringify(module.exports.MessageFromLlama(TestFunctionCallFromLlama)));
    
    const TestFunctionResponse = {
        role: "tool",
        tool_call_id: "call_12345",
        content: "{\"sucessful\":true,\"reason\":\"Image queued! The user will be able to see it soon. Do not send the image yourself, it will be sent automatically. Do not send [Image: A] or whatever. Also, make sure to be creative next time you use this function.\nPassed prompt: A cute cat with big round eyes and fluffy tail\\nNumber of images: 1\"}"
    }
    
    async function Loop(Start, DoLog = false) {
        if (DoLog)
            console.log(Start);
    
        const Mid = await module.exports.MessageToLlama(Start)
    
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
    
    test('Loop Test', async (t) => {
        if (await Loop(TestFunctionCall) != TestFunctionCall) throw new Error("Loop failed on Function Call!");
        if (await Loop(TestFunctionResponse) != TestFunctionResponse) throw new Error("Loop failed on Function Response!");
    });

    
    /* Keep disabled as it may cause big downloads.
    const Multicontent = {
        role: "user",
        content: [
            {
                type: "text",
                text: "What's this an image of?"
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg?download=true",
                    "detail": "low" // Can be set to "high" or "auto" but "low" is cheapest so
                },
            }
        ]
    }
    
    test('Image Caption Test', async (t) => {
        await VoiceV2.Preload();
    
        console.log(await module.exports.MessageToLlama(Multicontent));
    })
    */

    /*
    async function BulkTest() {
        let message = TestFunctionResponse;
        for (let i = 0; i < 100; i++) {
            message = await Loop(message);
        }
        console.log(JSON.stringify(message));
    }
    BulkTest();
    */
}