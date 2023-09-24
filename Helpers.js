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

module.exports = {countCharacter, CountCharactersInSections}