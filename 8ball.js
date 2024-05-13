//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');

const pos = ["It is certain", "It is decidedly so", "Without a doubt", "Yes definitely", "You may rely on it", "As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes"];
const nc = ["Reply hazy, try again", "Ask again later", "Better not tell you now", "Cannot predict now", "Concentrate and ask again"];
const neg = ["Don’t count on it", "My reply is no", "My sources say no", "Outlook not so good", "Very doubtful"];
const all = [pos, nc, neg];

let pipe;
// Loads the AI in advance to decrease time-to-response for user.
async function Preload() {
    // Allocate a pipeline for sentiment-analysis
    const { pipeline } = await import("@xenova/transformers");
    pipe = await pipeline('sentiment-analysis', "Xenova/distilbert-base-uncased-finetuned-sst-2-english");
}
Preload();

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

        return interaction.editReply(`${QuestionStarter}My prediction is... **${answer}**`);
    },
};