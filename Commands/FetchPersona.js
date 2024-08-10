//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { GetUserFile } = require('../User');
const { GetSuggestedPersonaNames } = require('./SetPersona');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('fetchpersona')
        .setDescription('Returns your AI persona.')
        .addBooleanOption(o => {
            return o.setName("hidden")
                .setDescription("Whether to show your base to everyone.")
                .setRequired(false);
        })
        .addUserOption(o => {
            return o.setName("user")
                .setDescription("What user to read. Defaults to oneself.")
                .setRequired(false)
        })
        .addStringOption(o => {
            return o.setName("name")
                .setDescription("Persona name. Setting this will force read your persona.")
                .setRequired(false)
                .setAutocomplete(true)
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        let ephemeral = interaction.options.getBoolean("hidden") ?? true;

        // Don't let people secretly read others' bases.
        let pronoun = "Your"
        if (interaction.options.getUser("user")) {
            ephemeral = false;
            pronoun = interaction.options.getUser("user").displayName + "'s"
        }
        
        await interaction.deferReply({ephemeral: ephemeral});
        
        const id = (interaction.options.getUser("user") ?? {id: null}).id ?? interaction.user.id;

        const name = interaction.options.getString("name");
        if (!name) {
            const base = (await GetUserFile(id, false)).persona;
            return interaction.editReply(`${pronoun} current persona:` + "```" + base + "```");
        } else {
            const file = await GetUserFile(interaction.user.id);
            const MatchedPersona = file.personas.find(v => v.name == name);
            if (MatchedPersona) {
                const FaceSuffix = MatchedPersona.face ? `Generated Face tags: \`\`\`${MatchedPersona.face}\`\`\`` : "";
                interaction.editReply(`${name}'s persona:\`\`\`${MatchedPersona.content}\`\`\`` + FaceSuffix)
            } else interaction.editReply("No matching persona found!");
        }
    },

    OnAutocomplete(interaction) {
        return GetSuggestedPersonaNames(interaction, "No persona found!")
    }
};