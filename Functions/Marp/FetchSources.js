const ReadPage = require("../ReadPage");
const WikipediaIntro = require("../WikipediaIntro");
const google = require("@googleapis/customsearch");
const search = google.customsearch('v1');
const tokens = require("../../token");
const { NewMessage, GetSafeChatGPTResponse } = require("../..");
const Scrape = require("./Scrape");
const JSONMatchRegex = new RegExp(/\{(.|[\n\t])*\}/gm);

const exampleResponseData = JSON.stringify({
    entries: [1, 2, 3, 4]
});

/**
 * Searches up the title and returns all 
 * @param {string} topic 
 * @param {boolean} wikiOnly
 * @param {[{role: String, content: String}]} messages
 * @returns {Promise<[{title: string, text: string, link: string}]>}
 */
module.exports = async function Fetch(topic, wikiOnly = false, messages = []) {
    // Just fetch the whole wikipedia article.
        // First, get the correct title.
    if (wikiOnly) {
        /**
         * @type {{batchcomplete: boolean; query: {normalized: [{fromencoded: boolean; from: string; to: string}]; pages: [{pageid: number; ns: number; title: string}]}}}
         */
        const result = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srsearch=${encodeURIComponent(topic)}`)).json();
        const fixedName = result.query.search[0].title;

            // Then get the full article.
        const text = (await ReadPage.execute({ url: `https://en.wikipedia.org/w/index.php?title=${fixedName}&action=raw`, skipLimit: true}))
        // If the article is short, send the whole thing.
        if (text.length <= 5000)
            return [{
                title: `${fixedName.replaceAll("_", " ")} - Wikipedia`,
                text: text.replaceAll("\\n", "\n"),
                link: `https://en.wikipedia.org/wiki/${fixedName}`
            }];
        else {
            // Just send back the intro.
            return [{
                title: `${fixedName.replaceAll("_", " ")} - Wikipedia`,
                text: JSON.parse(await WikipediaIntro.execute({ Query: fixedName })).extract,
                link: `https://en.wikipedia.org/wiki/${fixedName}`
            }];
        }
    } else {
        // Okay here's the idea:
            // Use GSearch to get a list of articles.
        const params = {
            cx: tokens.GetToken("gImagesSearchEngineId"),
            q: topic,
            auth: tokens.GetToken("gImagesSearchApi"),
            // searchType: "image" Removing this makes it a text search.
        };

        /**
         * @type {google.customsearch_v1.Schema$Search}
         */
        const json = (await search.cse.list(params)).data;
            // Have AI choose up to 5 to read.
        const titles = json.items.map((v, i) => `#${i}: ${v.title}`).join("\n");
        
        const internalMessages = [].concat( // messages
            NewMessage("System", `You are an assistant who chooses articles for research. You will read a list of titles and decide which pages to read. Your answer MUST END WITH a JSON object in the followiong format: \n` + exampleResponseData + "\nYou may only choose up to 5 articles to read."),
            NewMessage("User", `Please choose which of the below article titles would be best for covering the topic of ${topic}. Here are the articles to choose from:\n` + titles + "\n\nMake sure to answer with the JSON object.")
        );
        
        /**
         * @type {{entries: number[]}}
        */
       let answer = null;
       do {
           const resp1 = await GetSafeChatGPTResponse(internalMessages, null, 0, false);
           const response = resp1.data.choices[0].message.content;
           
           // Parse out the response.
            try {
                answer = JSON.parse(response.match(JSONMatchRegex)[0]);
            } catch {
                // Ask the AI to regenerate again.
            }
        } while (answer == null);
        
            // Return all texts back to the AI.
        const result = await Promise.all(answer.entries.map(async v => {
            const searchObj = json.items[v];
            // Read each article using the Scrape.js thing.
            const link = searchObj.link;
            const text = await Scrape(link);
            return {
                title: searchObj.title,
                text: text,
                link: searchObj.link
            };
        }));
        
        // console.log(result);

        return result;
            // Add sources to a final slide.
                // Sources -> slide will take place in the main present file.
    }
}

/*
module.exports("Internal Combustion Engine", false).then(result => {
    console.log(result);
}).catch(error => {
    console.error(error);
});
*/