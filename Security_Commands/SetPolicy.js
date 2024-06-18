/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, ChannelType, PermissionFlagsBits } = require('discord.js');
const Security = require('../Security');

const CommonConfigureValueName = "value";
module.exports = {
    data: new SlashCommandBuilder()
        .setName('setpolicy')
        .setDescription("Sets a security policy on this bot.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();
        
        // Check that user either has mod role or owns the server.
        const isUserOwner = interaction.guild.ownerId == interaction.user.id;

        // Check if they have the mod role.
            // Ensure modrole is set. 
        if (!Security.HasPolicy(interaction.guildId, "modrole")) 
            return interaction.editReply("Please run `/modrole` before this!");

        const ModRoleID = await Security.GetPolicy(interaction.guildId, "modrole");
        const UserRoles = interaction.member.roles.cache;
        const HasModRole = UserRoles.some((val, key) => {
            return key == ModRoleID;
        });

        if (!(HasModRole || isUserOwner)) {
            return interaction.editReply("You don't have the mod role!");
        }

        // Get policy name and value.
        const policyName = interaction.options["_subcommand"];
        const value = interaction.options["_hoistedOptions"][0].value;

        // Set policy
        await Security.SetPolicy(interaction.guildId, policyName, value);

        // Respond
        interaction.editReply(`Policy ${policyName} set to \`${value}\`!`);
    },

    OnConfigureSecurity() {
        // Add subcommands based off of Security policy lists. 
        for (let i = 0; i < Security.policies.length; i++) {
            this.data = this.data.addSubcommand(s => {
                s.setName(Security.policies[i].toLowerCase())
                    .setDescription(Security.policyHelp[i]);

                /**
                 * @param {SlashCommandBooleanOption} j 
                 */
                function CommonConfigure(j) {
                    return j.setName(CommonConfigureValueName)
                        .setDescription("Aformentioned option.")
                        .setRequired(true);
                
                }

                // Add options.
                const type = Security.policyTypes[i];
                switch (type) {
                    case "boolean":
                        s = s.addBooleanOption(op => {
                            return CommonConfigure(op);
                        });
                        break;
                
                    case "RoleID":
                        s = s.addRoleOption(op => {
                            return CommonConfigure(op);
                        });
                        break;
                    
                    case "ChannelID":
                        s = s.addChannelOption(op => {
                            return CommonConfigure(op)
                                .addChannelTypes([ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread]);
                        });
                        break;

                    default:
                        break;
                }

                return s;
            })
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
    */
    CanExternal: false,
}