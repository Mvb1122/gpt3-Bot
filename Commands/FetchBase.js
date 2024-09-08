//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, User } = require('discord.js');
const { GetUserFile } = require('../User.js');
const fp = require('fs/promises');
const path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('fetchbase')
        .setDescription('Tells you what your current base is.')
        .addBooleanOption(o => {
            return o.setName("hidden")
                .setDescription("Whether to show your base to everyone.")
                .setRequired(false);
        })
        .addUserOption(o => {
            return o.setName("user")
                .setDescription("What user to read. Defaults to oneself.")
                .setRequired(false)
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

        const User = await GetUserFile(id, false);
        const FaceSuffix = User.base_face != "" ? "\nFace: `" + User.base_face + "`\n": "\n";
        const NameSuffix = User.base_name != "" ? "Name: `" + User.base_name + "`" : "";
        const suffix = `${FaceSuffix}${NameSuffix}`;

        const text = `${pronoun} current base:\`\`\`${User.base}\`\`\`${suffix}`;
        if (text.length <= 2000)
            interaction.editReply(text)
        else {
            const p = path.resolve("./Temp/" + interaction.user.id + "_temp.txt");
            await fp.writeFile(p, User.base + "\n\n\n ==METADATA== \n" + suffix);
            await interaction.editReply({content: "Please see attached file!", files: [p]});
            fp.unlink(p);
        }
    }
};