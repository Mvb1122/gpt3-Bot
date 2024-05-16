// Module for simplifying access to security policies.
const fp = require('fs/promises');

let Security = {
    1234: { /* Initial property is guildId */
        policies: {
            promptNSFW: true,
            bypassNSFW: [1234, 1234],
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

async function ReloadSecurity() {
    const ReloadedSecurity = JSON.parse(await fp.readFile("./Security.json"));

    // If we're losing something, then write a backup.
    if (Security != ReloadedSecurity && Security != {}) fp.writeFile("./Security_Backup.json", JSON.stringify(Security));

    Security = ReloadedSecurity;
}

/**
     * Fetches a policy from the security.
     * @param {number} gid GuildID
     * @param {String} policy PolicyName
     */
function GetPolicy(gid, policy) {
    if (typeof gid != String) throw new Error("Wrong paramter passed! gid should be typeof String.")

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
    if (Security[gid] == undefined) Security[gid] = {policies: {}}

    Security[gid].policies[policy] = value;
    return SaveSecurity();
}

module.exports = {
    ReloadSecurity, SaveSecurity, GetPolicy, SetPolicy
}