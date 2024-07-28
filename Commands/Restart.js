//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionsBitField } = require('discord.js');
const { Restart } = require('../VoiceV2');
const token = require('../token');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restarts python generation server. (Dev only)')
        // Make it so only admin can see this command.
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Interacts with the passed message.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Only allow me to use this.
        if (interaction.user.id != token.GetToken("devDiscordID")) return interaction.reply("You aren't allowed to use this!");

        interaction.deferReply({ephemeral: true});
        Restart().then(() => {
            interaction.editReply("Restarted!")
        })
    },
};