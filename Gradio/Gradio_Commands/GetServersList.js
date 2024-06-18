//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionsBitField } = require('discord.js');
const Gradio = require('../Gradio_Stuff.js');
const token = require('../../token.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('getserverslist')
        .setDescription('Lists the connected generation servers! (Dev only)')
        // Make it so only admin can see this command.
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Interacts with the passed message.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Only allow me to use this.
        if (interaction.member.id != token.GetToken("devDiscordID")) return interaction.reply("You aren't allowed to use this!");

        let output = ""
        Gradio.GetServers().forEach(server => {
            output += server.host + ":" + server.port + "\n"
        })
        interaction.reply({content: "Servers: ```" + output + "```", ephemeral: true });
    },
};