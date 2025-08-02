const fs = require('fs');
const { GetLastMessageAndOutputChannel, LogTo } = require("./TranscriptionLogger");
const { Voice } = require("./VoiceV2");
const PathLib = require('path');
const { PlayAudioToVC, GetPlayer } = require("./Commands/TTSToVC");
const { GetPolicy, HasPolicy } = require('./Security');
const { client } = require('.');

//#region Options
// Ability to disable/enable splitting sentences. This can improve generation speed, but on some models results in stopy-starty speech.
const SPLITSENTANCES = true;
//#endregion

/**
 * An array which maps userIDs to the number of shouts they have left.
 */
const Shouts = {
    1234: 0
}
delete Shouts[1234];

/**
 * How many hashtags it should take to get 100% volume. 
 * Volume decreases with each additional tag.
 */
const NormalVolumeHashTags = 4;

/**
 * Splits a string by the characters '.' '!' and '?'
 * @param {string} text Text to split.
 * @returns {{parts: [{content: string, volume: number}], HasShout: boolean}}
 */
function SplitToSections(text) {
    const lines = text.split("\n");
    let parts = lines.map(v => {
        return SPLITSENTANCES ? v.split(/(?<=[.!?])\s/) : [v]; 
    });

    // Now, parts includes an array of lines, where each line is split by sentence. Now, we just need to add the volume calculation.
    let hasShout = false;
    return {
        parts: parts.flatMap(v => {
            // Look for # at the start.
            const NumberOfHastags = v[0].startsWith("#") ? v[0].indexOf(" ") : NormalVolumeHashTags;
            const volume = NormalVolumeHashTags / NumberOfHastags;
            if (volume != 1) hasShout = true;
    
            return v.map(txt => {
                return {
                    content: txt,
                    volume: volume
                }
            })
        }),
        
        HasShout: hasShout
    }
}

/**
 * Very similar to TextToVC, except it generates and plays when callback functions are called.
 * @param {string} text 
 * @param {string} VCID 
 * @param {string} GuildID 
 * @param {string} model 
 * @param {number} [volume=1] Volume to play back at.
 * @returns {{
    voice: () => Promise<{
        text: string;
        message: boolean;
    }>;
    Play: () => Promise<any>;
}}
 */
function TextToVCWithCallback(text, VCID, GuildID, model, volume = 1) {
    const path = PathLib.resolve(__dirname + `/Temp/${Math.floor(Math.random() * 100000)}_chat_tts.wav`);

    let hasVoiced = false;
    let VoicePromise = null;
    const voice = () => {
        if (!hasVoiced) {
            hasVoiced = true;
            return VoicePromise = Voice(text, path, model);
        } else return VoicePromise;
    }
    
    function Play() {
        return new Promise(async res => {
            if (!hasVoiced)
                await voice();

            PlayAudioToVC(path, { OutputID: VCID, OutputGuildID: GuildID, Player: GetPlayer() }, volume)
                // Delete audio after it has finished playing.
                .then(() => {
                    fs.unlinkSync(path);
                    res();
                });
        })
    }

    const x = { voice, Play }
    return x;
}

/**
 * Voices long blocks of text with a mind for performance.
 * @param {string} GuildId Guild to voice into.
 * @param {string} content Long content to voice.
 * @param {string} ChannelId Voice channel to voice into.
 * @param {string} [Voice=AIVoiceBin] Voice to read as.
 * @param {boolean} [log=true] Whether to log or not.
 * @param {string} [UserId=undefined] The user asking this to voice.
 * @returns {Promise<>} Resolves when voiceing is complete.
 */

async function VoiceLong(GuildId, content, ChannelId, Voice = AIVoiceBin, log = true, UserId = undefined) {
    let messageDetails = log ? (await GetLastMessageAndOutputChannel(GuildId)) : undefined;
    const VoicePlaySections = [], GenerationCalls = [];
    let { parts, HasShout } = SplitToSections(content);

    //#region Shout management system.
    if (HasShout && UserId) {
        const maxShoutCount = await GetPolicy(GuildId, "maxshoutcount");
        // Check if we can shout.        
        if (Shouts[UserId] == undefined) Shouts[UserId] = maxShoutCount;

        // Subtract a shout if we can. 
        const guild = await client.guilds.fetch(GuildId);
        const user = (await (guild).members.fetch(UserId));
        const shoutrole = await GetPolicy(GuildId, "shoutrole");
        let HasShoutRole = await HasPolicy(GuildId, "shoutrole") && user.roles.cache.some(v => { return v.id == shoutrole });

        // If the user doesn't have the Shout role, then do a recharge system for their shouts.
        if (!HasShoutRole)
            if (Shouts[UserId] > 0) {
                // Set the recharge timer.
                if (Shouts[UserId] == maxShoutCount)
                    setTimeout(async () => {
                        Shouts[UserId] = await GetPolicy(GuildId, "maxshoutcount");
                    }, await GetPolicy(GuildId, "shoutperiod") * 60000); // shoutperiod is in minutes, setTimeout is in ms, so convert by multiplying by 60,000.

                Shouts[UserId]--;

                // If we just used all of our shouts, let the user know.
                if (Shouts[UserId] == 0) {
                    const shoutperiod = await GetPolicy(GuildId, "shoutperiod");
                    user.send(`Hey! You just used all of your shouts! Stop screaming in VC.\nYour shouts will be available again after \`${shoutperiod}\` minutes!`);
                }
            } else {
                // Override all the volumes since this person can't shout.
                parts = parts.map(v => {
                    v.volume = 1;
                    return v;
                })
            }
    }
    //#endregion

    for (let i = 0; i < parts.length; i++) {
        // Ignore empty parts.
        if (parts[i].content.trim() == "") continue;

        // Setup the generation requests. 
        const x = TextToVCWithCallback(parts[i].content, ChannelId, GuildId, Voice, parts[i].volume);

        function Play() {
            const Promises = [
                x.Play(),
            ];

            if (log) Promises.push(LogTo(GuildId, "AI", "AI", parts[i].content));

            return Promise.all(Promises);
        }

        VoicePlaySections.push(Play); GenerationCalls.push(x.voice);
    }

    // Now that all voices are queued for generation, play them sucessively while generating the next chunk.
    // This means that audio is generated during the previous section's playback.
    messageDetails = log ? (await GetLastMessageAndOutputChannel(GuildId)) : undefined; // Because some time may pass, refresh log info.
    if (log)
        await messageDetails.last.edit(messageDetails.last.content.replace(`\n${AIThinkingMessage}`, ""));

    let lastGenRequest = GenerationCalls[0]();
    for (let i = 0; i < VoicePlaySections.length; i++) {
        // Always make sure audio is generated. Generating twice is prevented anyway.
        await lastGenRequest;
        const x = VoicePlaySections[i]();

        // Generate next part while reading this part.
        if (VoicePlaySections[i + 1] != undefined) lastGenRequest = GenerationCalls[i + 1]();
        await x;
    }
    return;
}
exports.VoiceLong = VoiceLong;
const { AIVoiceBin, AIThinkingMessage } = require("./Commands/Buddy");