//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message } = require('discord.js');
const { GetBaseIdFromChannel, IsMessageInThread, NewMessage } = require('../index.js');
const { GetUserFile } = require('../User.js');

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
   * @param {Message} message The message holding the channel to create the thread at.
   * @returns Nothing.
   */
  CreateMemoryThread: async function CreateMemoryThread(message) {
    if (await IsMessageInThread(message)) message.reply("You can't use this command in a thread!")
    let ID = -1;
    do {
      ID = Math.floor(Math.random() * 100000);
    } while (message.BotData.bases[ID] != null);
    let Channel = message.channel;

    /** @type {Discord.Channel} */
    const thread = await Channel.threads.create({
      name: this.MemoryChannelPrefix + ID,
      autoArchiveDuration: 60,
      reason: 'User requested thread for ChatGPT with Memory.',
    });

    // Add memory to this channel.
    message.BotData.bases[GetBaseIdFromChannel(thread)] = NewMessage("System", (await GetUserFile((message.author ?? message.user).id)).base);
    thread.send("Memory enabled! I'm now watching this thread!");
    return message.reply(`Thread created! <#${thread.id}>`);
  },

  MemoryChannelPrefix: 'Memory Channel ',

  /** 
   * Variable which determines if this command can be used as a user install app.
   * Should be set to false if can't be used. If not defined, then it's assumed to be true.
   * @default {true}
   */
  CanExternal: false,
};