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
        const username = interaction.member.nickname ?? interaction.member.displayName;
        let messages = Index.NewMessage("system", Index.fetchUserBase(interaction.member.id))
            .concat(Index.NewMessage("user", interaction.options.getString("question"), username))
        
        await Index.RequestChatGPT(messages, interaction)
            .then(val => {
                const Content = `${username}: ${interaction.options.getString("question")}\nAI: ${val[val.length - 1].content}`;
                try {
                    interaction.editReply(Content);
                } catch (e) {
                    // If the message is too long, just say, look below for your answer and then SendMessage it.
                    interaction.editReply("See message below.");
                    Index.SendMessage(interaction, Content)
                }
            })
    },
};