const PricePerToken = 0.0000005;

const fp = require('fs/promises');
const fs = require('fs')
const path = require('path');
const { fetchRootBase, client } = require('.');

/**
 * Fetches the User's file as a JSON object.
 * @param {string} userId The UserID of the user's data to fetch.
*/
async function GetUserFile(userId, IncludeRootBase = true) {
    const Path = path.resolve(`./users/${userId}_Base.json`);
    let RootBaseAtStart = await fetchRootBase(userId);
    let file = {
        base: "",
        persona: "",
        cost: {
            // "8/4/23": 0.03
        },

        /**
         * Saves the file to disc.
         */
        sync() {
            this.base = this.base.replaceAll(RootBaseAtStart, "");
            return fp.writeFile(Path, JSON.stringify(this));
        }
    };

    if (fs.existsSync(Path)) {
        const fileT = JSON.parse(await fp.readFile(Path));
        Object.keys(fileT).map((value) => {
            file[value] = fileT[value];
        })
    }

    if (IncludeRootBase) {
        file.base = RootBaseAtStart + file.base
    }

    return file;
}

function GetCurrentDate() {
    const date = new Date();
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

async function AddCostOfGPTTokens(userId, tokencount) {
    const file = await GetUserFile(userId);
    // console.log(`Adding cost of ${tokencount} to ${userId} | Date: ${GetCurrentDate()} | Current: ${file.cost[GetCurrentDate()]}`)
    file.cost[GetCurrentDate()] = (file.cost[GetCurrentDate()] ?? 0) + GetCostOfNTokens(tokencount);
    return file.sync();
}

function GetCostOfNTokens(tokencount) {
    return tokencount * PricePerToken;
}

module.exports = {
    GetUserFile, GetCurrentDate, AddCostOfGPTTokens, GetCostOfNTokens,
}