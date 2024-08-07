/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/

//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { AudioTypes, DefaultEmbedding } = require('../VoiceV2');
const { SendMessage } = require('..');

const text = `
# Starting TTS:
- You can either use the premade voices or make your own voices.
- Just run \`/starttts self\` to set it up.
	- \`output\` is the voice channel you want to speak in.
	
	- \`input\` is the text channel you want to write in. This defaults to the channel your run the command in.
	
	- \`model\` is the voice you want to use. See **Creating Models** below to make voices.
- After you've run \`/starttts\`, your messages should be read in the voice channel you provided as \`output\`.
	- At first, messages may take up to twenty seconds to be read, but will speed up significantly after the first message has been read. 

- TTS should stay on indefinitely until you stop it manually.	
	- If it glitches, you may have to stop/start it.
- TTS messages will only be read if you're in the call.
- You can rerun \`/starttts\` to change settings if you want.

# Stopping TTS:
- Just run \`/stoptts\` to stop it.
- \`/stoptts\` only works in channels which are actively reading your mesages.
	- Run it in the channel you ran \`/starttts\` to stop.

# Reading whole channels:
- By default, all messages sent in a voice channel's text chat will be read aloud using the default voice, \`${DefaultEmbedding.substring(0, DefaultEmbedding.indexOf(".bin"))}\`.
- You can add additional linkages between channels with the \`/starttts conversation\` command.
	- The parameters, \`input\` and \`output\` are the same as with \`/starttts self\`.
	
	- Voices will be assigned randomly, but can be overridden via \`/starttts self\`

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
- Voicing runs at about 4x real speed.

# Transcribing Audio
- You can transcribe a file with \`/transcribe mode file\` and then adding a file as \`voice\`.
	- Can be any common voice/video file.
	
	- When first calling this function, it may take an extra long time to load, but after about a minute or so, it'll load up. From there, requests should transcribe relatively quickly.
	
	- Transcription also runs at about 4x real speed.
- You can transcribe a discord call with \`/transcribe mode call\`
	- \`input\` is the call to transcribe.
	
	- \`output\` is the text channel to send the transcription into.
	
	- Both \`input\` and \`output\` can be automatically inferred based on your current channel and if you're in a voice channel.
	
	- Can be stopped with \`/transcribe mode stopcall\`

# Talking to the AI in voice chat
- There are two modes: \`/buddy\` and \`/podcast\`:
	- In \`/buddy\` you talk directly with the AI.
		- \`/buddy mode call\` to start. \`/buddy mode stopcall\` to stop.
		
		- There are input and output parameters with the same meanings as \`/transcribe\`
		
		- You have to stop the call and restart it to clear the AI's memory. It uses your text base to start.
	- In \`/podcast\` you listen to a panel of AIs talk to each other about whatever \`topic\` you choose.
		- \`/podcast action call\` to start.
		
		- For now, these AI are locked as whatever Micah was testing with last.
		
		- This mode is kinda expensive so don't leave it running.
			- \`/podcast action stopcall\` to stop.
`.split("\n#");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ttshelp')
		.setDescription("Sends some info about how to use TTS."),

	/**
	 * Generates the message with the specified count.
	 * @param {CommandInteraction} interaction 
	 */
	async execute(interaction) {
		interaction.reply({content: "Check your DMs!", ephemeral: true});
		
		for (let i = 0; i < text.length; i++) if (text[i].trim() != "") await interaction.user.send("# " + text[i]);
	}
}