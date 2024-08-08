/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, VoiceState } = require('discord.js');

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
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

    // Below here is not required; should be deleted if not needed.
    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        
    },

    OnConfigureSecurity() {
        // Configure some security stuff, eg; 
        // this.data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: true,

    /**
     * @param {AutocompleteInteraction} interaction The Autocomplete request.
     */
    async OnAutocomplete(interaction) {

    },

    /**
     * Triggers when a user's voice state updates.
     * @param {VoiceState} oldState 
     * @param {VoiceState} newState 
     */
    OnVoiceStateUpdate(oldState, newState) {

    }
}