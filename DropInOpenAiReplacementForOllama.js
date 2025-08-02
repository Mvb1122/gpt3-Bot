/**
 * @type {import('openai')}
 */
const exportCopy = {}

const openAi = require('openai');
const OpenaiToOllama = require('./OpenaiToOllama');
const ollama = require('ollama');

Object.keys(openAi).forEach(v => {
    exportCopy[v] = openAi[v];
});

exportCopy.OpenAIApi = class OpenAIApi extends openAi.OpenAIApi {
    /**
     * @type {ollama.Ollama}
     */
    #instance = null;

    /**
     * 
     * @param {openAi.Configuration} config 
     */
    constructor(config) {
        super(config);

        this.#instance = new ollama.Ollama({
            host: config.basePath
        });
    }

    async createChatCompletion(req, options) {
        const converted = OpenaiToOllama.convertAll(req);
        const result = await this.#instance.chat(converted);

        const resultBackInOpenAISpec = OpenaiToOllama.from(result);
    
        return {
            data: {
                    choices: [
                        {
                            message: resultBackInOpenAISpec
                        }
                    ]
                }
        };
    }

    async listModels(options) {
        const list = await this.#instance.list();

        // Don't ask me why they did it this way... I'm just copying the api. 
        return {
            data: {
                data: 
                    list.models.map(v => {
                        return {
                            id: v.name,
                            created: v.modified_at,
                        }
                    })
            }
        }
    }
}

module.exports = exportCopy;