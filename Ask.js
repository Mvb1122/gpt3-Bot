//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('./index.js');


module.exports = {
	data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Asks ChatGPT a question.')
        .addStringOption(option => {
            return option.setName("question")
                .setDescription("The question.")
                .setRequired(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        interaction.deferReply();
        // TODO: Make this work.
        await RequestChatGPT((fetchUserBase(message.author.id) + `\n${authorname}: ` + message.content.substring(5)).trim(), message).then(function (result) {
            const formattedContent = result.replace(" AI:", "\nAI:").replace(` ${authorname}:`, `\n${authorname}:`).replace(fetchUserBase(message.author.id), "");
            SendMessage(message, formattedContent)
          });
    },
};