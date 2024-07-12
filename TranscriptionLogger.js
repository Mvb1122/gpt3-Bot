const { Message, Channel } = require("discord.js");
const { client } = require(".");

const Logs = {1234: {ChannelId: 1234, Listeners: [(t, n, c) => {}]}};
delete Logs[1234];
const UsernameSeperator = ` | `

/**
* Whether logging is enabled for a guild.
* @param {string} GuildId 
* @returns {boolean}
*/
function HasLog(GuildId) {
    return Logs[GuildId] != undefined;
}

/**
 * Gets the last message and the selected logging channel in the given guild.
 * @param {string} GuildId GuildID to get.
 * @returns {Promise<{last: Message, output: Channel}>}
 */
async function GetLastMessageAndOutputChannel(GuildId) {
    const logs = Logs[GuildId];
    const output = await client.channels.fetch(logs.ChannelId);
    
    /**
     * Force reload of the message in order to avoid breaking command responses by preventing them from properly being responded to.
     * @type {Message}
     */
    const last = await output.messages.fetch(output.lastMessageId);
    return { last, output };
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
     * @param {"TTS" | "STT" | "Join" | "Leave" | "Mute" | "Unmute" | "AI"} Type Type of Transcription Event
     * @param {string} Name Name of the user.
     * @param {string | undefined} NewLogContent Text content. (Not necessary for events other than TTS/STT.)
     */
    async LogTo(GuildId, Type, Name = "A User", NewLogContent = undefined) {
        // Get log.
        if (Logs[GuildId] == undefined) return;

        // Run OnLog things.
        for (let i = 0; i < Logs[GuildId].Listeners.length; i++) Logs[GuildId].Listeners[i](Type, Name, NewLogContent);

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
            
            case "AI":
                TranscriptionMessageContent = `:robot: ${TranscriptionMessageContent}`
                break;

            default:
                break;
        }

        // Decide whether to send a message or to edit one.
        try {
            const { last, output } = await GetLastMessageAndOutputChannel(GuildId);

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

    HasLog, GetLastMessageAndOutputChannel,

    /**
     * Links the log up to a channel, updating it if needed.
     * @param {string} GuildId 
     * @param {string} ChannelId 
     * @returns {boolean} Whether the server was logging before.
     */
    StartLog(GuildId, ChannelId) {
        const HadLogBefore = HasLog(GuildId);
        Logs[GuildId] = {
            ChannelId: ChannelId,
            Listeners: []
        };
        return HadLogBefore;
    },

    /**
     * Adds a function to run whenever a message is logged.
     * @param {string} GuildId GuildID to subscribe to.
     * @param {(type: "TTS" | "STT" | "Join" | "Leave" | "Mute" | "Unmute" | "AI", name: string, content: string) => {}} f Function listener.
     */
    AddOnLog(GuildId, f) {
        if (Logs[GuildId] == undefined) return;

        else return Logs[GuildId].Listeners.push(f);
    },

    StopLog(Guilid) {
        return delete Logs[Guilid];
    }
}