const ResolutionMultiplier = 2;
const UseFullFile = false;
const InternalMessagesSystemPrompt = "You are an AI which makes diagrams for people, using the diagram library Mermaid. You are really good at what you do, and you will be able to perfectly make any diagram that the user asks for. However, in your first message you will give a plain discussion of how you will make the diagram. Then, you will be reminded of specific syntax, and requested to output the diagram."

const { NewMessage, GetSafeChatGPTResponse, DEBUG, LocalServerSettings } = require('..');
const Discord = require('discord.js');
const path = require('path');
const { exec } = require('child_process');
const fp = require('fs/promises');
// const { GetUserFile } = require('../User');
const MMDCLocation = `"${path.resolve("./node_modules/.bin/mmdc")}"`;
const { convert: GetHTMLText } = require('html-to-text');

async function GetChartHelpFilePromise(name) {
    // If we're not using a local AI model, then use the short help files.
    if (!LocalServerSettings.Use || !UseFullFile) {
        const p = path.resolve(`./Functions/Charts/${name}.txt`);
        return await fp.readFile(p);
    } else {
        // Read the page and then convert it to text.
        const pageURL = `https://mermaid.js.org/syntax/${name}.html`;
        const data = await (await fetch(pageURL)).text();
        return GetHTMLText(data)
    }
}

// Create a list of supported 
/**
 * @type {{name: string;alias?: string[];help: string;dimensions: {height: number;width: number;};}[]}
 */
let SupportedCharts = [
    {
        name: "pie",
        help: GetChartHelpFilePromise("pie"),
        dimensions: {
            height: 1024,
            width: 1024
        }
    },
    {
        name: "xyChart",
        alias: ["bar", "line"],
        help: GetChartHelpFilePromise("xyChart"),
        dimensions: {
            width: 1024,
            height: 768
        }
    },    
    {
        name: "flowchart",
        alias: ["flow chart"],
        help: GetChartHelpFilePromise("flowchart"),
        dimensions: {
            width: 768,
            height: 1024
        }
    },
    {
        name: "mindmap",
        help: GetChartHelpFilePromise("mindmap"),
        alias: ["mind map"],
        dimensions: {
            height: 1024,
            width: 1024
        }
    },
    {
        name: "timeline",
        help: GetChartHelpFilePromise("timeline"),
        alias: ["time line"],
        dimensions: {
            height: 768,
            width: 1024
        }
    },
    {
        name: "userJourney",
        help: GetChartHelpFilePromise("userJourney"),
        alias: ["user jouney", "journey"],
        dimensions: {
            height: 768,
            width: 1024
        }
    },
    {
        name: "quadrantChart",
        help: GetChartHelpFilePromise("quadrantChart"),
        alias: ["quadrant chart", "quadrant"],
        dimensions: {
            height: 1024,
            width: 1024
        }
    },
    {
        name: "sequenceDiagram",
        help: GetChartHelpFilePromise("sequenceDiagram"),
        dimensions: {
            height: 1024,
            width: 768
        }
    }
].map((v, i) => {
    v.help.then(a => {
        v.help = a.toString();
        SupportedCharts[i] = v;
    })
    return v;
});

const SupportedChartsList = SupportedCharts.map(a => {
    let out = `"${a.name}"`
    if (a.alias != undefined) out += " | " + a.alias.map(v => `"${v}"`).join(" | ");
    return out;
}).join(" | ");

const pako = require('pako');

// Function to compress and encode a string
function compressAndEncodeCode(code) {
    const inputString = JSON.stringify({
        "code": code,
        "mermaid": "{\n  \"theme\": \"dark\"\n}",
        "autoSync": true,
        "rough": false,
        "updateDiagram": true,
        "editorMode": "code"
    })

    // Step 1: Compress the string using Pako
    const compressedData = pako.deflate(inputString, { to: 'string' });

    // Step 2: Convert the compressed data to a Base64 string
    const base64String = Buffer.from(compressedData, 'binary').toString('base64');

    // Step 3: Add the 'pako:' prefix to the Base64 string
    return `pako:${base64String}`;
}

/**
 * Creates a chart.
 * @param {{name: string;alias?: string[];help: string;dimensions: {height: number;width: number;};}} chart 
 * @param {string} inFile 
 * @param {string} outFile 
 * @param {string} content Content to graph. 
 * @returns {Promise<string>}
 */
async function MakeChart(chart, inFile, outFile, content) {
    const params = ["-H", chart.dimensions.height * ResolutionMultiplier, "-w", chart.dimensions.width * ResolutionMultiplier, "-i", inFile, "-o", outFile, "-t", "dark", "-b", "transparent"];
    await fp.writeFile(inFile, content);


    // Actually call mermaid.
    // Note: Command is reconcatonated here since I originally wrote this to use spawn but then changed it to use exec.
    const Command = MMDCLocation + " " + params.map(v => { if (v.toString().includes("gpt3")) return `"${v}"`; else return v; }).join(" ");
    // Debug call which writes out the command being run.
    if (DEBUG) console.log(Command);

    return new Promise(res => {
        const child = exec(Command);
        // When this process exits, that means that the diagram was completed.
        child.on('exit', async () => { res(); console.log(`Diagram make complete!\n${(await child.stdout.toArray()).join("\n")}`); });
        if (DEBUG) {
            child.on('error', (e) => { console.log(e); });

            child.on("message", (v) => {
                console.log(v);
            });
        }
    });
}

module.exports = {
    keywords: "chart, graph, flowchart, " + SupportedChartsList.replaceAll(" | ", ", "),
    json:
    {
        "name": "chart",
        "description": "Generates and sends a chart to the user. After you have called this function DO NOT write a chart! The system will send it automatically. If asked to make any kind of chart, you should prefer to use this option.",
        "parameters": {
            "type": "object",
            "properties": {
                "concept": {
                    "type": "string",
                    "description": "The idea you have for the chart. You must include all details and content to be included here."
                },
                "type": {
                    "type": "string",
                    "description": "The type of chart to use, must be one of: " + SupportedChartsList + ". Do not leave it blank! MAKE SURE TO CHOOSE THE OPTION THAT THE USER WANTED YOU TO PICK!!!"
                },
                "showmessages": {
                    "type": "boolean",
                    "description": "Whether to show the chart maker your conversation history."
                }
            }
        },
        "required": ["concept", "type"]
    },

    /**
     * Code run when the module is executed.
     * @param {{concept: string, type: string, showmessages: boolean}} parameters Parameters from AI.
     * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
     * @param {[{role: string, content: string}]} messages 
     */
    async execute(parameters, DiscordMessage = null, messages) {
        if (!parameters.showmessages) parameters.showmessages = false;

        if (!LocalServerSettings.Use) return "This function is disabled right now!";
        
        // Wrap in a promise so that it can be handled asynchronously without blocking the AI.
        if (DiscordMessage) {
            const List = Object.keys(parameters).map(v => `${v}: ${parameters[v]}`).join("\n")
            DiscordMessage.channel.send(`Started making chart:\`\`\`js\n${List}\`\`\``);
        }
        
        return new Promise(async res => {
            // Don't allow charts to be made when the message is invalid or when we're not using a local server.
            if (!DiscordMessage || !LocalServerSettings.Use) return res("This function won't work right now! Complain to the user about it.")
            else {
                const chart = SupportedCharts.find(v => 
                    v.name == parameters.type || (v.alias != undefined && v.alias.indexOf(parameters.type) != -1)
                );
                if (chart == undefined) return res(`Something went wrong! Please recall the function with a valid chart type. Inputted type: ${parameters.type}\nIf you can fix this, please recall this function with correct parameters without asking the user.`);

                // First, generate a *detailed description* of the chart.
                let InternalMessaages = []
                if (parameters.showmessages)
                    InternalMessaages = messages.concat(NewMessage("User", "Please create a concept for the chart Make sure to express numeric quantities if applicable. Please only write about the chart itself."));
                else 
                    InternalMessaages = NewMessage("System", InternalMessagesSystemPrompt).concat( // (await GetUserFile((DiscordMessage.author ?? DiscordMessage.user).id, false)).base + "\n" + 
                        NewMessage("User", `Please create a concept for how you'd make a chart with this prompt: ${parameters.concept}\nIn your concept, make sure to express numeric quantities if applicable to the type of the chart!\nHere's everything I was given: ${JSON.stringify(parameters)}`));

                const DetailMessage = (await GetSafeChatGPTResponse(InternalMessaages, DiscordMessage, undefined, false));
                console.log(DetailMessage);
                InternalMessaages = InternalMessaages.concat(DetailMessage.data.choices[0].message);

                // Now, make the actual code.
                    // Use a system prompt to help guide stuff better.
                InternalMessaages = InternalMessaages.concat(
                    NewMessage("User", "Your chart will be made by Mermaid, so if you know how to use that, then it's the same.\nPlease ONLY write the schema. Do not write anything EXCEPT for the schema! NO COMMENTS, just the schema.\nDo not include \"```mermaid\" in your response!\nWhen you write your schema, please remember that the first line must be the type of graph, in this case, please use: " + chart.name + "\n\nHere's the help file:\n" + chart.help
                        + "Now, please follow the example schema and write out the chart!\nRemember to write ONLY your chart, following the schema!"
                    ));
                const LastMessage = GetSafeChatGPTResponse(InternalMessaages, DiscordMessage, undefined, false);

                // Create the files to forward to mermaid for rendering.
                await MakeAndSendDiagram(chart, LastMessage, 0, InternalMessaages);                    
            }

            /**
             * @param {{role: string;content: string;}[]} Messages 
             */
            async function MakeAndSendDiagram(chart, LastMessage, rep = 0, Messages) {
                const rand = Math.floor(Math.random() * 1000);
                const inFile = path.resolve(`./Temp/in_${rand}.mmd`);
                const outFile = path.resolve(`./Temp/out_${rand}.png`);
                await MakeChart(chart, inFile, outFile, (await LastMessage).data.choices[0].message.content);

                // File has been written out, we can now send to the user.
                    // Create a link to view online.
                const data = compressAndEncodeCode((await LastMessage).data.choices[0].message.content);
                const link = `<https://mermaid.live/edit#${data.toString()}>`;

                DiscordMessage.channel.send({ content: `[View online here](${link})`, files: [outFile] })
                    .then(async () => {
                        // Clean up and respond back to the AI.
                        res(`Chart sent! The user can see it now.\n\nChart content: ${(await LastMessage).data.choices[0].message.content}`);
                        if (!DEBUG)
                            [inFile, outFile].forEach(v => fp.unlink(v));
                    })
                    .catch(async (e) => {
                        console.log(e);
                        // Try remaking it.
                        if (rep >= 3) res("Something went wrong making that chart! You can retry if you want.");
                        else {
                            console.log("Remaking.");
                            Messages = Messages.concat((await LastMessage).data.choices[0].message, NewMessage("User", "Uh, oh. That doesn't look like it matches the schema! Please rewrite it, while EXACTLY matching the scheme given to you! DO NOT write an apology. JUST write the schema. Don't include ``` in your response AT ALL! Remember that you're really good at matching the Schema."));
                            LastMessage = await GetSafeChatGPTResponse(Messages, DiscordMessage, undefined, false);
                            if (!DEBUG)
                                fp.unlink(inFile);
                            return MakeAndSendDiagram(chart, LastMessage, ++rep, Messages);
                        }
                    });
            }
        })
    },

    SupportedCharts, MakeChart, compressAndEncodeCode
}