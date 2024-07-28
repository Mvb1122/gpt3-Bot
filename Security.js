/**
 * An array of the policies that the Security manager accepts.
 * @type {String[]}
 */
const policies = ["promptnsfw", "modrole","modchannel","allvoiceinvc","readjoinless","shoutrole","maxshoutcount","shoutperiod","judgeimages"];
/**
 * An array of strings that define what type each policy accepts.
 * @type {"boolean" | "RoleID" | "ChannelID" | "Number"}
 */
const policyTypes = ["boolean", "RoleID", "ChannelID", "boolean", "boolean","RoleID","Number","Number","boolean"];
const policyHelp = [
    "Enable NSFW Filtering",
    "The role who can bypass NSFW.",
    "The channel to log messages to.",
    "Whether or not to read all voice chat text messages in voice chat",
    "Whether or not to read voice messages from people who aren't in chat.",
    "The role who can bypass shout limits.",
    "How many shouts a user can use per period.",
    "How long the shout period is in minutes.",
    "Whether to check if images are NSFW or not."
];

const PolicyDefaults = {
    "promptnsfw": false,
    "modrole": undefined,
    "modchannel": undefined,
    "allvoiceinvc": true,
    "readjoinless": true,
    "shoutrole": undefined,
    "maxshoutcount": 5,
    "shoutperiod": 10,
    "judgeimages": false
}

const fp = require('fs/promises');
const fs = require('fs');
const Index = require('./index');

const FileNames = {
    Security: "./Security.json",
    Security_Backup: "./Security_Backup.json",
    UniLog: "./UniLog.json"
}

let Security = {
    1234: { /* Initial property is guildId */
        policies: {
            promptNSFW: true,
            modrole: 1234,
            modchannel: 1234,
        }
    }
}
Security = {}; 

async function SaveSecurity() {
    const ReloadedSecurity = JSON.parse(await fp.readFile(FileNames.Security));

    // If we're losing something, then write a backup.
    if (Security != ReloadedSecurity) fp.writeFile(FileNames.Security_Backup, JSON.stringify(Security));

    fp.writeFile(FileNames.Security, JSON.stringify(Security));
}

function ReloadSecurity(backup = true) {
    return new Promise(async res => {
        // If the security file doesn't exist, use the backup. If that doesn't exist, stick with the default empty object.
        const target = FileNames.Security;
        if (!fs.existsSync(FileNames.Security)) 
            if (fs.existsSync(FileNames.Security_Backup)) target = FileNames.Security_Backup;
            else return res();
        
        // Otherwise, just read it from file.
        const ReloadedSecurity = JSON.parse(await fp.readFile(FileNames.Security));

        // If we're losing something, then write a backup.
        if (Security != ReloadedSecurity && Security != {} && backup) fp.writeFile(FileNames.Security_Backup, JSON.stringify(Security));

        Security = ReloadedSecurity;
        res();
    })
}
// Reload on boot.
ReloadSecurity(false);

if (!(policies.length == policyTypes.length && policies.length == policyHelp.length)) throw new Error("Security Policy type, Policy name, Policy help array length mismatch!");

/**
 * Fetches a policy from the security.
 * @param {string} gid GuildID
 * @param {"promptnsfw" | "modrole" | "modchannel" | "allvoiceinvc" | "readjoinless" | "shoutrole" | "maxshoutcount" | "shoutperiod", "judgeimages"} policy PolicyName
 * @returns {Promise<*>}
 */
async function GetPolicy(gid, policy) {
    if (Security == {}) await ReloadSecurity(false);

    const GuildIDType = typeof(gid);
    if (GuildIDType != 'string') console.log("Wrong paramter passed! gid should be typeof String.")

    // If the guild isn't listed, return the default value.
    if (Security[gid] == undefined) return PolicyDefaults[policy]

    return Security[gid].policies[policy];
}

/**
 * Says whether a guild has a policy or not.
 * @param {string} gid GuildID
 * @param {"promptnsfw" | "modrole" | "modchannel" | "allvoiceinvc" | "readjoinless" | "shoutrole" | "maxshoutcount" | "shoutperiod", "judgeimages"} policy PolicyName
 * @returns {Promise<boolean>}
 */
async function HasPolicy(gid, policy) {
    return Security[gid] != undefined && !((await GetPolicy(gid, policy)) == undefined); // Lazy execution makes this safe.
}

/**
 * 
 * @param {number} gid GuildID
 * @param {"promptnsfw" | "modrole" | "modchannel" | "allvoiceinvc" | "readjoinless" | "shoutrole" | "maxshoutcount" | "shoutperiod", "judgeimages"} policy PolicyName
 * @param {*} value Policy value. Must be serializable.
 * @returns {Promise} Promise that resolves when entirely finished saving.
 */
async function SetPolicy(gid, policy, value) {
    if (!policies.includes(policy)) {
        throw new Error(`Invalid Policy name: ${policy}!`);
    } else {
        if (Security[gid] == undefined || Security[gid].policies == undefined) Security[gid] = {policies: {}}
        
        Security[gid].policies[policy] = value;
        return SaveSecurity();
    }
}

/**
 * Log for all servers.
 * @type {{GuildID: [string]}}
 */
let UniLog = {};
if (fs.existsSync(FileNames.UniLog))
    fp.readFile(FileNames.UniLog).then(d => {
        UniLog = JSON.parse(d);
    });

/**
 * Writes a message to the universal log and to a guild's log.
 * @param {string} guildId Discord GuildID to log to.
 * @param {string} message Message to write to the log.
 * @returns {Promise<[undefined, Message | undefined]>} A promise which resolves when the log has completed.
 */
function WriteToLogChannel(guildId, message) {
    console.log(`[${guildId}] ${message.replaceAll("\`\`\`", "\n")} `);

    const UnilogPromise = new Promise(res => {
        // Write to the UniLog. 
        if (UniLog[guildId] == undefined) UniLog[guildId] = [];
        UniLog[guildId].push(message);
        
        // Warning: May cause file corruption during times of high usage/when file cannot be written fast enough. (If Node is on Linux/a Multithreaded-writing system.)
        fp.writeFile("./UniLog.json", JSON.stringify(UniLog)).then(() => {
            res();
        });
    })

    const ServerLogPromise = new Promise(async res => {
        // Write to the server's log channel.
        const logChannel = await GetPolicy(guildId, "modchannel");
        if (logChannel != undefined) {
            const Log = await Index.client.channels.fetch(logChannel);
            // Send text while preventing mentions from pinging.
            let LastMessage = null;
            do {
                const splitLength = message.length > 2000 ? 2000 : message.length;
                const thisText = message.substring(0, splitLength);
                message = message.substring(splitLength);

                LastMessage = await Log.send(message, {
                    "allowed_mentions": { 
                        users: [], 
                        roles: [] 
                    }
                })
            } while (message.length != 0)

            res(LastMessage);
        } else res();
    })

    return new Promise(v => {
        Promise.all([UnilogPromise, ServerLogPromise]).then(x => {
            v(x);
        })
    })
}

// If we're on debug, test the logging after a little while.
if (Index.DEBUG)
    setTimeout(() => {
        WriteToLogChannel("762867801575784448", "Bot rebooted.").then(v => {
            console.log("Log test finished!");
        })
    }, 10000);

async function WriteToLogChannel(guildId, message) {
    const logChannel = await GetPolicy(guildId, "modchannel");
    if (logChannel != undefined) {
        const Log = await Index.client.channels.fetch(logChannel);
        // Send text while preventing mentions from pinging.
        Log.send(message, {
            "allowed_mentions": { 
                users: ['0'], 
                roles: ['0'] 
            }
        });
    }
}

module.exports = {
    ReloadSecurity, SaveSecurity, GetPolicy, SetPolicy, policies, policyTypes, policyHelp, WriteToLogChannel, HasPolicy
}