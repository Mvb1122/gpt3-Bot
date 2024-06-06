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
     * Returns the log of the GuildID
     * @param {string} GuildID ID of the guild to fetch the log of.
     * @returns {string | undefined} ChannelId of the guild's log.
     */
    GetLogId(GuildID) {
        if (!HasLog(GuildID)) return undefined;
        else return Logs[GuildID];
    },

    /**
     * Logs to a guild using a specified event type
     * @param {string} GuildId 
     * @param {"TTS" | "STT" | "Join" | "Leave" | "Mute" | "Unmute"} Type Type of Transcription Event
     * @param {string} Name Name of the user.
     * @param {string | undefined} NewLogContent Text content. (Not necessary for events other than TTS/STT.)
     */
    async LogTo(GuildId, Type, Name = "A User", NewLogContent = undefined) {
        // Get log.
        if (Logs[GuildId] == undefined) return;

        const output = await client.channels.fetch(Logs[GuildId]);
        let TranscriptionMessageContent = `${Name}${UsernameSeperator}${NewLogContent}`;

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
             * Force reload of the message in order to avoid breaking command responses by preventing them from properly being responded to.
             * @type {Message}
             */
            const last = await output.messages.fetch(output.lastMessageId)

            // If the last message was written by us, and we can squeeze in our continued transcription, add onto it.
            const MessageContent = last.content;
            if (last.author.id == client.user.id && (NewLogContent + "\n " + TranscriptionMessageContent).length <= 2000) {
                // If the last user was the person we just transcribed, then just append the transcription. Otherwise, add a newline and their name and stuff.
                    // Get the last user.
                const lines = MessageContent.split("\n");
                const lastLine = lines[lines.length - 1];
                if (lastLine.includes(UsernameSeperator) && lastLine.substring(lastLine.indexOf(" "), lastLine.indexOf(UsernameSeperator)).trim() == Name) {
                    // Add punctuation if it's missing.
                    // if (!(last.content.endsWith(".") || last.content.endsWith("?") || last.content.endsWith("!"))) last.content += ".";
                    return await last.edit(MessageContent.trim() + " " + NewLogContent.trim());
                } else 
                    return await last.edit(MessageContent + "\n" + TranscriptionMessageContent);
            } else 
                // If that didn't match up just send a new message.
                await output.send(TranscriptionMessageContent);
        } catch {
            // If we error, send a new message.
            await output.send(TranscriptionMessageContent);
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