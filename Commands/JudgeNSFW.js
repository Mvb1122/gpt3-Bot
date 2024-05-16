/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');

const Judge = require("../Helpers").JudgeNSFWTags;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('judgensfw')
        .setDescription("Judges how NSFW your prompts are.")
        .addStringOption(option => {
            return option.setName("text")
                .setDescription("The text to judge.")
                .setRequired(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const text = interaction.options.getString("text");
        const response = await Judge(text);

        let stats = "";
        for (let i = 0; i < response.length; i++) stats += `\n${response[i].label}: ${(response[i].score * 100).toFixed(2)}%`

        interaction.editReply("Here's your stats: ```" + stats + "```");
    }
}