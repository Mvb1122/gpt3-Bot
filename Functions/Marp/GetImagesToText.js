const ENABLED = true;
const google = require("@googleapis/customsearch");
const tokens = require("../../token");
const VoiceV2 = require("../../VoiceV2");
const fs = require('fs');
const searchCache = {};

google.auth.apiKey = tokens.GetToken("gImagesSearchApi");

const search = google.customsearch('v1');

/**
 * @param {String} prompt 
 * @returns {String}
 */
/* function MakeGetURL(prompt) {
    return `https://customsearch.googleapis.com/customsearch/v1?key=${tokens.GetToken("gImagesSearchApi")}&cx=${tokens.GetToken("gImagesSearchEngineId")}:omuauf_lfve&q=${encodeURIComponent(prompt)}&searchType=image`
}*/

/**
 * Searches with cache enabled.
 * @param {string} prompt
 * @returns {Promise<google.customsearch_v1.Schema$Search>} Search results.
 */
function Search(prompt) {
    return new Promise(async res => {
        if (prompt in searchCache) res(searchCache[prompt]);
        else {
            const params = {
                cx: tokens.GetToken("gImagesSearchEngineId"),
                q: prompt,
                auth: tokens.GetToken("gImagesSearchApi"),
                searchType: "image"
            };
            /*
            const params = {
                api_key: tokens.GetToken("serpapi"),
                engine: "google_images",
                google_domain: "google.com",
                q: prompt,
                hl: "en",
                gl: "us",
                ijn: "15", // Limit to 15 results.
                safe: "off",
                filter: "0"
            };

            searchEngine.json(params, (json) => {
                searchCache[prompt] = json;
                console.log(json);
                res(json);
            });
            */

            // Fetch the images from google.
            /*
            const url = MakeGetURL(prompt);
            const json = await (await fetch(url)).json();
            */

            const json = (await search.cse.list(params)).data;
            searchCache[prompt] = json;
            res(json);
        }
    });
}

const NoResultsText = "DO NOT USE ANY IMAGES NOT EXPLICTLY MENTIONED.";
module.exports = async function FetchImagesToCaptionList(prompt) {
    if (!ENABLED || tokens.GetToken("serpapi") == "") return NoResultsText;

    // Make a call to the serpapi to search up images. Then, caption them with minimal detail.
    const searchData = await Search(prompt);
    
    // See if there's images listed.
    if (!searchData.items) return NoResultsText;
    else {
        // We have images! Run through and caption them.
        const images = await Promise.all(searchData.items.map(async v => {
            // Use the thumbnail for captioning since it's faster.
                // Low detail caption.
            const caption = await VoiceV2.Caption(v.image.thumbnailLink, "<CAPTION>");

            return {
                caption: caption,
                url: v.link,
                title: v.title
            }
        }));

        // Reduce the images list into a single result.
        const result = images.map((v) => {
            return `- ${v.title} - ${v.caption}: ${v.url}`;
        }).join("\n");
        return result;
    }
}