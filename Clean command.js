/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demo')
        .setDescription("demo")
        .addStringOption(option => {
            return option.setName("demo")
                .setDescription("demo")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const demo = interaction.options.getString("demo") ?? null; // If required then you can remove the ?? null.
    },

    OnConfigureSecurity() {
        // Configure some security stuff, eg; 
        // this.data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    }
}