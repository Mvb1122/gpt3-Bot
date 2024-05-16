/**
 * @param {String} str The string to count through.
 * @param {String} char The character to look for.
 * @returns The number of times that character shows up.
 */
function countCharacter(str, char) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === char) {
            count++;
        }
    }
    return count;
}

/**
 * Counts the number of times a character appears in text as split by a splitter.
 * @param {String} string 
 * @param {String} char 
 * @param {String | RegExp} Spliter 
 * @returns {[Number]} The number of occurances.
 */
function CountCharactersInSections(string, char, Spliter = "\n") {
    const lines = string.split(Spliter);
    let outputs = [];
    lines.forEach(line => {
        outputs.push(countCharacter(line, char))
    })
    return outputs;
}

const HandlerFactory = require("./HFAIModelHandler")
const handler = HandlerFactory.CreateModelHandler("AdamCodd/distilroberta-nsfw-prompt-stable-diffusion", "text-classification", { topk: null })

/**
 * Uses an AI to judge how NSFW tags are.
 * @param {String} tags AI Tags to judge.
 * @returns {Promise<{ label: "NSFW" | "SFW"; score: number; }[]>}
 */
async function JudgeNSFWTags(tags) {
    return handler.Run(tags);
}

module.exports = {countCharacter, CountCharactersInSections, JudgeNSFWTags}