//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { MakeMusic } = require('../VoiceV2');
const fp = require('fs/promises')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription("Generates music!")
        .addStringOption(option => {
            return option.setName("prompt")
                .setDescription("What you want to listen to!")
                .setRequired(true)
        })
        .addNumberOption(o => {
            return o.setName("length")
                .setDescription("How long you want it to be in seconds (default 5s)")
                .setMaxValue(30)
                .setMinValue(1)
                .setRequired(false)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const prompt = interaction.options.getString("prompt");
        const length = interaction.options.getNumber("length") ?? 5;

        let time_taken = performance.now();
        MakeMusic(prompt, `./Temp/${interaction.user.id}_music.wav`, length).then((output) => {
            time_taken = ((performance.now() - time_taken) / 1000).toFixed(2);
            interaction.editReply({
                content: "Here's your music! Prompt:```" + prompt + "```\nTime Taken: " + time_taken + "s",
                files: [output]
            }).then(() => {
                fp.unlink(output);
            })
        })
    },
}