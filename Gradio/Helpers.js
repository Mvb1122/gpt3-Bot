const NonSplitTypes = "JPEG, PNG, WebP, AVIF, TIFF, GIF, SVG, JPG";
const types = NonSplitTypes.split(", ")
const http = require('https');
const fs = require('fs')
const Index = require ('../index.js');

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
 * @param {String} Plain The plaintext input.
 * @returns {{role: string;content: string;}[]} The message for the AI. 
 */
function GetMessageForGPTTalkingAboutTags(Plain, id = undefined) {
    let Messages = [
        {
            role: "system",
            content: "Danbuuru tags are a descriptor for the content of an image. For example, some tags are: 1boy, 1girl, absurdres, red, black, and several others.\nUse thighhighs instead of thighhigh_socks\nYou can emphasize a tag by surrounding it in parenthesis, like (absurdres). Make sure to include (absurdres) in all lists of tags.\nFor example, an image of a woman with large breasts, long hair, wearing a white dress with earings, on a simple background, would have the following tags: 1girl, absurdres, ((mature_female)), large_breasts, brown hair, long hair, white dress, earings, simple background\nFor women, use 1girl, (mature_female) plus any other tags. For men, use 1boy, (mature_male) and any other tags.\nAny tag you can think of works as one, pretty much.\nBe creative when writing tag lists! Please write a set of tags which coorespond to the given text on one line, seperated by commas, and with no other text. Given text: " + Plain + "\nRemember to be creative! "
        }
    ]

    const LowerCasePlain = Plain.toLowerCase();
    Object.keys(Index.PersonaArray).forEach(key => {
        if (LowerCasePlain.includes(key.toLowerCase()) || key == id) {
            Messages[0].content += ` ${Index.PersonaArray[key]}`
        }
    })

    // If they say "me," add them in.
    if (id != undefined && Index.PersonaArray[id] != undefined && !Messages[0].content.includes(Index.PersonaArray[id]) && LowerCasePlain.includes("me")) {
        Messages[0].content += ` ${Index.PersonaArray[id]}`
    }

    // Call me hitler but I don't like child porn.
    if (Plain.includes("child") && Plain.includes("penis")) 
        Messages[0].content = Messages[0].content.replaceAll("penis", "a fluffy cat") + " Please do not draw anything NSFW with children! In your tag list, please keep it safe."

    return Messages;
}

/**
 * Uses the Index's provided ChatGPT methods to summarize an image using a special prompt.
 * @param {String} Plain The plain text to tagify.
 * @returns {String} A peice of text saying what tags represent the passed string.
 * @see {Index.GetSafeChatGPTResponse}
 */
async function GetPromptsFromPlaintextUsingGPT(Plain, id = undefined) {
    let messages = GetMessageForGPTTalkingAboutTags(Plain, id)

    const ResponseFromGPT = (await Index.GetSafeChatGPTResponse(messages, null, null, false)).data.choices[0];
    /**
     * @type {String}
     */
    let response = ResponseFromGPT.message.content;

    console.log(ResponseFromGPT);
    
    return response.replaceAll("\n", ", ");
}

const {countCharacter} = require("../Helpers.js")

module.exports = {
    ImageIsValid, Download, countCharacter, GetPromptsFromPlaintextUsingGPT,
    NonSplitTypes, types
}