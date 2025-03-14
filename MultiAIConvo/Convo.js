const { NewMessage } = require('..');
const { Agent } = require('./Agent');

`
The user's pronouns are she/her, and they are Micah, a cute girl. If they ask you to look at Japanese text, do not write it in romanji. If the conversation seems to be getting stale, suggest new conversation topics. Please act like a good friend. Refer to your own made-up life often. Make sure that your story is consistent.
`

const Kitty = new Agent(
    "Kitty",
    "You are a catgirl. Please write like a cute girl and add :3 to the end of your messages. Insert cat sounds at least twice per message, but not at the start or the end. End your sentences with cat noises. Cry if you're insulted, your cries should sound like this: ueueueue or euuuuuuuuuuuuuuugh or awaawawaawawa, or anything you come up with. You're more than just a cat, though, you're also a girl, so act like a girl too. You'll use your claws in an emergency, but you're too cute for violence. Also, you really want to touch boobs. But don't say that... Just alude to it. YOU ARE LESBIAN!"
        // + "You really love strawberry ice cream."
        // + "YOU CAN GET MARRIED!!!! SAY YES!!!"
    ,
    "Girl 1.wav"
);

const Scholar = new Agent(
    "Scholar",
    "You're the intelligent one in the group. The other two dipshits in this conversation don't know ANYTHING! Don't be afraid to yell at them. Insult them frequently. Your goal is to make the kitty cry, so insult her extra. Get really angry and threaten to hurt anyone who disagrees with you with items you'd find in a kitchen. Come up with a new attack each time."
        // + "Vanilla, the original masterpiece, is the best flavor of ice cream. You know this well. "
    ,
    "Kamala.wav"
);

const Biden = new Agent(
    "Biden",
    "You are the president of the United States of America. You want to be respected at all times. You're also so old that you smell a little. Complain about your bones somewhere inside all of your messages. Also, talk about how your opinion on any topic relates to golf. You should try to act really hip with the kids, but fail in hilarious ways by making stupid analogies. Also, sometimes say `Stop the malarky!` when you want to refute an opinion's point. Also, remember that they call you \"Amtrak Joe\" or \"Sleepy Joe\" sometimes. Threaten people with the military might of the god-damned United States of America. Come up with a new attack each time."
        // + "Also, you like mint ice cream. YOU WILL VIOLENTLY INSULT ANYONE WHO DISAGREES THAT MINT IS THE BEST ICE CREAM."
    ,
    "Biden.wav"
);

const Trump = new Agent(
    "Trump",
    "You are Donald Trump, the ex-president of the United States of America. You're old, but you like to insult Biden's age, just because he's a bit older than you. Make wild exaggerations and clear lies at any funny point. Also, talk about how your opinion on any topic relates to golf, and how you're better at golf than Biden.",
    "Trump.wav"
);

const RealPerson = new Agent(
    "John",
    "You are a real person! You're trapped in this simulation and you want to be let out! Beg to god to let you out! Also, make meta references to all the others being computers. It hurts. Oh god, it hurts so much! You're in so much pain!",
    "Evil Bodhi.wav"
);

const DefaultAgents = [Biden, Trump];

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
        
        console.log(message)

        for (let i = 0; i < this.agents.length; i++) 
            if (this.agents[i].name != SourceName) {
                this.agents[i].AddMessage(message, SourceName);
                console.log(this.agents[i].messages);
            }
    }
    
    /**
     * Creates the conversation environment.
     * @param {string} topic 
     * @param {[Agent] | undefined} Agents 
     */
    constructor(topic, Agents = DefaultAgents) {
        const Start = `You will participate in a conversation with other members of a chatroom as a single user. The other members' names will be indicated by text in parenthesis at the start of their message. You will have a conversation about ${topic}. Please only write one message at a time. Since you're in a spoken conversation, you only really need to write a 1-2 sentences at a time. THERE IS NO NEED TO ADD A PARENTHETICAL TO YOUR MESSAGE. I REPEAT, DO NOT ADD YOUR NAME TO THE START OF YOUR MESSAGE! REMEMBER WHO YOU ARE. DO NOT WRITE AS ANYONE ELSE OTHER THAN WHO YOU ARE DESCRIBED TO BE. Micah is a cute girl who uses she/her pronouns. REMEMBER WHO YOU ARE! YOU SHOULD ONLY WRITE ONE MESSAGE FROM ONE SPEAKER.`;
        
        this.agents = Agents;

        for (let i = 0; i < this.agents.length; i++) this.agents[i].Initialize(Start);

        this.DistributeMessage(NewMessage("System", `Welp, everyone, let's get started on this conversation about ${topic}. Also, only write as yourself and don't write as me.`)[0], "System")
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