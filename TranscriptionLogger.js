const { client } = require(".");

const Logs = {}; // GuildId: ChannelId.
const UsernameSeperator = ` | `

/**
* Whether logging is enabled for a guild.
* @param {string} GuildId 
* @returns {boolean}
*/
function HasLog(GuildId) {
    return Logs[GuildId] != undefined;
}

module.exports = {
    /**
     * Logs to a guild using a specified event type
     * @param {string} GuildId 
     * @param {"TTS" | "STT" | "Join" | "Leave" | "Mute" | "Unmute"} Type Type of Transcription Event
     * @param {string} Name Name of the user.
     * @param {string | undefined} Content Text content. (Not necessary for events other than TTS/STT.)
     */
    async LogTo(GuildId, Type, Name = "A User", Content = undefined) {
        // Get log.
        if (Logs[GuildId] == undefined) return;

        const output = await client.channels.fetch(Logs[GuildId]);
        let TranscriptionMessageContent = `${Name}${UsernameSeperator}${Content}`;

        switch (Type) {
            case "STT":
                TranscriptionMessageContent = `:loud_sound: ${TranscriptionMessageContent}`
                break;
        
            case "TTS":
                TranscriptionMessageContent = `:writing_hand: ${TranscriptionMessageContent}`
                break;
            
            case "Join":
                TranscriptionMessageContent = `:green_square: ${Name} joined!`
                break;
            
            case "Leave":
                TranscriptionMessageContent = `:red_square: ${Name} left!`
                break;

            case "Mute":
                TranscriptionMessageContent = `:mute: ${Name} muted!`
                break;

            case "Unmute":
                TranscriptionMessageContent = `:speaking_head: ${Name} unmuted!`
                break;

            default:
                break;
        }

        // Decide whether to send a message or to edit one.
        try {
            /**
             * @type {Message}
             */
            const last = await output.messages.fetch(output.lastMessageId)

            // If the last message was written by us, and we can squeeze in our continued transcription, add onto it.
            if (last.author.id == client.user.id && (last.content + "\n" + TranscriptionMessageContent).length <= 2000) {
                // If the last user was the person we just transcribed, then just append the transcription. Otherwise, add a newline and their name and stuff.
                    // Get the last user.
                const lines = last.content.split("\n");
                const lastLine = lines[lines.length - 1];
                if (lastLine.includes(UsernameSeperator) && lastLine.substring(lastLine.indexOf(" "), lastLine.indexOf(UsernameSeperator)).trim() == Name) {
                    // Add punctuation if it's missing.
                    // if (!(last.content.endsWith(".") || last.content.endsWith("?") || last.content.endsWith("!"))) last.content += ".";
                    return await last.edit(last.content.trim() + " " + Content.trim());
                } else 
                    return await last.edit(last.content + "\n" + TranscriptionMessageContent);
            } else 
                // If that didn't match up just send a new message.
                await output.send(TranscriptionMessageContent);
        } catch (e) {
            // If we error, send a new message.
            await output.send(TranscriptionMessageContent);
            console.log(e);
        }
    },

    HasLog,

    /**
     * Links the log up to a channel, updating it if needed.
     * @param {string} GuildId 
     * @param {string} ChannelId 
     * @returns {boolean} Whether the server was logging before.
     */
    StartLog(GuildId, ChannelId) {
        const HadLogBefore = HasLog(GuildId);
        Logs[GuildId] = ChannelId;
        return HadLogBefore;
    },

    StopLog(Guilid) {
        return delete Logs[Guilid];
    }
}