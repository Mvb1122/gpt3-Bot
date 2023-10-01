//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { IsChannelMemory, ClearAll, bases, GetBaseIdFromChannel } = require('./index.js');



module.exports = {
    data: new SlashCommandBuilder()
        .setName('togglememory')
        .setDescription('Starts or stops the AI from listening to the chat in this channel/thread.'),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();
        interaction.channel.id = interaction.channelId;
        if (!IsChannelMemory(interaction.channel)) {
            bases[GetBaseIdFromChannel(interaction.channel)] = [];
            interaction.editReply("Memory enabled! I'm now watching this channel!");
        } else {
            ClearAll({}, interaction);
            bases[interaction.channelId] = undefined;
            interaction.editReply("No longer watching this channel! Feel free to speak without my gaze upon your writings.")
        }
    }
};