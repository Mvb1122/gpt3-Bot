//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionsBitField } = require('discord.js');
const Gradio = require('../Gradio_Stuff.js')

module.exports = {
	data: new SlashCommandBuilder()
        .setName('connect')
        .setDescription('Connects Gradio to the given API! (Dev only)')
        .addStringOption(option => {
            return option.setName("address")
                .setDescription("The address to connect to.")
                .setRequired(true);
        })
        .addIntegerOption(option => {
            return option.setName("port")
                .setDescription("The port to connect to. Default: 7860")
                .setRequired(false);
        })
        // Make it so only admin can see this command.
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Interacts with the passed message.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Only allow me to use this.
        if (interaction.member.id != token.GetToken("devDiscordID")) return interaction.reply("You aren't allowed to use this!");

        const address = interaction.options.getString("address");
        let port = interaction.options.getInteger("port") ?? 7860;
        port = Number.parseInt(port);

        if (Gradio.isConnected()) {
            try {
                await Gradio.ConnectTo(address);
                interaction.reply({content: "Connected!", ephemeral: true})
            } catch {
                interaction.reply({content: "Unable to connect!", ephemeral: true});
            }
        } else interaction.reply({content: "Unable to connect!", ephemeral: true});
    },
};