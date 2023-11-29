//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionsBitField } = require('discord.js');
const Gradio = require('../Gradio_Stuff.js')

module.exports = {
	data: new SlashCommandBuilder()
        .setName('loadpreset')
        .setDescription('Connects Gradio to the given API **preset**! (Dev only)')
        .addIntegerOption(option => {
            return option.setName("preset")
                .setDescription("The preset number to connect to. 1: Main PC both, 2: Server, 3: All, 4: Main PC Main")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(4);
        })
        // Make it so only admin can see this command.
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Interacts with the passed message.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Only allow me to use this.
        if ((interaction.member != undefined && interaction.member.id != "303011705598902273") || (interaction.user != undefined && interaction.user.id != "303011705598902273")) return interaction.reply("You aren't allowed to use this!");

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