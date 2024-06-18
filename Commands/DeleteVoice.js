//Ignore ts(80001)
const { PermissionsBitField } = require('discord.js');
const { SlashCommandBuilder, CommandInteraction, VoiceState } = require('discord.js');
const { OnAutocomplete: TTSToVCOnAutocomplete, VCSets, WriteVCSets } = require('./TTSToVC');
const fp = require('fs/promises');
const { EmbedDirectory, DefaultEmbedding } = require('../VoiceV2');
const EmbedDirectoryFromThisFile = __dirname + "/../" + EmbedDirectory + "/";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletevoice')
        .setDescription("Removes a voice.")
        .addStringOption(option => {
            return option.setName("in")
                .setDescription("Voice to rename.")
                .setRequired(true)
                .setAutocomplete(true)
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        /** @type {string} */
        const input = interaction.options.getString("in");

        // First, replace VCSets.
        VCSets.forEach((set, index, array) => {
            if (set.Model == input) {
                set.Model = DefaultEmbedding;
                array[index] = set;
            }
        })
        WriteVCSets();

        // Now remove file.
        fp.unlink(EmbedDirectoryFromThisFile + input).then(() => {
            interaction.editReply(`Removed ${input.replaceAll(".bin", "")}!`);
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