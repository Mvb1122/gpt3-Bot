// Module for simplifying access to security policies.
const fp = require('fs/promises');

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
    const ReloadedSecurity = JSON.parse(await fp.readFile("./Security.json"));

    // If we're losing something, then write a backup.
    if (Security != ReloadedSecurity) fp.writeFile("./Security_Backup.json", JSON.stringify(Security));

    fp.writeFile("./Security.json", JSON.stringify(Security));
}

function ReloadSecurity(backup = true) {
    return new Promise(async res => {
        const ReloadedSecurity = JSON.parse(await fp.readFile("./Security.json"));

        // If we're losing something, then write a backup.
        if (Security != ReloadedSecurity && Security != {} && backup) fp.writeFile("./Security_Backup.json", JSON.stringify(Security));

        Security = ReloadedSecurity;
        res();
    })
}
// Reload on boot.
ReloadSecurity(false);

/**
 * An array of the policies that the Security manager accepts.
 * @type {String[]}
 */
const policies = ["promptnsfw", "modrole","modchannel"];
/**
 * An array of strings that define what type each policy accepts.
 * @type {"boolean" | "RoleID" | "ChannelID"}
 */
const policyTypes = ["boolean", "RoleID", "ChannelID"];
const policyHelp = [
    "Enable NSFW Filtering",
    "The role who can bypass NSFW.",
    "The channel to log messages to."
];

if (!(policies.length == policyTypes.length && policies.length == policyHelp.length)) throw new Error("Security Policy type, Policy name, Policy help array length mismatch!");

/**
 * Fetches a policy from the security.
 * @param {string} gid GuildID
 * @param {"promptnsfw" | "modrole" | "modchannel"} policy PolicyName
 */
async function GetPolicy(gid, policy) {
    if (Security == {}) await ReloadSecurity(false);

    const GuildIDType = typeof(gid);
    if (GuildIDType != 'string') throw new Error("Wrong paramter passed! gid should be typeof String.")
        
    return Security[gid].policies[policy];
}

/**
     * 
     * @param {number} gid GuildID
     * @param {String} policy PolicyName
     * @param {*} value Policy value. Must be serializable.
     * @returns 
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

module.exports = {
    ReloadSecurity, SaveSecurity, GetPolicy, SetPolicy, policies, policyTypes, policyHelp
}