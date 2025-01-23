/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/
const { SlashCommandBuilder, CommandInteraction, GuildTextThreadManager } = require('discord.js');
const { WriteLists, AddList, GetLists } = require('./Translate');


module.exports = {
    data: new SlashCommandBuilder()
            .setName('localize')
            .setDescription("Creates a thread for two-way translation of Japanese.")
            .addStringOption(o => {
                return o.setName("direction")
                    .setDescription("Which way to translate.")
                    .addChoices([
                        { name: "English To Japanese", value: "eng_Latn jpn_Jpan", name_localizations: { ja: "英語から日本語まで" } },
                        { name: "Japanese To English", value: "jpn_Jpan eng_Latn", name_localizations: { ja: "日本語から英語まで" } }
                    ])
                    .setRequired(true)
            }),
            /*
            .addBooleanOption(o => {
                return o.setName("filter")
                    .setDescription("Whether to filter to only messages written in the input language.")
            }),
            */

        /**
         * Generates the message with the specified count.
         * @param {CommandInteraction} interaction 
         */
        async execute(interaction) {
            // Defer for safety.
            await interaction.deferReply();

            // First check if there's a pair involving this.
            const matches = GetLists().filter(v => v.inputId == interaction.channelId);
            console.log(matches);
            if (matches.length != 0) return interaction.editReply("There already exists a thread for this channel! Please see <#" + matches[0].outputId + ">!");

            // Create a thread.
            /**
             * @type {GuildTextThreadManager<AllowedThreadTypeForTextChannel>}
             */
            const threadManager = interaction.channel.threads;
            const thread = await threadManager.create({
                name: "Localization Thread"
            });

            const ids = {
                thread: thread.id,
                base: interaction.channelId
            };

            const dirParts = interaction.options.getString("direction").split(" ");
            const dirs = {
                from: dirParts[0],
                to: dirParts[1]
            };

            // const filter = interaction.options.getBoolean("filter");


            // Add the two-way options.
            /**
             * @type {{inputId: number;outputId: number;to: string;from: string;}[]}
             */
            const sets = [
                {
                    inputId: ids.base,
                    outputId: ids.thread,
                    to: dirs.to,
                    from: dirs.from,
                    // filter: filter
                },
                {
                    inputId: ids.thread,
                    outputId: ids.base,
                    to: dirs.from,
                    from: dirs.from,
                    // filter: filter
                }
            ];

            sets.forEach(v => AddList(v));
            WriteLists();

            interaction.editReply("Setup complete! Messages will be automatically translated.")
        },
}