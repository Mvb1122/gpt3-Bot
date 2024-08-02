const fs = require('fs');
const tokens = JSON.parse(fs.readFileSync("./token.json"));

module.exports = {
    /**
     * Gets a token from the token.json file.
     * @param {String} service The service to look for.
     * @returns The respective token.
     */
    GetToken(service) {
        return tokens[service];
    }
}