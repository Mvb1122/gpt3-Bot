//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, Role } = require('discord.js');
const { SetPolicy } = require('../Security');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setmodrole')
        .setDescription("Sets the mod role for the server.")
        .addRoleOption(op => {
            return op.setName("modrole")
                .setDescription("The moderation role.")
                .setRequired(true);
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const isUserOwner = interaction.guild.ownerId == interaction.user.id 
        || interaction.user.id == "303011705598902273"; // Debug for letting me always use it.

        if (!isUserOwner) return interaction.editReply("Only the owner of the server can use this command!");
        else {
            /**
             * @type {Role}
             */
            const role = interaction.options.getRole("modrole");
            SetPolicy(interaction.guildId, "modrole", role.id)
    
            interaction.editReply(`Mod role for this server set to \`${role.name}\`!`)
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,
}