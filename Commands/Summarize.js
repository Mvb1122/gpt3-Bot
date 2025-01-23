/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { NewMessage, GetSafeChatGPTResponse, LocalServerSettings } = require('..');

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('summarize')
        .setDescription("Summarizes the past conversation.")
        .addNumberOption(o => {
            return o.setName("messages")
                .setDescription("How many messages to pull down!")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false)
        })
        .addBooleanOption(o => {
            return o.setName("visible")
                .setDescription("Whether to hide the summary or not.")
                .setRequired(false);
        })
        .addBooleanOption(o => {
            return o.setName("topicfilter")
                .setDescription("Whether to filter to the channel topic.")
                .setRequired(false);
        }),

    SummarizeBase: "You are an assistant which is GREAT at summarizing conversations! You will first list the general topic, then provide a detailed description of the conversation. You should use markdown formatting for the general topic, and use plain text and words for the detailed description. You should exactly copy the capitalization and spelling of names.",

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        if (!LocalServerSettings.Use) interaction.reply({
            content: "This function is not available at this moment! Please try again later.",
            ephemeral: true
        })

        // Defer for safety.
        const visible = interaction.options.getBoolean("visible") != undefined ? interaction.options.getBoolean("visible") : true; // Default true.
        await interaction.deferReply({ ephemeral: !visible });

        const numMessages = interaction.options.getNumber("messages") ?? 100;
        const filter = interaction.options.getBoolean("topicfilter") != undefined ? interaction.options.getBoolean("topicfilter") : false;; // Default false. 
        let topic; 
        if (filter) topic = (await interaction.channel.fetch()).name;

        // Get the messages.
        const messages = await interaction.channel.messages.fetch({ limit: numMessages });
        // Sort into GPT format.
        const Text = messages.reverse().map(v => `${(v.member ?? { nickname: undefined }).nickname ?? v.author.displayName}: ${v.content}`).join("\n");

        // Ask the AI to summarize.
        const Inputs = NewMessage("System", module.exports.SummarizeBase)
            .concat(
                NewMessage("User", "Here's the conversation:\n" + Text + /* ),
                NewMessage("User", */ "\nThat being said, please summarize the conversation above." + (filter ? "\nPlease only filter your discussion to the topic of " + topic : ""))
            );

        let resp = (await GetSafeChatGPTResponse(Inputs, interaction, 0, false)).data.choices[0].message.content;

        /* console.log({
            i: interaction.options.getNumber("messages"),
            i2: numMessages,
            filter: filter,
            f2: interaction.options.getBoolean("topicfilter"),
            h: visible,
            h2: interaction.options.getBoolean("visible"),
            // t: Text,
            t2: Text.length
        }); */ 

        if (resp.length <= 2000) interaction.editReply(resp);
        else do {
            let sliceLength = resp.length >= 2000 ? 2000 : resp.length;
            let slice = resp.substring(0, sliceLength);
            resp = resp.substring(sliceLength);
            interaction.followUp(slice);
        } while (resp.length != 0)
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,
}