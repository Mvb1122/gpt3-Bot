//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionsBitField } = require('discord.js');
const Gradio = require('../Gradio_Stuff.js');
const token = require('../../token.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('loadpreset')
        .setDescription('Connects Gradio to the given API **preset**! (Dev only)')
        .addIntegerOption(option => {
            return option.setName("preset")
                .setDescription("The preset number to connect to. 1: MPC both, 2: Server, 3: All, 4: MPC Main 4: MPC Secondary")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5);
        })
        // Make it so only admin can see this command.
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Interacts with the passed message.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Only allow me to use this.
        const DevToken = token.GetToken("devDiscordID");
        if ((interaction.member != undefined && interaction.member.id != DevToken) || (interaction.user != undefined && interaction.user.id != DevToken)) return interaction.reply("You aren't allowed to use this!");

        let number = interaction.options.getInteger("preset");

        try {
            await Gradio.ConnectToPreset(number);

            let servers = ""
            Gradio.GetServers().forEach(server => {
                servers += server.host + ":" + server.port + "\n"
            })
            
            interaction.reply({content: "Servers: ```" + servers + "```", ephemeral: true })
        } catch (e) {
            console.log(e);
            interaction.reply("Unable to connect!");
        }
    },
};