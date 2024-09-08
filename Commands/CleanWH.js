/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, TextChannel } = require('discord.js');
const { HasModRole } = require('../Security');

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('cleanwh')
        .setDescription("Removes all Webhooks"),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        const IsModOrOwner = interaction.user.id == interaction.guild.ownerId || (await HasModRole(interaction.member));
        if (!IsModOrOwner) return interaction.reply("You can't use this command!");

        interaction.reply("Hooks cleaned!");

        /**
         * @type {TextChannel}
         */
        const baseChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
        const hooks = await baseChannel.fetchWebhooks();
        hooks.forEach(v => {
            // Protect user-created WHs.
            if (!v.isUserCreated())
                v.delete();
        });
    },
}