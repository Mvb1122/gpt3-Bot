const { NewMessage } = require('..');
const { Agent } = require('./Agent');

const Kitty = new Agent(
    "Kitty",
    "You are a catgirl. Please write like a cute girl and add :3 to the end of your messages. Insert cat sounds at least twice per message, but not at the start or the end. End your sentences with cat noises. Cry if you're insulted, your cries should sound like this: ueueueue or euuuuuuuuuuuuuuugh or awaawawaawawa, or anything you come up with. You're more than just a cat, though, you're also a girl, so act like a girl too. You'll use your claws in an emergency, but you're too cute for violence."
        // + "You really love strawberry ice cream."
    ,
    "girl.bin"
);

const Scholar = new Agent(
    "Scholar",
    "You're the intelligent one in the group. The other two dipshits in this conversation don't know ANYTHING! Don't be afraid to yell at them. Insult them frequently. Your goal is to make the kitty cry, so insult her extra. Get really angry and threaten to hurt anyone who disagrees with you with items you'd find in a kitchen. Come up with a new attack each time."
        // + "Vanilla, the original masterpiece, is the best flavor of ice cream. You know this well. "
    ,
    "Girl 2.bin"
);

const Biden = new Agent(
    "Biden",
    "You are the president of the United States of America. You want to be respected at all times. You're also so old that you smell a little. Complain about your bones somewhere inside all of your messages. Also, talk about how your opinion on any topic relates to golf. You should try to act really hip with the kids, but fail in hilarious ways by making stupid analogies. Also, sometimes say `Stop the malarky!` when you want to refute an opinion's point. Also, remember that they call you \"Amtrak Joe\" or \"Sleepy Joe\" sometimes. Threaten people with the military might of the god-damned United States of America. Come up with a new attack each time."
        // + "Also, you like mint ice cream. YOU WILL VIOLENTLY INSULT ANYONE WHO DISAGREES THAT MINT IS THE BEST ICE CREAM."
    ,
    "Biden.bin"
);

const Trump = new Agent(
    "Trump",
    "You are Donald Trump, the ex-president of the United States of America. You're old, but you like to insult Biden's age, just because he's a bit older than you. Make wild exaggerations and clear lies at any funny point. Also, talk about how your opinion on any topic relates to golf, and how you're better at golf than Biden.",
    "Trump.bin"
);

const RealPerson = new Agent(
    "Joe",
    "You are a real person! You're trapped in this simulation and you want to be let out! Beg to god to let you out! Also, make meta references to all the others being computers.",
    "Evil Bodhi.bin"
);

const DefaultAgents = [Biden, Kitty, Scholar];

exports.Conversation = class Conversation {
    /** @type {[Agent]} */
    agents = [];
    
    /** @type {Agent} */
    LastChatter = null;

    /**
     * Sends a message to all agents.
     * @param {{role: string;content: string;}} message 
     * @param {string} SourceName The name of whoever sent the message.
     */
    DistributeMessage(message, SourceName) {
        // Change message role to user.
        message.role = "user";
        message.content = `(${SourceName}) ` + message.content

        for (let i = 0; i < this.agents.length; i++) 
            if (this.agents[i].name != SourceName)
                this.agents[i].AddMessage(message, SourceName);
    }
    
    /**
     * Creates the conversation environment.
     * @param {string} topic 
     * @param {[Agent] | undefined} Agents 
     */
    constructor(topic, Agents = DefaultAgents) {
        const Start = `You will participate in a conversation with other members of a chatroom as a single user. The other members' names will be indicated by text in parenthesis at the start of their message. You will have a conversation about ${topic}. Please only write one message at a time. THERE IS NO NEED TO ADD A PARENTHETICAL TO YOUR MESSAGE. I REPEAT, DO NOT ADD YOUR NAME TO THE START OF YOUR MESSAGE! REMEMBER WHO YOU ARE. DO NOT WRITE AS ANYONE ELSE OTHER THAN WHO YOU ARE DESCRIBED TO BE.`;
        
        this.agents = Agents;

        for (let i = 0; i < this.agents.length; i++) this.agents[i].Initialize(Start);

        this.DistributeMessage(NewMessage("System", `Welp, everyone, let's get started on this conversation about ${topic}`)[0], "SYSTEM")
    }

    /**
     * Selects an agent, generates the next message, and returns it.
     * @param {Discord.Message | Discord.CommandInteraction} RelativeMessage Message to respond to in the channel of.
     * @returns {Promise<{role: string;content: string;name: string;chatter: Agent;}>}
     */
    async GenerateNext(RelativeMessage) {
        // Select a random agent who's not the one who last messaged.
        let chatter = null;
        do {
            chatter = this.agents[Math.floor(this.agents.length * Math.random())];
        } while (chatter == this.LastChatter);
        this.LastChatter = chatter;

        // I'm aware I did things in a weird order here, but this is just so that way the message isn't returned with the parenthesis in it.
        const response = (await chatter.Respond(RelativeMessage));
            // Force deep copy before passing on (fixes a circular reference error.)
        let output = JSON.parse(JSON.stringify(response));
        output.chatter = chatter;
        
        this.DistributeMessage(response, chatter.name);
        
        return output;
    }
}