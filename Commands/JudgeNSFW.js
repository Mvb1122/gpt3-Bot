/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, PermissionsBitField, Attachment, Message, TextChannel } = require('discord.js');
const { JudgeNSFWImage, JudgeNSFWTags } = require('../Helpers');
const { client } = require('..');
const { GetPolicy } = require('../Security');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('judgensfw')
        .setDescription("Judges how NSFW your prompts are.")
        .addSubcommandGroup(g => {
            return g.setName("mode")
                .setDescription("How to judge.")
                .addSubcommand(o => {
                    return o.setName("text")
                        .setDescription("Judges text tags for image AI.")
                        .addStringOption(option => {
                            return option.setName("text")
                                .setDescription("The text to judge.")
                                .setRequired(true)
                        })
                })
                .addSubcommand(o => {
                    return o.setName("image")
                        .setDescription("Judges NSFW images.")
                        .addAttachmentOption(p => {
                            return p.setName("image")
                                .setDescription("The image to judge.")
                                .setRequired(true)
                        })
                })
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        let response = null;
        if (interaction.options.getSubcommand("mode") == "text") {
            const text = interaction.options.getString("text");
            response = await JudgeNSFWTags(text);
        } else {
            /**
             * @type {Attachment}
             */
            const image = interaction.options.getAttachment("image");
            response = await JudgeNSFWImage(image.url);
        }
        let stats = "";
        for (let i = 0; i < response.length; i++) stats += `\n${response[i].label}: ${(response[i].score * 100).toFixed(2)}%`

        interaction.editReply("Here's your stats: ```" + stats + "```");
    },

    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        // Judge how NSFW an image is when it's sent.
        const DoJudgeImages = await GetPolicy(message.guildId, "judgeimages");
        if (message.attachments.size != 0 && message.author.id != client.user.id && DoJudgeImages) {
            let judgements = message.attachments.map(v => {
                if (v.contentType.includes("image"))
                    return JudgeNSFWImage(v.url)
                // We can't judge non-image attachments, so just 
                else return [{
                    label: "sfw",
                    score: 100
                }]
            })

            
            Promise.all(judgements).then(async v => {
                const j = v.flat();

                const logChannel = await GetPolicy(message.guildId, "modchannel");
                if (j.some(v => {return v.label == "nsfw"}) && logChannel != undefined){
                    // If some of the images are NSFW, then log all of them.
                    /**
                     * @type {TextChannel}
                     */
                    const channel = await client.channels.fetch(logChannel);
                    channel.send({
                        content: `${message.member.displayName} may have sent an NSFW image!`,
                        files: message.attachments.map(v => v.url),
                        "allowed_mentions": { 
                            users: [], 
                            roles: [] 
                        }
                    })
                }
            })
        }
    },
}