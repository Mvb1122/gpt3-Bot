//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message } = require('discord.js');
const fs = require('fs')

const pos = ["It is certain", "It is decidedly so", "Without a doubt", "Yes definitely", "You may rely on it", "As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes"];
const nc = ["Reply hazy, try again", "Ask again later", "Better not tell you now", "Cannot predict now", "Concentrate and ask again"];
const neg = ["Don’t count on it", "My reply is no", "My sources say no", "Outlook not so good", "Very doubtful"];
const all = [pos, nc, neg];

let pipe, BallBuffer;
// Loads the AI in advance to decrease time-to-response for user.
async function Preload() {
    // Allocate a pipeline for sentiment-analysis
    const { pipeline } = await import("@xenova/transformers");
    pipe = await pipeline('sentiment-analysis', "Xenova/distilbert-base-uncased-finetuned-sst-2-english");

    // Preloading the ball image makes the image generation take about 1ms as opposed to like 15ms.
    fs.readFile("./8ball.png", (e, d) => {
        BallBuffer = d;
    })
}
Preload();

// Use sharp to make an image.
const sharp = require('sharp')
/**
 * @param {String} Text Input text to go on the ball.
 * @param {String} path Path to save to.
 * @returns {Promise<String>} Promise that resolves to the path when image is saved.
 */
async function MakeImage(Text, path) {    
    // Break text into tspans:
    const lines = Text.split(" ");
    Text = ""
    for (let i = 0; i < lines.length; i++) {
        Text += `<tspan x="0" dy="1.2em" dx="50%">${lines[i]}</tspan>`;
    }
    
    // Use canvas to make the 8ball image.
    const img = sharp(BallBuffer);

    // Create text svg.
    const svg = `
    <svg width="500" height="500">
        <style>
        .title { 
            fill: #5BCEFA; 
            font-size: 80px; 
            font-weight: bold; 
            font-family: "sans serif";
            white-space: break-spaces;
        }
        </style>
        <text y="0" text-anchor="middle" class="title">${Text}</text>
    </svg>`
    const SVGBuffer = Buffer.from(svg)

    img.composite([{ 
        input: SVGBuffer,
    }]);

    return new Promise((res, rej) => {
        img.toFile(path, (e) => {
            if (e) {
                console.log(e);
                rej(e);
            } else res(path);
        })
    })
}

/**
 * Gets the emotion associated with a chunk of text. 
 * Label is either "POSITIVE" or "NEGATIVE"
 * @param {String} q Question To Judge
 * @returns {Promise<[{ "label": "POSITIVE" | "NEGATIVE"; "score": number; }]>}
 */
async function GetBias(q) {
    return pipe(q);
}

module.exports = {
	data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Use AI to predict the future... in the form of an 8Ball!')
        .addStringOption(option => {
            return option.setName("question")
                .setDescription("The question.")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();
        let UserQuestion = interaction.options.getString("question") ?? null;

        let answer = "", QuestionStarter = "";
        if (UserQuestion != null) {
            // Load AI from transformers.js
            const bias = await GetBias(UserQuestion);

            QuestionStarter = `<@${interaction.user.id}> asks: ${UserQuestion}\n`;
            
            // Predict reverse to the sentiment.
                // Use NC if confidence < 75%.
            if (bias[0].score < 0.75) {
                const sentiment = all[1];
                answer = sentiment[Math.floor(Math.random() * sentiment.length)];
            } else if (bias[0].label == "POSITIVE") {
                const sentiment = all[0];
                answer = sentiment[Math.floor(Math.random() * sentiment.length)];
            } else {
                // If negative, use negative.
                const sentiment = all[2];
                answer = sentiment[Math.floor(Math.random() * sentiment.length)];
            }
        } else {
            // Pure random prediction. 
            const sentiment = all[Math.floor(Math.random() * all.length)]
            answer = sentiment[Math.floor(Math.random() * sentiment.length)];
        }

        // Get image.
        const path = `./Temp/${interaction.user.id}_ball.png`;
        MakeImage(answer, path).then(() => {
            // Save to temp folder and then send it off.
            interaction.editReply({content: `${QuestionStarter}My prediction is... **${answer}**!`, files: [path]}).then(() => {
                // Delete it.
                fs.unlink(path, (err) => {if (err) console.log(err)});
            })
        })
    },

    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        // Block all old 8ball requests.
        if (message.content.startsWith("--8ball") && !message.author.bot) {
            // Forward 8ball requests by spoofing interaction things.
            message.deferReply = () => { ; } // Empty function. 
            message.editReply = message.reply;
            message.user = message.author;
            message.options = {};
            message.options.getString = (s) => { message.content.substring(7) }

            this.execute(message);
        } 
        
        // Block Yggdrasil's responses.
        else if (message.content.startsWith("🎱") && message.author.username == "Yggdrasil")
        {
            message.delete();
        }
    }
};