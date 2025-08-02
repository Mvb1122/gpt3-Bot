//Ignore ts(80001)
const { PermissionsBitField } = require('discord.js');
const { SlashCommandBuilder, CommandInteraction, VoiceState } = require('discord.js');
const { OnAutocomplete: TTSToVCOnAutocomplete, VCSets, WriteVCSets } = require('./TTSToVC');
const fp = require('fs/promises');
const { EmbedDirectory } = require('../VoiceV2');
const token = require('../token');
const EmbedDirectoryFromThisFile = __dirname + "/../" + EmbedDirectory + "/";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('renamevoice')
        .setDescription("Renames a voice.")
        .addStringOption(option => {
            return option.setName("in")
                .setDescription("Voice to rename.")
                .setRequired(true)
                .setAutocomplete(true)
        })
        .addStringOption(option => {
            return option.setName("out")
                .setDescription("New name.")
                .setRequired(true)
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        if (interaction.user.id != token.GetToken(""))

        // Defer for safety.
        await interaction.deferReply();

        /** @type {string} */
        const input = interaction.options.getString("in");
        /** @type {string} */
        let out = interaction.options.getString("out");
        if (!out.endsWith(".bin")) out += ".wav";

        console.log(`Input: ${input}\nOutput: ${out}`);

        // First, replace VCSets.
        VCSets.forEach((set, index) => {
            if (set.Model == input) {
                set.Model = out;
                VCSets[index] = set;
            }
        })
        WriteVCSets();

        // Now rename file.
        fp.rename(EmbedDirectoryFromThisFile + input, EmbedDirectoryFromThisFile + out).then(() => {
            interaction.editReply(`Renamed ${input} to ${out.replaceAll(".wav", "")}!`);
        })
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: false,

    /**
     * @param {AutocompleteInteraction} interaction The Autocomplete request.
     */
    async OnAutocomplete(interaction) {
        // Use the TTSToVC autocomplete to return a list of embed names.
        return TTSToVCOnAutocomplete(interaction);
    },
}