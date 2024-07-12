//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, User } = require('discord.js');
const { GetUserFile } = require('../User');
const { SendMessage } = require('..');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getspending')
        .setDescription("Sees how much of Micah's money a user has spent!")
        .addUserOption(o => {
            return o.setName("user")
                .setDescription("The user to check.")
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        /**
         * @type {User}
         */
        const user = interaction.options.getUser("user") ?? interaction.user;
        
        const date = new Date();
        const month = (date.getMonth() + 1).toString();
        const year = date.getFullYear().toString();

        const cost = (await GetUserFile(user.id)).cost;
        
        let MonthlyCost, AllCost, YearCost = MonthlyCost = AllCost = 0;
        const lines = Object.keys(cost).map((value) => {
            const dayCost = cost[value];

            if (value.startsWith(month) && value.endsWith(year)) MonthlyCost += dayCost;

            if (value.endsWith(year)) YearCost += dayCost;
            
            AllCost += dayCost;
            
            return `${value}: ${dayCost.toPrecision(6)}`;
        });
        
        interaction.editReply(`<@${user.id}>'s Costs:\n\`\`\`This Month: ${MonthlyCost.toPrecision(6)}\nThis Year: ${YearCost.toPrecision(6)}\nAll-time: ${AllCost.toPrecision(6)}\`\`\``);
        SendMessage(interaction, "```" + lines.join("\n") + "```");
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: true,
}