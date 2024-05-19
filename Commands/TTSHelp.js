/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/

//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { AudioTypes } = require('../VoiceV2');

const text = `
# Starting TTS:
- You can either use the premade voices or make your own voices.
- Just run \`/starttts\` to set it up.
	- \`output\` is the voice channel you want to speak in.
	
	- \`input\` is the text channel you want to write in. This defaults to the channel your run the command in.
	
	- \`model\` is the voice you want to use. See **Creating Models** below to make voices.
- After you've run \`/starttts\`, your messages should be read in the voice channel you provided as \`output\`.
	- At first, messages may take up to twenty seconds to be read, but will speed up significantly after the first message has been read. 

- TTS should stay on indefinitely until you stop it manually.	
	- If it glitches, you may have to stop/start it.
- TTS messages will only be read if you're in the call.

# Stopping TTS:
- Just run \`/stoptts\` to stop it.
- \`/stoptts\` only works in channels which are actively reading your mesages.
	- Run it in the channel you ran \`/starttts\` to stop.

# Creating Models:
- Use \`/clonevoice\` to clone a person's voice.
	- \`AudioClip\` must be one of these types to work properly:
	- **Supported Audio Types:** ${AudioTypes.join(", ")}
	
	- A \`name\` can be given to title your model by.
		- If you create a second model of the same name, it will overwrite your first one.
		- If you leave \`name\` blank, it will be the title of the audio file provided.
- The AI requires clean audio without distractions to duplicate voices best.
	- Audio that's not *exactly* perfect may produce unexpected results/low quality audio!

# Recording Voice Clips + General AI Voice notes:
- Use \`/voice\` to voice words.
	- \`line\` is the words you want to voice.
		
	- \`model\` is the voice you want to use. Default uses "Girl".
- Output from the AI may contain extra words on extra long or extra short lines.
- There is a word cap. I haven't bothered to test it, but it's like 1500 characters or so.
`

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ttshelp')
		.setDescription("Sends some info about how to use TTS."),

	/**
	 * Generates the message with the specified count.
	 * @param {CommandInteraction} interaction 
	 */
	async execute(interaction) {
		interaction.reply("Check your DMs!");
		interaction.user.send(text);
	}
}