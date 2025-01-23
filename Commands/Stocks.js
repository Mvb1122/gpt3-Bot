const PredictionLength = 14;
/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data here. Occurs after all commands loaded.)
3. Command activated. (execute and OnMessageRecieved work now.) 
*/


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, VoiceState } = require('discord.js');
const path = require('path');
const tokens = require("../token");
const fp = require('fs/promises');
const { Predict } = require('../VoiceV2');
const { MakeChart, SupportedCharts, compressAndEncodeCode } = require('../Functions/Chart');
const { DEBUG } = require('..')

/**
 * @type {Promise<import('@polygon.io/client-js').IRestClient>}
 */
let polygon = new Promise(async res => {
    const { restClient } = await import('@polygon.io/client-js');
    res(restClient(tokens.GetToken("Polygon_IO_API_Key"), "https://api.polygon.io", {
        // Instruct to always grab all avail. information: 
        // pagination: true
            // Must be turned off; if turned on, api will instantly hit rate limit.
    }));
});
/**
 * @type {Promise<[import('@polygon.io/client-js').UniversalSnapshotInfo]>}
 */
let tickers = new Promise(async res => {
    // Uses the polygon api to fetch a list of all the tickers.
    /** @type {[import('@polygon.io/client-js').UniversalSnapshotInfo]} */
    let out = [];

    if (DEBUG) res(out);

    /**
     * @type {Promise<import('@polygon.io/client-js').ITickers>}
     */
    let part = await (await polygon).reference.tickers({
        market: "stocks",
        active: true,
        exchange: "XNAS", // Nasdaq for biggest companies?? I don't know how stocks work.
        limit: 1000 // Max ammount allowed by api. 
    });
    out = out.concat((await part).results);

    while ((await part).next_url) {
        try {
            const url = `${(await part).next_url}&apiKey=${tokens.GetToken("Polygon_IO_API_Key")}`;
            // Fetch. 
            const request = await fetch(url);
            
            if (request.status >= 200 && request.status < 300) {
                const thisPart = await (request).json()
                out = out.concat((await thisPart).results);
                part = thisPart;
                // Wait for 15 seconds to avoid the ratelimit.
                await new Promise(res => setTimeout(res, 15000));
            }
        } catch {
            // Will retry after waiting 30 seconds to avoid the ratelimit extra hard.
            await new Promise(res => setTimeout(res, 30000)); 
        }
    }

    res(out);
});

module.exports = {
    // Can be swapped for another CommandBuilder and the system will handle it.
    data: new SlashCommandBuilder()
        .setName('stocks')
        .setDescription("Predicts stock prices for the following N days.")
        .addStringOption(option => {
            return option.setName("ticker")
                .setDescription("The stock ticker to predict.")
                .setRequired(true)
                .setAutocomplete(true);
        })
        .addNumberOption(option => {
            return option.setName("days")
                .setDescription("Number of days to predict.")
                .setMinValue(1)
                .setMaxValue(30)
        })
        .addBooleanOption(option => {
            return option.setName("showall")
                .setDescription("Whether to show all predictions the computer made.")
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        // Fetch past values.
        const name = interaction.options.getString("ticker");
        const days = interaction.options.getNumber("days") ?? PredictionLength;
        const showAllLines = interaction.options.getBoolean("showall") ?? false;

        const now = Date.now();
        const timeAgo = now - 300 * 24 * 60 * 60 * 1000;
        const past = await (await polygon).stocks.aggregates(name, 1, "day", timeAgo, now);

        // Write to a temp file and return it.
        const data = "item_id,timestamp,target\n" + 
            past.results
                .map(v => {
                    const date = new Date(v.t);
                    const formattedDate = GetFormattedDate(date);
                    return `${name},${formattedDate},${v.c}`;
                })
                .join("\n");

        const tempPath = path.resolve("./Temp/" + name + ".csv");
        await fp.writeFile(tempPath, data);
        
        const output = interaction.editReply({
            content: `Here's the data so far for ${name}. Prediction will be run shortly.`,
            files: [tempPath]
        });

        // Predict.
        const outPath = tempPath.replace(".csv", "_out.csv");
        await Predict(tempPath, outPath, days);
        const predictedData = fp.readFile(outPath);

        // Draw a graph.
        const tempChartPath = path.resolve("./Temp/" + name + "_graph.mmd")
        const tempImagePath = path.resolve("./Temp/" + name + "_graph.png")

        // Create X-Axis (Dates)
        const DayMultiplierVals = []
        for (let i = -days; i <= days; i++) {
            DayMultiplierVals.push(i);
        }

        const dates = DayMultiplierVals.map(v => {
            // Does date from v days from now.
            const timeAgo = now + v * 24 * 60 * 60 * 1000;
            const thisDay = new Date(timeAgo);
            return `${thisDay.getUTCDate()}`; // ${thisDay.getUTCMonth() + 1}-
        }).map((v, index, a) => {
            for (let i = 0; i < index; i++) if (a[i] == v) v += "‍"; // Zero width joiner makes the numbers not deduplicate without changing visuals. 

            return `"${v}"`
        });
        
        // Collate line real and predicted values.
        const linePredicted = [];
        const lineReal = [];

        // Fill the first seven values with the last seven values from the real data.
        const realLength = days;
        const offsetForReal = past.results.length - realLength;
        for (let i = 0; i < days; i++) {
            const val = past.results[offsetForReal + i];
            lineReal.push(val.c);
            linePredicted.push(val.c);
        }

        // Fill the last seven values with all values from the predicted Data
            // Column order is Symbol, Timestamp, Mean, [0.1 - 0.9 predicted ranges.]
        const fileWhole = (await predictedData).toString();
        const header = fileWhole.split('\n')[0].split(',');
        const lines = fileWhole.split('\n').slice(1).map(line => {
            return line.split(',').map((value, i) => {return [header[i], value.trim()]});
        });

        // Fill line predicted with mean values.
        const lineBottom = linePredicted.concat([]);
        const lineTop = linePredicted.concat([]);
        const midLines = [[]];
        if (showAllLines)
            for (let i = 5; i < 11; i++) midLines[i] = linePredicted.concat([]);
        lines.forEach(v => {
            try {
                linePredicted.push(v[3][1]);
                lineBottom.push(v[4][1]);
                lineTop.push(v[11][1]);

                if (showAllLines)
                    for (let i = 5; i < 11; i++) midLines[i].push(v[i][1]);
            } catch {
                // Do nothing. This is a weird line.
            }
        });

        // Create min and max.
        let min = Number.MAX_SAFE_INTEGER;
        let max = Number.MIN_SAFE_INTEGER;
        [linePredicted, lineBottom, lineTop].flat().forEach(val => {
            if (val > max) max = val;
            else if (val < min) min = val;
        });

        const RangeBuff = 10;
        // Write out the file.
        const ChartFile = `xychart-beta\n\tTitle "${name} Stock Prediction"\n\tx-axis [${dates}]\n\ty-axis "Price" ${min - RangeBuff} --> ${max + RangeBuff}\n\tline [${linePredicted}]\n\tline [${lineBottom}]\n\tline [${lineTop}]\n\t${showAllLines ? "bar" : "line"} [${lineReal}]\n\t` + (showAllLines ? midLines.filter(v => v.length != 0).map(v => `line [${v.join(", ")}]`).join("\n\t") : "");
        const chart = SupportedCharts.find(v => v.name == "xyChart");
        /*
        chart.dimensions ={
            height: 768,
            width: 1250
        }
        */

        await MakeChart(chart, tempChartPath, tempImagePath, ChartFile);

        const encoded = compressAndEncodeCode(ChartFile);
        const link = `<https://mermaid.live/edit#${encoded.toString()}>`;

        await (await output).reply({
            content: `Here's the predicted output. I only predicted ${days} days.${link.length <= 1500 ? ` [Link to graph](${link})` : ""}`,
            files: [outPath, tempImagePath]
        });

        // Delete all files.
        // [tempPath, outPath, tempChartPath, tempImagePath].forEach(v => fp.unlink(v));
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: true,

    /**
     * @param {AutocompleteInteraction} interaction The Autocomplete request.
     */
    async OnAutocomplete(interaction) {
        // Get active embeddings.
        const choices = (await tickers).map(ticker => {
            const name = ticker.name.substring(0, 100);
            const label = ticker.ticker

            return {
                name: name,
                value: label
            };
        })
        
        // Get what the user has currently typed in.
        const stringValue = interaction.options.getFocused();
        
        // Filter to just matching ones. Also, cut off if we have more than twenty responses.
		let filtered = choices.filter(choice => choice.name.toLowerCase().trim().startsWith(stringValue.toLowerCase()) || choice.value.toLowerCase().trim().startsWith(stringValue.toLowerCase()));
        if (filtered.length > 20) filtered = filtered.slice(0, 20);
		
        // Send back our response.
        await interaction.respond(filtered);
    }
}

function GetFormattedDate(date) {
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const formattedDate = `${date.getUTCFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return formattedDate;
}
