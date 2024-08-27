//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');
const { GetUserFile } = require('../User.js');

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

        // If the user has sent a text document, attach it to our prompt so that ReadPage can be used.
        if (interaction.options.getAttachment("text") != undefined) {
            UserQuestion += ` ${interaction.options.getAttachment("text").url}`
        }

        const user = await GetUserFile(interaction.user.id);

        let messages = Index.NewMessage("system", user.base)
            .concat(Index.NewMessage("user", `(${username}) ` + UserQuestion));
        let length = messages.length;
        
        const val = await Index.RequestChatGPT(messages, interaction);
        const NewMessages = val.slice(length);
        
        let firstIndex = NewMessages.findIndex(v => {return v.content != null && v.role == "assistant"});

        const Content = `${username}: ${UserQuestion}\nAI: ${NewMessages[firstIndex].content}`;
        if (Content.length <= 2000 && interaction.isRepliable()) {
            await interaction.editReply(Content)
        } else {
            // If the message is too long, just say, look below for your answer and then SendMessage it.
            if (interaction.isRepliable())
                interaction.editReply("See message below.");
            await Index.SendMessage(interaction, Content)
        }

        // Send any follow-up messages made by a local AI.
        if (Index.LocalServerSettings.Use)
            for (let i = firstIndex + 1; i < NewMessages.length; i++) {
                if (NewMessages[i].content != "" && NewMessages[i].role == "assistant")
                    await interaction.channel.send(NewMessages[i].content)
            }
    },
};