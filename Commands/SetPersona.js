//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const Index = require ('../index.js');
const { GetUserFile } = require('../User.js');
const { AutocompleteInteraction } = require('discord.js');

/**
 * @param {AutocompleteInteraction} interaction The Autocomplete request.
 */
async function GetSuggestedPersonaNames(interaction, HelpMessage = "Write the name!") {
    // So here's the plan: We load the user file, find the persona name they're trying to type, and suggest it.
    const stringValue = interaction.options.getFocused();
    const user = await GetUserFile(interaction.user.id);

    /**
     * @type {[{ name: string, value: string}]}
     */
    const suggestions = user.personas.filter(v => v.name.trim().toLowerCase().startsWith(stringValue))
        .map(v => {
            return {
                name: v.name,
                value: v.name
            }
        })
        .slice(0, 20);

    if (suggestions.length == 0) {
        // They don't have any! Tell them to write the name they want.
        return interaction.respond([{name: HelpMessage, value: "0"}])
    } else interaction.respond(suggestions);
}

module.exports = {
	data: new SlashCommandBuilder()
        .setName('setpersona')
        .setDescription('Sets your AI avatar persona. Whatever you enter will become your main persona.')
        .addStringOption(option => {
            return option.setName("persona")
                .setDescription("Your persona.")
                .setRequired(true)
        })
        .addStringOption(op => {
            return op.setName("name")
                .setDescription("The name to give this persona. Do not match to create a new one.")
                .setRequired(false)
                .setAutocomplete(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true});

        let persona = interaction.options.getString("persona");
        const id = interaction.author ? interaction.author.id : interaction.user.id;
        const NameVariable = interaction.options.getString("name");

        const name = NameVariable ?? interaction.member.nickname ?? interaction.user.displayName;
        const x = await GetUserFile(id);

        // Find the existing persona.
        const NewPersona = {
            name: name,
            content: persona,
            face: ""
        }

        const existing = x.personas.find(v => v.name == name);
        if (existing) 
            x.personas[x.personas.indexOf(existing)] = NewPersona;
        else 
            x.personas.push(NewPersona);

        // Set this to be the main persona.
        x.persona = persona;
        x.persona_face = ""; // Clear persona_face.
        x.sync();

        interaction.editReply({
            content: "Persona set! ```" + persona + "```",
        });

        // Rebuild persona array. 
        Index.UpdatePersonaArray();
    },

    OnAutocomplete: GetSuggestedPersonaNames,
    GetSuggestedPersonaNames
};