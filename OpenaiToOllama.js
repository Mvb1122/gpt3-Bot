const { GPTMessage } = require("./GPTMessage")

class OllamaMsg {
    /**
     * @type {"system" | "user" | "assistant" | "tool"}
     */
    role = "";
    content = "";
    
    /**
     * b64 but remove the data header.
     * @type {String[]}
     */
    images = [];

    /**
     * @type {[{function: { name: string, arguments: *}}]}
     */
    tool_calls = [];
}

class OllamaReq {
    model = "";
    /**
     * @type {OllamaMsg[]}
     */
    messages = [];

    tools = [];

    // Advanced params.
    /**
     * @type {null | "json" | {yourObjectHere: ""}}
     */
    format = "";
    
    /**
     * @default "5m"
     */
    keep_alive = "";
}

/**
 * @param {GPTMessage} m Message from.
 * @returns {OllamaMsg}
 */
function to(m) {
    let content = "", images = [];

    if (typeof(m.content) == 'string') {
        content = m.content; 
    } else if (Array.isArray(m.content)) {
        m.content.forEach(v => {
            if (v.type == "text") content += v.text;
            else {
                if (v.image_url.url.includes("base64"))
                    images.push(v.image_url.url.substring(v.image_url.url.indexOf(",") + 1));
                else 
                    images.push(v.image_url.url) // May god have mercy on my soul if I ever try to send an https url through here.
            }
        })
    }

    return {
        role: m.role,
        content: content,
        images: images,
        tool_calls: m.tool_calls != null ? m.tool_calls.map(v => {
            return {
                name: v.function.name,
                arguments: v.function.parameters
            }
        }) : null
    }
}

module.exports = {
    to,

    /**
     * @param {OllamaMsg} m 
     * @returns {GPTMessage}
     */
    from(m) {
        m = m.message ?? m;

        const output = {
            role: m.role,

            content: Array.isArray(m.images) && m.images.length != 0 ? [
                {
                    type: "text",
                    text: m.content
                },

                // Add all the images also
                ...m.images.map(url => ({
                    type: "image_url",
                    image_url: { url: url }
                }))
            ] : m.content,

            tool_calls: m.tool_calls != null ? m.tool_calls.map(v => {
                return {
                    name: v.name,
                    parameters: v.arguments
                }
            }) : null
        }
        return output;
    },

    /**
     * @param {import('openai').CreateChatCompletionRequest} m 
     * @returns {OllamaReq}
     */
    convertAll(m) {
        return {
            model: m.model,
            messages: m.messages.map(v => to(v)),
            tools: m.functions,
        }
    }
}