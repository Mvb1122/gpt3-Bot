/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/

//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, ChannelType, VoiceChannel } = require('discord.js');
const { Conversation } = require('../MultiAIConvo/Convo');
const { StartLog, LogTo } = require('../TranscriptionLogger');
const { VoiceLong } = require('./Buddy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('podcast')
        .setDescription("Makes AI talk to themselves.")
        .addStringOption(option => {
            return option.setName("topic")
                .setDescription("conversation topic")
                .setRequired(true)
        })
        .addChannelOption(option => {
            return option.setName("output")
                .setDescription("Where to read messages.")
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice);
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const topic = interaction.options.getString("topic");
        const ChannelInput = interaction.options.getChannel("input");
        
        /**
         * Voice output channelID.
         * @type {string}
         */
        const output = (ChannelInput != null ? ChannelInput.id : null) ?? interaction.member.voice.channelId ?? null;
        if (output == null) return interaction.editReply("Please select or join a voice channel!");
        
        const conversation = new Conversation(topic);
        
        // Temporary testing code.
        interaction.editReply("Conversation loading... I'll join VC in a second! Prompt: ```\n" + topic + "```");
        StartLog(interaction.guildId, interaction.channelId);
        do {
            await new Promise(async res => {
                const response = await conversation.GenerateNext(interaction);
                Promise.allSettled([
                    LogTo(interaction.guildId, "AI", response.chatter.name, response.content),
                    VoiceLong(interaction.guildId, response.content, output, response.chatter.PreferredVoice, false)
                ]).then(() => {
                    setTimeout(() => {
                        res();
                    }, 300);
                });
            });
        } while (true);
    },

    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        
    },
}