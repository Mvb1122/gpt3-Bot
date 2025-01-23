const fp = require('fs/promises');
const fs = require('fs')
const path = require('path');
const { LocalServerSettings } = require('.');
const FunctionCallingBasesDir = path.resolve("./FunctionCallingBases/");

const rootBase = "You will only call a function with a given value once. The user's name is given by the words in the parenthesis at the start of a message. DO NOT write names into your messages unless requested to do so by a user. You can use the `think` command to think things. Use it accordingly when you need to remember something before telling the user. When asked math questions with computable answers, you may use EVAL to run JavaScript code to get the answer."
const FunctionEndMessage = "Your current available functions are:"
let FunctionCallingRootBase = ""

if (LocalServerSettings.Use) {
    async function SetModel() {
        const v = await LocalServerSettings.model;
        if (v.includes("70B"))
            FunctionCallingRootBase = fs.readFileSync(`${FunctionCallingBasesDir}/Llama70BFunctionCallingRootBase.txt`) + FunctionEndMessage
        else if (LocalServerSettings.FunctionCalls == 'teach') // Teach non-supported models how to call functions.
            FunctionCallingRootBase = fs.readFileSync(`${FunctionCallingBasesDir}/FunctionCallingRootBase.txt`) + FunctionEndMessage
        
        // If there's no function teaching needed, leave it empty.
        else 
            FunctionCallingRootBase = ""
    }
    SetModel();
}

async function fetchRootBase(id = null) {
    const now = new Date();
    const minutes = now.getMinutes().toString();

    let temp = LocalServerSettings.Use ? FunctionCallingRootBase : rootBase;
    temp = `\nThe current time is ${GetCurrentDate()} at ${now.getHours() + 1}:${minutes.length == 1 ? "0" + minutes : minutes}.` + temp;

    // if (id != null) temp += `The current user is ${(await client.users.fetch(id)).username}!`

    return temp;
}

/**
 * Fetches the User's file as a JSON object.
 * @param {string} userId The UserID of the user's data to fetch.
*/
async function GetUserFile(userId, IncludeRootBase = true) {
    const Path = path.resolve(`./users/${userId}_Base.json`);
    let InitialRootBase = await fetchRootBase(userId);
    let file = {
        base: "",
        base_face: "",
        base_name: "",
        cost: {
            // "8/4/23": 0.03
        },

        /** The content of the currently active persona. */
        persona: "",
        persona_face: "",
        
        /** @type {{name: string;content: string;face: string;}[]} */
        personas: [],

        /**
         * Saves the file to disc.
         */
        sync() {
            this.base = this.base.replaceAll(InitialRootBase, "");
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
        file.base = file.base + InitialRootBase;
    }

    return file;
}

function GetCurrentDate() {
    const date = new Date();
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

module.exports = {
    GetUserFile, GetCurrentDate, fetchRootBase, FunctionEndMessage
}