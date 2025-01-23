const unfluff = require("unfluff");

/**
 * Fetches the text of an article in a more robust way.
 * @param {string} URL 
 * @returns {Promise<string>}
 */
module.exports = async function Fetch(URL) {
    // Download the HTML, then use unfluff to get the text.
    const data = await (await fetch(URL)).text();
    const extracts = unfluff(data);
    // console.log(extracts.text);
    return extracts.text;
}