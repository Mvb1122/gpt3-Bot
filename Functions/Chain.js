const Discord = require('discord.js')
const {Agent} = require('../MultiAIConvo/Agent');
const { GPTMessage } = require('../GPTMessage');
const LLMJudge = require('../LLMJudge');
const { GetWebhook } = require('../Commands/Say');
const { Make8BallImage } = require('../Commands/8ball');
const { colors, SendMessage } = require('..');
const OLParseRegex = new RegExp(/(?<=\d\. ).+/g);
const ExpertParseRegex = new RegExp(/.+: .+/g);

const exampleChain = `
Question: What are some patterns among history?

YOU MUST FOLLOW THIS FORMAT:
1. Make a summary of large events in history.
2. Try to find patterns among those events.
3. Write an output report.

YOU MUST FOLLOW THE ABOVE SIMPLE FORMAT OF:
Number. Task Title

YOUR ANSWER MUST BE ON ONE LINE PER TASK.
`

const exampleExperts = `
For the first stage, we'll need to know history, so a historian will be useful. The second stage requires intelligenece, so maybe someone brainy? For the third one, we need to carefully output the information in a good format, so let's go with a writer.

Historian: Knows history extremely well and will present information accurately.
Brainy: Able to find patterns among data easily.
Writer: Writes papers in academic tone extremely well.


YOU MUST FOLLOW THE ABOVE SIMPLE FORMAT OF:
name: personality

YOUR ANSWER MUST BE ON ONE LINE PER EXPERT.
`

const oldParameters = {
    "type": "object",
    "properties": {
        "experts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "personality": {
                        "type": "string",
                        "description": "The personality that the expert has! Eg; being really good at math or science."
                    },
                    "name": {
                        "type": "string",
                        "description": "The personality's name."
                    }
                }
            }
        },
        "stages": {
            "type": "array",
            "items": {
                "type": "string",
                "description": "The stage of reasoning to follow. Eg; 1. Thinking about history. 2. Finding patterns. 3. Creating a final answer."
            }
        }
    },
    "required": ["experts", "stages"],
};

module.exports = {
    keywords: "reason,chain,work through",
    json: 
    {
      "name": "reason",
      "description": "Creates a chain of thought for talking to yourself. Call this with empty parameters.",
      "parameters": {}
    },

    /**
     * Code run when the module is executed.
     * @param {{}} parameters Parameters from AI.
     * @param {Discord.Message} DiscordMessage 
     * @param {GPTMessage[]} messages 
     */
    async execute(parameters, DiscordMessage, messages) {
        /**
         * Asks a question to an agent.
         * @param {string} question 
         * @param {Agent} agent 
         * @param {string} source Source name.
         */
        async function Ask(question, agent, source = "System") {
            const message = new GPTMessage(question);
            agent.AddMessage(message, source);
            const resp = await agent.Respond();
            agent.AddMessage(resp);

            // Let's use a webhook to send our progress. 
            SendWebhookMessage(agent.name, resp.content);

            return resp;
        }

        async function SendWebhookMessage(name, text) {
            const webhook = await GetWebhook(DiscordMessage.channel, name, async () => {
                const path = `./Temp/${DiscordMessage.id}_ball.png`;
                return await Make8BallImage(name, path);
            });

            do {
                let chunk = text.substring(0, 2000);
                text = text.substring(2000);
                await webhook.send({
                    content: chunk, 
                    threadId: thread.id
                });
            } while (text.length != 0)
        }

        /**
         * Selects an agent.
         * @param {Agent[]} agents 
         * @param {string} task 
         */
        async function SelectAgent(agents, task) {
            const agentText = agents.map((agent) => {
                return agent.name + ":" + agent.base
            }).join("\n");
            const names = agents.map(v => v.name);

            const messages = [
                new GPTMessage("The current agents are:\n" + agentText, "System"),
                new GPTMessage("Please select an agent who would be best for this task:\n" + task)                
            ];
            const response = await LLMJudge(messages, names);
            return agents.find(v => v.name == response);
        }

        // Okay, so let's get a plan going. 
            // Also send a startup message. 
        SendWebhookMessage("Base", "Starting reasoning flow!");

        // Create a thread to send the messages in. 
        /**
         * @type {Discord.GuildTextThreadManager<Discord.AllowedThreadTypeForTextChannel>}
         */
        const threadManager = DiscordMessage.channel.threads;
        const thread = await threadManager.create({
            name: "Reasoning Thread"
        });

        const baseAgent = Agent.FromMessages("Base", messages);
        const IdeaResp = await Ask(`Hi there! Let's try to make a chain of thought for that problem which the user just asked you to reason through! Please come up with a chain of thought. Here's an example:\n${exampleChain}\nPlease keep it simple! Make sure to focus on what the user initially asked for rather than the example!`, baseAgent);
        const stages = IdeaResp.content.match(OLParseRegex).map(v => {
            return v.toString();
        });
        
        const expertsResp = await Ask(`Okay, now let's try to come up with experts who would be best at doing each task. You may reason the needs of each task before writing your list. Here's an example:\n${exampleExperts}\nPlease keep it simple!`, baseAgent);
        const experts = expertsResp.content.match(ExpertParseRegex).map(v => {
            const split = v.indexOf(":");
            const name = v.substring(0, split);
            const content = v.substring(split + 1);
            return new Agent(name, content);
        });

        // Now we can finally do the actual thinking.
        let results = [];
        for (let i = 0; i < stages.length; i++) {
            let current = stages[i];

            // Select an agent. 
            const selectedAgent = await SelectAgent(experts, current);
            
            const thisResp = await Ask(current, selectedAgent);

            // Distribute the message to all agents.
            experts.forEach(v => v.AddMessage(thisResp, selectedAgent.name))

            results.push(thisResp.content);
        }

        let result = results[results.length - 1];
        result = "CoT Result:```" + result + "```";
        SendMessage(DiscordMessage, result);

        messages.push(new GPTMessage(result));
        return "The result has been published, please tell the user to look for it.";
    }
}