/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data here. Occurs after all commands loaded.)
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, AutocompleteInteraction, EmbedBuilder } = require('discord.js');
const { ListModelConfigs, selectModel } = require('../Model Configs/ListSupportedModels');

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('models')
        .setDescription("Reads and sets current model.")
        .addSubcommand(o => {
            return o.setName("read")
                .setDescription("Lists current models.")
        })
        .addSubcommand(o => {
            return o.setName("set")
                .setDescription("Sets the current model for EVERYONE.")
                .addStringOption(so => {
                    return so.setName("newmodel")
                        .setDescription("New Model to use.")
                        .setAutocomplete(true)
                        .setRequired(true)
                });
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        if (interaction.options.getSubcommand() == "read") {
            const models = ListModelConfigs();
            const embed = new EmbedBuilder()
                .setTitle("Ready AI Models:")
                .addFields(Object.keys(models).map(v => models[v]).map(v => {
                    const name = v.id; 
                    const val = ""
                        + (v.imageSupport ? ":eye:" : "")
                        + (v.thinking ? ":brain:" : "")
                        + (v.toolSupport != null ? ":wrench:" : "")

                    return {
                        name: name,
                        value: val
                    };
                }));

            interaction.editReply({
                embeds: [embed]
            });
        } else {
            const selected = ListModelConfigs()[interaction.options.getString("newmodel")];
            selectModel(selected);
            interaction.editReply("Ready with model `" + selected.id + "`!");
        }
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
        const input = interaction.options.getFocused();
        let configs = ListModelConfigs();
        configs = Object.keys(configs).map(v => configs[v]);

        const choices = configs
            .filter(v => {
                return v.id.includes(input);
            })
            .map(v => {
                return {
                    name: v.id, 
                    value: v.id
                }
            });

        interaction.respond(choices);
    }
}