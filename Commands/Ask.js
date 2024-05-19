//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Asks ChatGPT a question.')
        .addStringOption(option => {
            return option.setName("question")
                .setDescription("The question.")
                .setRequired(true)
        })
        .addAttachmentOption(option => {
            return option.setName("text")
                .setDescription("If you want the AI to read something, send it here. You must mention in your prompt to use it.")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();
        if (interaction.member == null) interaction.member = interaction.user;
        let username;
        
        try {
            username = interaction.member.nickname ?? interaction.user.globalName ?? interaction.user.username;
        } catch {
            username = "User"
        }

        let UserQuestion = interaction.options.getString("question");
        interaction.member.id
        // If the user has sent a text document, attach it to our prompt so that ReadPage can be used.
        if (interaction.options.getAttachment("text") != undefined) {
            UserQuestion += ` ${interaction.options.getAttachment("text").url}`
        }

        let messages = Index.NewMessage("system", Index.fetchUserBase(interaction.member.id))
            .concat(Index.NewMessage("user", UserQuestion))
        
        await Index.RequestChatGPT(messages, interaction)
            .then(val => {
                const Content = `${username}: ${UserQuestion}\nAI: ${val[val.length - 1].content}`;
                if (Content.length <= 2000) {
                    interaction.editReply(Content)
                } else {
                    // If the message is too long, just say, look below for your answer and then SendMessage it.
                    interaction.editReply("See message below.");
                    Index.SendMessage(interaction, Content)
                }
            })
    },
};