const fs = require('fs');
const tokens = JSON.parse(fs.readFileSync("./token.json"));

module.exports = {
    /**
     * discord | openai | openweathermap | serpapi
     * @param {String} service The service to look for.
     * @returns The respective token.
     */
    GetToken(service) {
        return tokens[service];
    }
}