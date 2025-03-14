const SystemMessageString = `(SYSTEM) Returned data from function: %s\nPlease use this information to answer the user's last question. An empty response is not appropriate. The user cannot see this message, so you must relay this information to them. Do not add a name in parenthesis to your messages. I AM NOT THE USER, DO NOT THANK ME.`
const FunctionFinderRegex = new RegExp(/(<[a-z=]*>)?\{\s*\"name\"\s*:\s*\"[^\"]*\"\s*,\s*\"((parameters)|(arguments))\"\s*:\s*\"*\{[^}]*\}\"*\s*\}(<\/[a-z=]*>)?/g);
const TextInGLTSymbolsRegex = new RegExp(/<\/*[a-z=]*>/g);

const { DEBUG, LocalServerSettings, NewMessage, AIParameters } = require('./index.js');
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: LocalServerSettings.Use ? LocalServerSettings.ApiKey : tokens.GetToken("openai"),
    basePath: LocalServerSettings.Use ? LocalServerSettings.basePath : undefined
});
const openai = new OpenAIApi(configuration);

const ThinkingMarkers = {
    start: "<think>",
    stop: "</think>"
}

function IsObject(ob) {
    return typeof ob == 'object'
}

async function DownloadToBase64String(url) {
    // Open it in b64.
    let data = await fetch(url)
    const blob = await data.arrayBuffer();
    const output = `data:${data.headers.get("content-type")};base64,${Buffer.from(blob).toString("base64")}`;
    return output;
}

const CaptionCache = {};

/**
 * Module for handling Llama/No automatic function Support AI models.
 */
module.exports = {
    /**
     * Converts a message *to* Llama format.
     * @param {{role: string, content: string | {type: string, image_url: {url: string, detail: "low" | "high"} | undefined, text: string | undefined}[], name: string, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}} m Input singular message.
     * @returns {Promise<{role: string, content: string | {type: string, text: string}[], name: string, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}>}
     */
    async MessageToLlama(m) {
        // If the model supports function calls and images, don't do anything. 
        if (LocalServerSettings.ImageBehavior.state == 'mainsupported' &&  LocalServerSettings.FunctionCalls == 'mainsupported') return m;

        // If we're using a llava model in mainsupport mode, replace system with user.
        if (LocalServerSettings.ImageBehavior.state == "mainsupported" && m.role.toLowerCase() == "system") m.role = "user"

        if (m.role == "tool") {
            // v.role = "ipython"
            m.role = "user"
            m.content = SystemMessageString.replace("%s", typeof(m.content) != 'string' ? JSON.stringify(m.content) : m.content);
        }
        else if (m.tool_calls != undefined) m.tool_calls.forEach((f, i) => {
            if (m.content == undefined) m.content = "";
            if (f.function.id)
                delete f.function.id;
            m.content += `\n<function=${f.function.name}>${JSON.stringify(f.function)}</function>`
        });

        else if (m.role == "user" && typeof(m.content) == 'object') {
            // This is a image request; caption images.
            m.content = m.content.map(v => {
                return new Promise(async p => {

                    console.log(LocalServerSettings.ImageBehavior.state)
                    if (v.type == "image_url") {
                        if (DEBUG) console.log(v.image_url.url);
                        
                        // Download it if we can support images. Otherwise, caption it.
                        const path = v.image_url.url;
                        if (LocalServerSettings.ImageBehavior.state == "inbuilt") {
                            const VoiceV2 = require('./VoiceV2.js');
                            const caption = CaptionCache[path] ?? await VoiceV2.Caption(path, "<MORE_DETAILED_CAPTION>");
                            CaptionCache[path] = caption;
                            
                            p({
                                type: "text",
                                text: caption
                            });
                        } else if (LocalServerSettings.ImageBehavior.state == "mainsupported") {
                            // In this case, the cache will be used to hold the base 64 data.
                            const caption = CaptionCache[path] ?? await DownloadToBase64String(path);
                            CaptionCache[path] = caption;
                            
                            // Set the data to be a data url.                           
                            v.image_url.url = caption;

                            p(v)
                        } else if (LocalServerSettings.ImageBehavior.state == "separate") {
                            // Caption it with the second LLM. 
                            const captionSeq = NewMessage("user", "You are an image captioning AI. You will caption images with the most detail you can. You will respond with ONLY the caption. You may provide additional background information if it seems useful.")
                                .concat([{
                                    role: "user",
                                    content: [
                                        {
                                            type: "text",
                                            text: "Please caption this image for me."
                                        },
                                        {
                                            type: "image_url",
                                            image_url: {
                                                url: await DownloadToBase64String(path)
                                            }
                                        }
                                    ]
                                }]);

                            // Ask AI.
                            const visionParams = JSON.parse(JSON.stringify(AIParameters));
                            visionParams.model = LocalServerSettings.ImageBehavior.separateModel;
                            visionParams.messages = captionSeq;
                            const resp = (await openai.createChatCompletion(visionParams)).data.choices[0].message.content;
                            p({
                                type: "text",
                                text: resp
                            });
                        }
                    }
                    p(v);
                })
            })
            m.content = await Promise.all(m.content);

            // Put it all down into just one text message.
            if (!LocalServerSettings.ImageBehavior.state == "inbuilt")
                m.content = m.content.map(v => v.text).join('\n');
        } else if (m.role == "user") m.content = m.content.trim();

        // Tool calls will stay there, we just put the text in so that the AI understands what it did.
            // Under Ollama AI without built-in function support, we have to delete them.
        if (LocalServerSettings.FunctionCalls == "teach")
            delete m.tool_calls;

        // If we have reasoning content, then put it back in. 
        if ('reasoning_content' in m) {
            m.content = ThinkingMarkers.start + "\n" + m.reasoning_content + "\n"+ ThinkingMarkers.stop + "\n" + m.content
            delete m.reasoning_content;
        }

        return m;
    },

    ThinkingMarkers,

    /**
     * Converts a message *from* Llama format.
     * @param {{role: string, tool_call_id?: string, content: string , name: string, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}} m Input singular message.
     * @returns {{role: string, content: string | {type: string, image_url: string | undefined, text: string | undefined}[], name: string, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}}
     */
    MessageFromLlama(m) {
        m.role = m.role.toLowerCase();
        m = module.exports.StripR1Thinking(m);

        // If the model supports function calls and images, don't do anything. 
        if (LocalServerSettings.ImageBehavior.state == 'mainsupported' &&  LocalServerSettings.FunctionCalls == 'mainsupported') return m;

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

                    try {
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
                    } catch {
                        // Unfortunately, sometimes the AI *WILL* generate bad json. Just do nothing in that case.
                    }
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
    },

    /**
     * @param {{role: string, content: string | {type: string, image_url: {url: string, detail: "low" | "high"} | undefined, text: string | undefined}[], name: string, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}} msg 
     * @returns {{role: string, content: string | {type: string, image_url: {url: string, detail: "low" | "high"} | undefined, text: string | undefined}[], name: string, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[], reasoning_content : string}}
     */
    StripR1Thinking(msg) {
        if (LocalServerSettings.cosmetic == 'r1') {
            // Look at content.
            let start = msg.content.indexOf(ThinkingMarkers.start) + ThinkingMarkers.start.length;
            let end = msg.content.lastIndexOf(ThinkingMarkers.stop);
            if (start >= 0 && end > 0) {
                msg.reasoning_content = msg.content.substring(start, end).trim();

                // Exclude the thinking markers from the content.
                msg.content = msg.content.substring(0, start - ThinkingMarkers.start.length) + msg.content.substring(end + ThinkingMarkers.stop.length);
                msg.content = msg.content.trim();
            }
        }
        
        console.log(msg);
        
        return msg;
    },

    DownloadToBase64String
}

if (false) {
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