//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { GetBaseIdFromChannel, IsMessageInThread } = require('../index.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('creatememorythread')
        .setDescription('Opens a thread for talking with ChatGPT!'),

    /**
     * Interacts with the passed message.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
      // interaction.user is the object representing the User who ran the command
      // interaction.member is the GuildMember object, which represents the user in the specific guild
          return await this.CreateMemoryThread(interaction);
    },

    /**
     * Opens a thread for talking with ChatGPT!
     * @param {CommandInteraction} message The message holding the channel to create the thread at.
     * @returns Nothing.
     */
    CreateMemoryThread: async function CreateMemoryThread(message) {
      if (IsMessageInThread(message)) message.reply("You can't use this command in a thread!")
      let ID = -1;
      do {
        ID = Math.floor(Math.random() * 100000);
      } while (message.BotData.bases[ID] != null);
      let Channel = message.channel;
      
      /** @type {Discord.Channel} */
      const thread = await Channel.threads.create({
        name: 'Memory Channel ' + ID,
        autoArchiveDuration: 60,
        reason: 'User requested thread for ChatGPT with Memory.',
      });
    
      // Add memory to this channel.
      message.BotData.bases[GetBaseIdFromChannel(thread)] = "";
      thread.send("Memory enabled! I'm now watching this thread!");
      return message.reply(`Thread created! <#${thread.id}>`);
    }
};