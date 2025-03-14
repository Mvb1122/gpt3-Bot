const NonSplitTypes = "JPEG, PNG, WebP, AVIF, TIFF, GIF, SVG, JPG";
const types = NonSplitTypes.split(", ")
const http = require('https');
const fs = require('fs')
const Index = require('../index.js');

/**
 * Tells you if the image is supported by sharp by file type.
 * @param {String} name The name of the file.
 * @returns True if its file extension is valid.
 */
function ImageIsValid(name) {
    for (let i = 0; i < types.length; i++) {
        if (name.includes(types[i].toLowerCase())) return true;
    }
    return false;
}

/**
 * @param {String} url The HTTPS url to download from.
 * @param {String} outputPath The path to download to.
 * @returns {Promise<String>} The path you downloaded to. May change if the file already exists.
 */
function Download(url, outputPath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(outputPath)) outputPath = outputPath.slice(0, outputPath.lastIndexOf('.')) + " (1)" + outputPath.slice(outputPath.lastIndexOf('.'));

        http.get(url, (response) => {
            const fileStream = fs.createWriteStream(outputPath);

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(outputPath)
            });
        }).on('error', (err) => {
            console.error('Error downloading file:', err.message);
            reject(err)
        });
    })
}

/**
 * Says whether a string contains a word at the start, end, or in the middle.
 * @param {String} word 
 * @param {String} string 
 */
function HasWordInString(word, string) {
    const WordRegex = new RegExp(`(\b|^)${word}(\b|$)`);
    return string.match(WordRegex) != null;
}

/**
 * @param {String} Plain The plaintext input.
 * @param {string} [id=undefined] UserID to include when first-person pronouns are used.
 * @param {boolean} [AllowAddedPersonas=true] Whether or not to allow extra personas to be pulled in.
 * @returns {{role: string;content: string;}[]} The message for the AI. 
 */
function GetMessageForGPTTalkingAboutTags(Plain, id = undefined, AllowAddedPersonas = true) {
    let Messages = [
        {
            role: "system",
            content: "Danbuuru tags are a descriptor for the content of an image. For example, some tags are: 1boy, 1girl, absurdres, red, black, and several others.\nUse thighhighs instead of thighhigh_socks\nYou can emphasize a tag by surrounding it in parenthesis, like (absurdres). Make sure to include (absurdres) in all lists of tags.\nFor example, an image of a woman with large breasts, long hair, wearing a white dress with earrings, on a simple background, would have the following tags: 1girl, absurdres, ((mature_female)), large_breasts, brown hair, long hair, white dress, earrings, simple background\nFor women, use 1girl, (mature_female) plus any other tags. For men, use 1boy, (mature_male) and any other tags.\nAny tag you can think of works as one, pretty much. If someone asks for a specific character, be sure to include the name and the franchise of the character. If the character has dark skin, use \`dark_skinned\` in your tags. If a name from a game, TV show, or other kind of visual non-OC media is passed, make sure it ends up in the final tag list in the format name_\(franchise\)\nDo not write name_\(Original Character\) or anything with the same meaning.\nIf two characters are asked for, you can use any numerated count, eg; 2girls; 1boy, 1girl; or 2boys. Make sure to listen to what's said about each individual character. Always use 2 girls when showing 2 girls. Always use 2boys when showing 2 boys.\nBe creative when writing tag lists! Please write a set of tags which coorespond to the given text on one line, separated by commas, and with NO OTHER TEXT.\RESPOND ONLY IN TAGS.\nRemember to be creative! "
        }, 
        {
            role: "user",
            content: `Please write me tags which describe this: ${Plain}`
        }
    ]

    // If we're not going to add in anything, just return what we've got so far.
    if (!AllowAddedPersonas) return Messages;

    // Otherwise, add ones which match.
    const LowerCasePlain = Plain.toLowerCase();
    Object.keys(Index.PersonaArray).forEach(key => {
        if (LowerCasePlain.includes(key.toLowerCase())) {
            Messages[0].content += ` ${Index.PersonaArray[key]}`
            if (Index.DEBUG)
                console.log(`Including ${key}`)
        }
    })

    // If they say "me," "my," or "I" add them in.
    if (id != undefined && Index.PersonaArray[id] != undefined && !Messages[0].content.includes(Index.PersonaArray[id]) && (HasWordInString("me", LowerCasePlain) || HasWordInString("my", LowerCasePlain) || HasWordInString("i", LowerCasePlain))) {
        Messages[0].content += ` ${Index.PersonaArray[id]}`
        if (Index.DEBUG)
            console.log("Including user's own persona.")
    }

    if (Index.DEBUG)
        console.log(Messages[0]);

    return Messages;
}

/**
 * Uses the Index's provided ChatGPT methods to summarize an image using a special prompt.
 * @param {String} Plain The plain text to tagify.
 * @returns {Promise<String>} A peice of text saying what tags represent the passed string.
 * @param {string} [id=undefined] The UserID to use when self-referencing.
 * @param {boolean} [AllowAddedPersonas=false] Whether to allow other personas to be pulled in.
 * @see {Index.GetSafeChatGPTResponse}
 */
async function GetPromptsFromPlaintextUsingGPT(Plain, id = undefined, AllowAddedPersonas = true) {
    let messages = GetMessageForGPTTalkingAboutTags(Plain, id, AllowAddedPersonas)

    const ResponseFromGPT = (await Index.GetSafeChatGPTResponse(messages, null, null, false)).data.choices[0].message;
    /**
     * @type {String}
     */
    let response = ResponseFromGPT.content;

    // Charge them.
    if (id)
        AddCostOfGPTTokens(id, encode(response).length);

    // Call me hitler but I don't like child porn.
    if (response.includes("child") && (response.includes("penis") || response.includes("sex") || response.includes("child_porn")))
        response = response.replaceAll("penis", "a fluffy cat").replaceAll("child", "adult") + " Please do not draw anything NSFW with children! In your tag list, please keep it safe."

    return response.replaceAll("\n", ", ");
}

/**
 * Returns a recommended CFG scale based off of how many tags are present, in order to enhance results with longer prompts.
 * @param {number} numTags Number of tags in image prompt.
 * @returns {number}
 */
function GetRecommendedCFGScale(numTags) {
    const scale = Math.min(7 + ((1 / 10) * numTags), 14);
    if (Index.DEBUG)
        console.log(`Recommended CFG scale for ${numTags}: ${scale}`);
    return scale;
}

const { encode } = require('gpt-3-encoder');
const { AddCostOfGPTTokens } = require('../Pricing.js');

module.exports = {
    ImageIsValid, Download, GetPromptsFromPlaintextUsingGPT,
    NonSplitTypes, types, GetRecommendedCFGScale,
}