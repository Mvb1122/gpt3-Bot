//#region Imports and Constants
const Discord = require('discord.js');
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: "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",
});
const openai = new OpenAIApi(configuration);
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMembers
  ],
});
const BaseAddress = "./ActiveBases.json";
const RecoveryAddress = "./RecoveryBases.json"
const DiscordToken = 'ODQ1MTU5MzkzNDk0NTY0OTA0.YKc6BQ.DM7TULY8QHqx96svmKoNb0o2EI4';
const DiscordClientId = "845159393494564904";
// const DiscordSupportServerId = "762867801575784448";
const DEBUG = false;
//#endregion

// const rootBase = "Connie Pedersen's and the extremely-cute Micah Bushman's pronouns are she/her. Micah is a 17-year-old trans girl living in Albuquerque, New Mexico, who enjoys reading Manga and studying Japanese. On weekdays, she goes to school, where she suffers through AP Physics, AP US History, and AP Psychology. She's also taking Japanese at the CEC. Micah programmed this AI to help her with her homework. Rilen, aka ConerBearBeats, is one of Connie's and Micah's old friends. They used to be friends in real life, but now only chat via the internet.\n";

const ListOfIDsAllowedToUseTheMemoryOnVersion = [303011705598902273n, 733343607339352126n, 322906020844142592n]
function IsUserIDInList(id) {
  for (let i = 0; i < ListOfIDsAllowedToUseTheMemoryOnVersion.length; i++)
    if (ListOfIDsAllowedToUseTheMemoryOnVersion[i] == id)
      return true;
  return false;
}

// Load conversation from last boot, or use the rootBase if unavailable. 
/*
let base;
try {
  base = unescape(require('./base.json').string);
} catch (e) {
  base = rootBase;
}
console.log(base);
*/


//#region ChatGPT Modules
// Implement [EVAL, CODE] command.
// #region EVAL
const IllegalCommands = ['fs', 'console.log', 'process.exit(']
async function EVAL(parameters, message) {
  let response = {
    "response": "sucessful"
  }

  for (let i = 0; i < IllegalCommands.length; i++) {
    if (parameters.CODE.includes(IllegalCommands[i])) {
      response.response = `The AI is not allowed to use ${IllegalCommands[i]}!`;
      return response.response.toString();
    }
  }

  try {
    if (DEBUG)
      console.log(`\nEvaluating: ${parameters.CODE}\n`);
    SendMessage(message, "Evaluating: ```js\n" + parameters.CODE + "```")
    try {
      response.response = await eval(parameters.CODE);
    } catch (e) {
      response.response = JSON.stringify({
        sucessful: false,
        resason: e.cause
      })
    }
    if (typeof response.response === 'object') response.response = JSON.stringify(response.response);
    SendMessage(message, "Response: " + response.response);
    response.sucessful = true;
  } catch (e) {
    response.response = e.toString();
    response.sucessful = false;
  }

  // return JSON.stringify(response);
  return response.response.toString();
}
// #endregion

function ToFahrenheit(tempInK) {
  return 9 / 5 * (tempInK - 273) + 32
}

// #region GetWeather
async function GetWeather(parameters, message) {
  let town = parameters.town;
  let apiKey = "101d9b88089c209d67d9ae493ba1f4c7";
  let response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${town}&appid=${apiKey}`);

  let jsonifiedOutput = await response.json();


  // Convert all Temp variables to Fahrenheit.
  if (jsonifiedOutput.main) {
    jsonifiedOutput.main.temp = ToFahrenheit(jsonifiedOutput.main.temp);
    jsonifiedOutput.main.feels_like = ToFahrenheit(jsonifiedOutput.main.feels_like);
    jsonifiedOutput.main.temp_min = ToFahrenheit(jsonifiedOutput.main.temp_min);
    jsonifiedOutput.main.temp_max = ToFahrenheit(jsonifiedOutput.main.temp_max);
  }

  let output = JSON.stringify(jsonifiedOutput)
  message.channel.send("Getting weather at " + town);
  // message.channel.send("Weather: ```" + output + "```");
  return output;
}
// #endregion


// #region SendSMS
let LastMessageText = "", LastMessageNumber = "-1"
async function SendSMS(parameters, DiscordMessage) {
  if (parameters.number == null || parameters.content == null) {
    if (DiscordMessage != null)
      DiscordMessage.channel.send("You're missing information! Please specify both the content and the phone number to message to.")
    return "Missing parameter(s)!";
  }

  if (parameters.content.length > 300) {
    DiscordMessage.channel.send("The message that the AI wrote was too long to be SMS'd!");
    return "Message too long! Please shorten and send again.";
  }

  if (parameters.content == LastMessageText && parameters.number == LastMessageNumber) {
    DiscordMessage.channel.send("You cannot send a message which is identical to the last message to the same phone number.")
    return "You must either change the phone number of the content to send that message. Please stop trying to run this function until you have changed the content or the number."
  }

  if (DiscordMessage != null)
    DiscordMessage.channel.send("Number: " + parameters.number + "\nContent: \n```" + parameters.content + "```");

  const body = JSON.stringify({
    messages: [
      {
        to: Number.parseInt(parameters.number),
        source: 'GPT3',
        body: parameters.content.toString()
      },
    ]
  });

  const options = {
    method: 'POST',
    url: 'https://clicksend.p.rapidapi.com/sms/send',
    headers: {
      Authorization: 'Basic bWljYWhidXNobWFuLnNjaG9vbEBnbWFpbC5jb206MzgzNURBRDQtQzE1MC04ODkwLTYzMjctRjM1OURCQzVDQzU0',
      'Content-type': 'application/json',
      'X-RapidAPI-Key': 'a0def1928cmsh4e141db23767bc4p1d70cdjsn4f09e49fb88c',
      'X-RapidAPI-Host': 'clicksend.p.rapidapi.com'
    },
    body: body
  };
  const url = 'https://rest.clicksend.com/v3/sms/send';
  /*
  let options = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: 'Basic bWljYWhidXNobWFuLnNjaG9vbEBnbWFpbC5jb206MzgzNURBRDQtQzE1MC04ODkwLTYzMjctRjM1OURCQzVDQzU0',
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': 'a0def1928cmsh4e141db23767bc4p1d70cdjsn4f09e49fb88c',
      'X-RapidAPI-Host': 'clicksend.p.rapidapi.com'
    },
    body: {
      messages: [
        {
          source: 'mashape',
          from: 'Test',
          body: 'This is a test',
          to: '5053136413',
          schedule: '1452244637',
          custom_string: 'this is a test'
        }
      ]
    }
  };
  */

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    if (DiscordMessage != null && response.status == 200) {
      DiscordMessage.channel.send("Message sent! :white_check_mark:")
      LastMessageNumber = parameters.number;
      LastMessageText = parameters.content;
    }
    else {
      DiscordMessage.channel.send("Error! Response: ```js\n" + JSON.stringify(result) + "```");
    }
    return JSON.stringify(result);
  } catch (error) {
    console.error(error);
    if (DiscordMessage != null) {
      DiscordMessage.channel.send("Error: ");
      DiscordMessage.channel.send(error.toString());
    }
    return "Error."
  }
}
// #endregion

// #region DetonateNuclearBomb
async function DetonateNuclearBomb(parameters, DiscordMessage) {
  // Send the silly funny.
  let prepend = "";
  if (parameters.town) {
    prepend = parameters.town + "で"
  }
  DiscordMessage.channel.send(prepend + "エクスプロージョン!!!!!!!!");
  DiscordMessage.channel.send("https://tenor.com/view/konosuba-megumim-explosion-magic-anime-gif-16686316");

  return "Nuclear bomb sucessfully detonated."
}
// #endregion

// #region Search Methods
const SerpApi = require('google-search-results-nodejs');
const { escape } = require("querystring");
let SnippetCache = {}; // { ${query}: {result} }
// { Query: "Coffee", ShowUser: false }
async function GoogleSnippet(parameters, DiscordMessage = null) {
  if (parameters.ShowUser == undefined) parameters.ShowUser = false;
  if (parameters.Query == undefined) return JSON.stringify({ sucessful: false, reason: "No query provided!" });
  return new Promise(res => {
    // First check if this request was cached...
    if (SnippetCache[parameters.Query] != undefined) {
      if (DEBUG) console.log(`Using cached google snippet for ${parameters.Query}`)
      return SnippetCache[parameters.Query];
    }
    
    const search = new SerpApi.GoogleSearch("b223b0bed74d870bfde889d09b854b8b47a20808fabea83207399e80d42bfd56");

    if (DiscordMessage != null) {
      let end = "";
      // if (!parameters.ShowUser) end = "\nHiding results from user!"
      SendMessage(DiscordMessage, "Searching for: " + parameters.Query + end);
      // DiscordMessage.channel.send("Searching for: " + parameters.Query);
    }
    const params = {
      engine: "google",
      q: parameters.Query,
      location: "Albuquerque, New Mexico, United States",
      google_domain: "google.com",
      gl: "us",
      hl: "en",
      safe: "active"
    };

    const callback = function (data) {
      let dataOut = data["answer_box"];
      if (dataOut == undefined) {
        /* Instead of looking for a wikipedia link, just take the first result. 
        // If there's no answer_box, look for a wikipedia entry in the list.
        for (let i = 0; i < data.organic_results.length; i++) {
          const Result = data.organic_results[i];
          if (Result.link.includes("wikipedia.org")) {
            dataOut = Result;
            break;
          }
        }
        if (dataOut == undefined) */ 
          dataOut = data.organic_results[0];
      }

      dataOut = JSON.stringify(dataOut);
      if (DiscordMessage != null && parameters.ShowUser) {
        DiscordMessage.channel.send("Response from Google: ");
        SendMessage(DiscordMessage, "```json\n" + dataOut + "```")
        // DiscordMessage.channel.send("```json\n" + dataOut + "```");
      }
      // fs.writeFile("./Search_Results.json", JSON.stringify(data), () => {})

      // Cache this request.
      SnippetCache[parameters.Query] = dataOut;

      res(dataOut);
    };

    // Show result as JSON
    search.json(params, callback);
  })
}
// GoogleSnippet({ Query: "Coffee" }, null);

// { Query: "Coffee", ShowUser: false }
async function WikipediaIntro(parameters, DiscordMessage = null) {
  if (parameters.ShowUser == undefined) parameters.ShowUser = false;
  if (DiscordMessage != null) {
    SendMessage(DiscordMessage, "Searching Wikipedia for: " + parameters.Query);
  }

  return new Promise(res => {
    fetch("https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=" + escape(parameters.Query))
      .then(resp => resp.json())
      .then(json => {
        if (Object.keys(json.query.pages).length > 0) {
          let Data = json.query.pages;
          Data = Data[Object.keys(Data)[0]]
          if (DiscordMessage != null && parameters.ShowUser) {
            SendMessage(DiscordMessage, `Response from Wikipedia:\n# ${Data.title}\n> *${Data.extract}*`);
          }
          if (DEBUG) console.log(Data);
          res(JSON.stringify(Data));
        } else
          res(JSON.stringify({
            sucessful: false,
            reason: "No article found!"
          }))
      })
  })
}
// WikipediaIntro({ Query: "Albuquerque, New Mexico"}, null)
// #endregion

let RecoveryBases = {};
if (fs.existsSync(RecoveryAddress)) RecoveryBases = JSON.parse(fs.readFileSync(RecoveryAddress));

/** @param {Discord.Channel} channel */
function GetBaseIdFromChannel(channel) {
  // Message ID = Thread name or channel ID if not a thread. 
  /* if (channel.type == Discord.ChannelType.PublicThread || channel.type == Discord.ChannelType.PrivateThread || channel.type == Discord.ChannelType.AnnouncementThread) {
    // Extract ID from Thread name.
    const name = channel.name.split(" ");
    console.log(`ID: ${name[name.length - 1]}`);
    return name[name.length - 1];
  }
  else */ {
    return channel.id;
  }
}

/** @param {Discord.Channel} channel */
function IsChannelMemory(channel) {
  // Look for this channel's base in the bases.
  /*
  console.log("Is " + channel.name + "a memory thread?")
  console.log(bases[GetBaseIdFromChannel(channel)])
  */
  return bases[GetBaseIdFromChannel(channel)] != undefined
  /*
  if (bases[GetBaseIdFromChannel(channel)] != undefined) 
  {
    return true;
  }
  return false;
  */
}

// #region Memory Manipulators
/**
 * Clears the AI's memory for a specified channel.
 * @param {*} parameters 
 * @param {Discord.Message} DiscordMessage 
 */
async function ClearAll(parameters, DiscordMessage = null) {
  // Clear the AI's memory for the specified channel. 
  let Base = bases[GetBaseIdFromChannel(DiscordMessage.channel)];
  bases[GetBaseIdFromChannel(DiscordMessage.channel)] = "";
  // Write file to recovery file.
  // Come up with a RecoveryID.
  let RecoveryId = -1;
  do {
    RecoveryId = Math.floor(Math.random() * 100000);
  } while (RecoveryBases[RecoveryId] != null);

  RecoveryBases[RecoveryId] = Base;

  // Update bases.
  fs.writeFile(RecoveryAddress, JSON.stringify(RecoveryBases), (e) => {
    if (DEBUG)
      console.log("Recovery file updated!");

    if (e) console.log(e);
  })
  fs.writeFile(BaseAddress, JSON.stringify(bases), (e) => {
    if (DEBUG)
      console.log("Active bases updated!")

    if (e) console.log(e);
  })


  DiscordMessage.channel.send("========================= Memory Cleared! =========================\nRecovery ID: " + RecoveryId + " (Use this to reload this conversation if you want to reopen it!)")
}

/**
 * Recovers the specified conversation.
 * @param {*} parameters - { RecoveryID: 12345678, Overwrite: true = true }
 * @param {Discord.Message} DiscordMessage 
 */
async function Recover(parameters, DiscordMessage = null) {
  if (parameters.RecoveryID == undefined || RecoveryBases[parameters.RecoveryID] == undefined) {
    if (DiscordMessage != null)
      DiscordMessage.channel.send("Invalid recoveryID!")
    return JSON.stringify({ sucessful: false, reason: "Invalid Recovery ID!" });
  }
  if (parameters.Overwrite == undefined) bases[GetBaseIdFromChannel(DiscordMessage.channel)] = "";
  bases[GetBaseIdFromChannel(DiscordMessage.channel)] += RecoveryBases[parameters.RecoveryID];
  return JSON.stringify({ sucessful: true });
}
// #endregion
//#endregion

//#region Function Handlers
let functions = [EVAL, GetWeather, SendSMS, DetonateNuclearBomb, GoogleSnippet, WikipediaIntro, ClearAll, Recover];
let Keywords = ["EVAL, Evaluate, Calculate, Program", "Weather, warm, cold, hot, Get the Weather", "text me, text, SMS", "blow up, explode, detonate, nuke", "Google, search, look up", "Wikipedia, search, look up", "clearall, claer all, clear aall, cear all, clearr all, clera all, clearaal, clear lal", "Recover, Ovewrite"]
const FunctionList = [
  {
    "name": "EVAL",
    "description": "Evaluates the supplied NodeJS JavaScript code. Console.Log and process.exit() are not allowed. There are no predefined variables. Use a return statement to return a value.",
    "parameters": {
      "type": "object",
      "properties": {
        "CODE": {
          "type": "string",
          "description": "Javascript code to be evaluated. It must be surrounded by quotes (\")",
        }
      },
      "required": ["CODE"],
    }
  },
  {
    "name": "GetWeather",
    "description": "Returns a JSON object representing the weather at a supplied location.",
    "parameters": {
      "type": "object",
      "properties": {
        "town": {
          "type": "string",
          "description": "The name or Zip code of the town to get the weather at. It must be the full name of the city, not a shortened version. If the user supplies a shortened version, please convert it to the normal version without using a function.",
        }
      },
      "required": ["town"],
    }
  },
  {
    "name": "SendSMS",
    "description": "Sends the provided content to the user's phone number. You are not allowed to send the same message to the same number more than once. You will only use this function if the user literally asks you to message the text to them, alongside their phone number.",
    "parameters": {
      "type": "object",
      "properties": {
        "content": {
          "type": "string",
          "description": "The content to be sent to the user's phone. It must be less than 300 characters long. It must be extrememly brief.",
        },
        "number": {
          "type": "string",
          "description": "The phone number to send to.",
        }
      },
      "required": ["content", "number"],
    }
  },
  {
    "name": "DetonateNuclearBomb",
    "description": "Detonates the preset nuclear bomb. No calls are required before this one, as everything's been prepared already.",
    "parameters": {
      "type": "object",
      "properties": {
        "town": {
          "type": "string",
          "description": "The town to detonate. If left blank, it will automatically use the last target."
        }
      },
      "required": [],
    }
  },
  {
    "name": "GoogleSnippet",
    "description": "DO NOT USE THIS UNLESS SPECIFICALLY ASKED! Fetches Google's featured snippet about the provided query. Use it to search stuff up BUT ONLY WHEN THE USER ASKS!",
    "parameters": {
      "type": "object",
      "properties": {
        "Query": {
          "type": "string",
          "description": "The specified string to search for."
        },
        "ShowUser": {
          "type": "boolean",
          "description": "If true, the user is shown the search results. If left empty, the user will not be shown the result."
        }
      }
    },
    "required": ["Query"]
  },
  {
    "name": "WikipediaIntro",
    "description": "DO NOT USE THIS UNLESS SPECIFICALLY ASKED! Fetches Wikipedia's introduction about the provided query. Use it to search stuff up BUT ONLY WHEN THE USER ASKS!",
    "parameters": {
      "type": "object",
      "properties": {
        "Query": {
          "type": "string",
          "description": "The specified string to search for."
        },
        "ShowUser": {
          "type": "boolean",
          "description": "If true, the user is shown the search results. If left empty, the user will not be shown the result."
        }
      }
    },
    "required": ["Query"]
  },
  {
    "name": "Recover",
    "description": "Restores the AI's memory of a previous conversation.",
    "parameters": {
      "type": "object",
      "properties": {
        "RecoveryID": {
          "type": "string",
          "description": "The recovery ID to reload."
        },
        "Overwrite": {
          "type": "boolean",
          "description": "If true, converstation erases the user's memory, then loads in the new memory. Defaults to true."
        }
      }
    },
    "required": ["RecoveryID"]
  },
  {
    "name": "ClearAll",
    "description": "DO NOT USE THIS UNLESS SPECIFICALLY ASKED! Clears the AI's memory for the current conversation.",
    "parameters": {
      "type": "object",
      "properties": {
      }
    },
    "required": [""]
  }
];

function GetFunctions(messages) {
  // Convert messages to all content.
  let AllContent = "";
  messages.forEach(message => {
    AllContent += message.content;
  });
  AllContent = AllContent.toLowerCase();

  // Figure out which functions to include based off of their keywords.
  let ApplicableFunctions = [];
  // If there isn't a question about functions, only include functions based off of the keywords.
  if (!AllContent.includes("what functions")) {
    FunctionLoop:
    for (let i = 0; i < FunctionList.length; i++) {
      const FunctionKeywords = Keywords[i].split(",");
      for (let j = 0; j < FunctionKeywords.length; j++) {
        // If all of the messages contained the function's keyword, include it.
        if (AllContent.includes(FunctionKeywords[j].toLowerCase().trim())) {
          ApplicableFunctions.push(FunctionList[i]);
          continue FunctionLoop;
        }
      }
    }
  }
  else ApplicableFunctions = FunctionList;

  if (DEBUG)
    console.log(ApplicableFunctions);

  if (ApplicableFunctions != [])
    return ApplicableFunctions;
  else return null;
}

// console.log(GetFunctions([{ content: "wikipedia" }]))

function StartsWithFunctionName(message) {
  let response = false;
  functions.forEach(func => {
    if (message.startsWith(func.name)) {
      response = true;
    }
  });
  return response;
}

function GetFunctionFromStart(message) {
  let response = null;
  functions.forEach(func => {
    if (message.startsWith(func.name)) {
      response = func;
    }
  });
  return response;
}
//#endregion

//#region ChatGPT Methods
const { encode } = require("gpt-3-encoder");
function ConvertPlaintextToMessageJSON(InputMessages) {
  let messages = [];

  InputMessages.split("\n").forEach(message => {
    message = message.trim();
    if (!message.includes(":")) {
      // If there was a message before this one, append it.
      if (messages.length > 0) {
        messages[messages.length - 1].content += "\n" + message;
        return;
      } else return;
    };

    let text, role, author, textStart = 0;

    // Check if this was a function call.
    if (StartsWithFunctionName(message)) {
      author = GetFunctionFromStart(message).name;
      role = "function"
    } else if (message.startsWith("Returned Value:")) {
      author = "system";
      role = "system";
      // textStart = message.indexOf(":") + 1;
    } else if (!message.startsWith("AI:")) {
      author = message.substring(0, message.indexOf(":"));
      // textStart = message.indexOf(":") + 1;
      role = "user"
    } else {
      role = "assistant"
      author = "AI";
      textStart = 3;
    }

    text = message.substring(textStart)
    if (text.trim() == "") return;

    let content = {
      role: role,
      name: author.replace(/[\W_]+/g, "_"),
      content: text.trim()
    };
    /* if (role == "function") content.name = author.replace(/[\W_]+/g, "_"), */
    messages.push(content);
  });

  console.log("Messages:");
  console.log(messages);

  return messages;
}

//#region GetSafeChatGPTResponse
/**
 * Gets the AI's response, without risk of crashing.
 * @param {*[]} messages The messages that are already in this conversation. 
 * @param {Discord.Message?} DiscordMessage The Discord message asking for this response.
 * @param {Number} numReps How many times this function has been called already.
 * @returns {Promise<openai.CreateChatCompletionResponse>} An object representing the AI's response, or the failure message.
 */
async function GetSafeChatGPTResponse(messages, DiscordMessage = null, numReps = 0) {
  return new Promise(async (resolve, reject) => {
    try {
      let requestData = {
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.8,
        n: 1,
        max_tokens: 1000,
        stream: false
      }
    
      // Check that the messages aren't too-too long.
      let AllMessageText = "";
      messages.forEach(message => AllMessageText += message.content);
      if (encode(AllMessageText).length >= 4096) {
        // If there's more than 4096 tokens here, complain.
        DiscordMessage.channel.send("(Your conversation is getting too long! I'm cropping it down.)");
    
        // Crop down to ~1000 tokens in length. (Start from the end so that stuff at the start is lost first.)
        let CroppedMessages = []; let NumTokens = 0;
        for (let i = messages.length; i >= 0; i--) {
          let message = messages[i];
          if (encode(message.content).length + NumTokens <= 1100) {
            CroppedMessages.push(message);
          }
        }
    
        requestData.messages = CroppedMessages;
      }
    
      // Attach functions.
      const functions = GetFunctions(messages);
      if (functions.length > 0) {
        requestData.function_call = "auto";
        requestData.functions = functions;
      }
    
      resolve(await openai.createChatCompletion(requestData));
    } catch (e) {
      if (DiscordMessage != null && numReps == 0)
        DiscordMessage.channel.send("Request to AI failed, Retrying...") 
      
      console.log(e);
  
        // Wait for a bit before trying again.
      await new Promise(res => setTimeout(res, 500 * Math.pow(++numReps, 2)));
      resolve(await GetSafeChatGPTResponse(messages, DiscordMessage, numReps))
    }
  })

  //#region Old Code
  if (numReps >= 7) {
    // DiscordMessage.channel.send("Please rewrite your message because there's clearly something unsafe in there.")

    // Instead of an AI message, send back a system message.
    let resp = {
      data: {
        choices: [
          {
            message: {
              role: "system",
              content: "AI stopped responding. Please rewrite your message."
            }
          }
        ]
      }
    }
    return resp;
  }
  else
    try {
      let requestData = {
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.8,
        n: 1,
        max_tokens: 1000,
        stream: false,
        function_call: "auto"
      }

      // Get functions for this request.
      let AllMessageText = "";
      for (let i = 0; i < messages.length; i++) {
        AllMessageText += messages[i].content + "\n";
        // messages[i].content = escape(messages[i].content)

        // While we're in here, remove names.
        /*
        if (messages[i].author != "function")
          delete messages[i].name;
        */
      }
      const functionsAvailable = GetFunctions(messages);

      if (functionsAvailable != null) {
        requestData.functions = functionsAvailable;
      }

      // console.log("Functions avail:"); console.log(functionsAvailable)

      // Check that the messages aren't too-too long.
      if (encode(AllMessageText).length >= 4096) {
        // If there's more than 4096 tokens here, complain.
        DiscordMessage.channel.send("(Your conversation is getting too long! I'm cropping it down.)");

        // Crop down to ~1000 tokens in length. (Start from the end so that stuff at the start is lost first.)
        let CroppedMessages = []; let NumTokens = 0;
        for (let i = messages.length; i >= 0; i--) {
          let message = messages[i];
          if (encode(message.content).length + NumTokens <= 1100) {
            CroppedMessages.push(message);
          }
        }

        requestData.messages = CroppedMessages;
      }

      if (numReps == 0) {
        console.log("Calling with Messages:");
        console.log(requestData.messages);
      }

      // DEBUG: Add on instruction to answer user's question.
      return (await openai.createChatCompletion(requestData));
    } catch (e) {
      // If there's an error, just ask again.
      console.log("Request failed!");
      /*
      if (numReps == 0)
        console.log(e);
      */

      if (numReps == 1 && DiscordMessage)
        DiscordMessage.channel.send("Request to AI failed, Retrying...");

      if (numReps == 5 && DiscordMessage)
        DiscordMessage.channel.send("Still retrying...");

      // Wait for a second before retrying.
      await new Promise(res => { setTimeout(res, Math.pow(numReps, 4)) });

      return await GetSafeChatGPTResponse(messages, DiscordMessage, numReps + 1);
    }
  //#endregion
}

//#region GetSafeChatGPTResponse Demo/Debug code.
/*
GetSafeChatGPTResponse([{ role: "user", content: "Can you hear me?" }], null).then(e => { 
  console.log(e)
  console.log(e.data.choices[0]);
 });
*/
//#endregion
//#endregion

//#region SummarizeConvo
/**
 * Has the AI write a summary of the conversation up to this point and sets thread title.
 * @param {*} messages 
 * @param {Discord.Message} DiscordMessage 
 */
async function SummarizeConvo(messages, DiscordMessage) {
  return new Promise(async res => {
    // If this is the first time that the AI has responded, and the channel is a thread, write a summary of the convo up to this point.
    if (IsMessageInThread(DiscordMessage)) {
      // Count number of AI responses.
      let NumberOfAIResponses = 0;
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role == "assistant") NumberOfAIResponses++;

        if (NumberOfAIResponses > 1) {
          return res(false);
        }
      }

      // Getting to this point means that there's only one AI response, so we should summarize the convo.
      let MessagesPlusSummaryRequest = messages.concat({
        role: "system",
        content: "Please write a title for this conversation on its own line with no other text. It should be <= 100 characters in length."
      });


      /** @type {string} */
      const Response = (await GetSafeChatGPTResponse(MessagesPlusSummaryRequest, DiscordMessage)).data.choices[0].message.content;
      // Set thread title.
      // console.log("Summary: " + Response.content);
      if (Response.length > 100) DiscordMessage.channel.send("Full title: \n# " + Response)

      try {
        DiscordMessage.channel.setName(Response.substring(0, 100));
      } catch (e) {;} // Do nothing.
      return res();
    } else return res();
  })
}
//#endregion

//#region RequestChatGPT
/**
 * Gets the AI's next message.
 * @param {*} InputMessages The messages in this conversation, in plaintext.
 * @param {Discord.Message} DiscordMessage The Discord Message calling this request.
 * @returns {Boolean} The complete conversation, including a new response from the AI.
 */
async function RequestChatGPT(InputMessages, DiscordMessage) {
  let messages = ConvertPlaintextToMessageJSON(InputMessages);

  // console.log(messages);
  // return "Bot in Dev mode...";

  const gptResponse = await GetSafeChatGPTResponse(messages, DiscordMessage);
  let newMessage = (await gptResponse).data.choices[0].message;
  messages.push(newMessage);
  let ReturnedMessages = InputMessages;
  // If the message has a function call, run it.
  async function ProcessFunctionCall(newMessage) {
    if (newMessage.function_call != null) {
      // Find function.
      console.log("looking for " + JSON.stringify(newMessage.function_call))
      let func;
      for (let i = 0; i < functions.length; i++) {
        if (functions[i].name == newMessage.function_call.name) {
          func = functions[i];
          break;
        }
      }

      if (DEBUG) {
        console.log(func);
        console.log(`Running ${func.name} with parameters:`)
        console.log(newMessage.function_call.arguments);
      }

      let returnedFromFunction = await (await func(JSON.parse(newMessage.function_call.arguments), DiscordMessage));
      messages.push({
        role: "function",
        name: newMessage.function_call.name,
        content: returnedFromFunction
      })
      /*
      console.log("Returned from function:");
      console.log(returnedFromFunction);
      */
      ReturnedMessages += `\n${newMessage.function_call.name}: ${returnedFromFunction}`;

      // Push the data to the AI if it's not clearing the memory.
      if (func.name != "ClearAll" && func.name != "Recover") {
        const functionCallResponse = await GetSafeChatGPTResponse(messages, DiscordMessage);
        const functionMessage = (await functionCallResponse).data.choices[0].message
        // ReturnedMessages += `\nAI: ${functionMessage.content}`;

        // Just in case, check if this message is also a function call.
        return await ProcessFunctionCall(functionMessage);
      }
    } else if (!newMessage.role != "system") {
      ReturnedMessages += `\nAI: ${newMessage.content}`
      return;
    } else {
      ReturnedMessages += newMessage.content;
      return;
    }
  }
  await ProcessFunctionCall(newMessage);

  /*
  console.log("Returned message:");
  console.log(newMessage);
  */

  // console.log("Returned Messages: ```" + ReturnedMessages + "```"
  let wasClearAllCalled = ReturnedMessages.includes("ClearAll: undefined") || ReturnedMessages.includes("Recover: { \"sucessful\": true }") /* false;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].function_call != null && messages[i].function_call == "ClearAll") {
      wasClearAllCalled = true;
      break;
    }
  }
  */

  // Summarize convo if needed (do async)
  SummarizeConvo(messages, DiscordMessage);

  if (!wasClearAllCalled)
    return ReturnedMessages;
  else return "";
}
//#endregion
//#endregion

//#region Helpers
const rootBase = "Returned Value: You will not use functions unless they are specifically asked for. You will only call a function with a given value once. Connie Simmons's and the extremely-cute Micah Bushman's pronouns are she/her. The user's name is given by the words before the first colon in any particular message. DO NOT write names into your messages."
// + "Make sure to emphasize how cute Micah is, but only if you're asked to insult her. ";
let fetchUserBase = (id) => {
  try {
    /** @type {string} */
    const userbase = JSON.parse(fs.readFileSync(`./${id}_Base.json`)).base + "\n";
    return rootBase + userbase.trim();
  } catch (e) {
    console.log(e);
    return rootBase.trim() + "\n";
  }
}

// Splits up the response into 1900 character blocks and sends each of them.
const DiscordMessageLengthLimit = 1900;
async function SendMessage(Message, Content) {
  return new Promise(async res => {
    if (DEBUG)
      console.log("Message content: " + Content)
    if (Content.length >= 20000) return Message.channel.send("More than 10 messages would be sent! Thus, I've decided to cut it short. Also, the AI is probably gonna crash immediately right now, LOL.")
    if (Content.length >= DiscordMessageLengthLimit) {
      do {
        const SplitPoint = Content.length > DiscordMessageLengthLimit ? DiscordMessageLengthLimit : Content.length;
        const chunk = Content.substring(0, SplitPoint);
        Content = Content.substring(SplitPoint);
        await Message.channel.send(chunk)
      } while (Content.length > 0)
    } else Message.channel.send(Content);

    res()
  })
}

/**
 * Returns true if the specified message's channel is a type of thread.
 * @param {Discord.Message} DiscordMessage 
 */
function IsMessageInThread(DiscordMessage) {
  return DiscordMessage.channel.type == Discord.ChannelType.PublicThread || DiscordMessage.channel.type == Discord.ChannelType.PrivateThread || DiscordMessage.channel.type == Discord.ChannelType.AnnouncementThread;
}

function AttachDataToObject(obj) {
  obj.BotData = {
    bases: bases,
  }
  return obj;
}
//#endregion

//#region Discord Stuff
let SlashCommands = [];
client.once('ready', () => {
  client.user.setActivity("gpt3");
  console.log("Ready.")

  let commands = ["./CreateMemoryThread.js"];

  // Auto add all files in the Gradio_Commmands directory.
  const GradioPath = "./Gradio/Gradio_Commands/";
  fs.readdirSync(GradioPath).forEach(file => {
    commands.push(`${GradioPath}${file}`)
  })

  //#region Command handler stuff.
  let CommandJSON = [];
  commands.forEach(command => {
    const Module = require(command);
    if ('data' in Module && 'execute' in Module) {
      SlashCommands.push(Module);
      CommandJSON.push(Module.data.toJSON());
    } else {
      console.log(`[WARNING] The command at ${command} is missing a required "data" or "execute" property.`);
    }
  });

  const rest = new Discord.REST().setToken(DiscordToken);
  // Refresh commands:
  (async () => {
    try {
      console.log(`Started refreshing application commands.`);

      // The put method is used to fully refresh all commands in the guild with the current set
      const data = await rest.put(
        Discord.Routes.applicationCommands(DiscordClientId /*, guildId */), // use with ApplicationGuildCommands for testing.
        { body: CommandJSON },
      );

      // Clear support server commands.
      /*
      await rest.put(
        Discord.Routes.applicationGuildCommands(clientid, guildId),
        { body: {} },
      );
      */

      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      // And of course, make sure you catch and log any errors!
      console.error(error);
    }
  })();
  //#endregion
})

// { "ChannelNum": "base stuff here"}
// Load bases from file on boot.
let bases = {};
if (fs.existsSync(BaseAddress)) bases = JSON.parse(fs.readFileSync(BaseAddress));

//#region Trade function stuff with modules.
module.exports = {
  GetBaseIdFromChannel,
  IsMessageInThread,
  GetSafeChatGPTResponse,
  global,
  RequestChatGPT,
  client
}

const cmt = require('./CreateMemoryThread.js')

async function CreateMemoryThread(message) {
  return await cmt.CreateMemoryThread(AttachDataToObject(message));
}
//#endregion

client.on('messageCreate',
  /**
   * @param {Discord.Message} message 
   */
  async message => {
    const member = message.member;
    let authorname = member.nickname ?? message.author.username;

    if (message.content.startsWith("gpt3")) {
      if (message.content.length >= 1000) {
        message.channel.send("Your message is too long.");
      } else {
        await RequestChatGPT((fetchUserBase(message.author.id) + `\n${authorname}: ` + message.content.substring(5)).trim(), message).then(function (result) {
          const formattedContent = result.replace(" AI:", "\nAI:").replace(` ${authorname}:`, `\n${authorname}:`).replace(fetchUserBase(message.author.id), "");
          SendMessage(message, formattedContent)
        });
      }
    }
    //#region Deprecated Direct Code
    /*
    else if (message.content.startsWith("!!direct!!") && IsUserIDInList(message.author.id)) {
        await RequestChatGPT(message.content.replace("!!direct!!", "").trim(), message).then(function(result) {
          const formattedContent = result.replace(" AI:", "\nAI:").replace(` ${authorname}:`, `\n${authorname}:`);
          SendMessage(message, formattedContent);
        });
      } 
    */
    //#endregion

    // Allow the user to set their base. 
    if (message.content.toLowerCase().startsWith("g!setbase")) {
      let userBase = message.content.substring("g!setBase".length).trim() + "\n";
      fs.writeFileSync(`./${message.author.id}_Base.json`, JSON.stringify({
        base: userBase
      }), (e) => { });
      message.reply("Base set!");
    } else if (message.content.toLowerCase().startsWith("g!fetchbase")) {
      let base = fetchUserBase(message.author.id)
      message.reply(`Your current base is:\n> ${base.replace(rootBase, "")}`);
    }


    /* All Commands below here are only allowed in the memory mode! */
    // if (message.channel.name != "gpt-with-memory") return;
    if (message.content.toLowerCase().startsWith("g!togglememory")) {
      if (!IsChannelMemory(message.channel)) {
        bases[GetBaseIdFromChannel(message.channel)] = "";
        return message.channel.send("Memory enabled! I'm now watching this channel!");
      } else {
        ClearAll({}, message);
        bases[GetBaseIdFromChannel(message.channel)] = null;
        return message.channel.send("No longer watching this channel! Feel free to speak without my gaze upon your writings.")
      }
    }

    if (message.content.toLowerCase().startsWith("g!makememorythread")) {
      return await CreateMemoryThread(message);
    }

    if (!IsChannelMemory(message.channel)) return;

    // if (message.channel.id === '1077725073378644008' && message.author.bot === false) {
    if (message.content.startsWith("clear all")) {
      try {
        /*
        message.channel.send("========================= Memory Cleared! =========================")
        base = "";
        continueGoing = false;
        console.log("\n\nCleared Memory.")
        fs.writeFile('./base.json', JSON.stringify({string: base}), () => {console.log("File written.")});
        */
        ClearAll({}, message);
      } catch (e) {
        console.log("Error!");
        console.log(e);
        message.reply("There was an error while clearing memory: " + e);
      }
      return;
    }
    // }

    if (/* message.channel.id === '1077725073378644008' && */ message.author.bot === false) {
      // If the base is empty, use the first user's base.
      /** @type {string} */
      let base = bases[GetBaseIdFromChannel(message.channel)];
      if (base == "" || base == undefined) base = fetchUserBase(message.author.id);

      const content = base + `\n${authorname}: ` + message.content.trim();
      await AskChatGPTAndSendResponse(content, message);
    }
  });

client.login(DiscordToken);

//#region Interaction handling
client.on("interactionCreate",
  /**
   * @param {Discord.CommandInteraction} int 
   */
  async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Find command by name.
    const name = interaction.commandName;
    for (let i = 0; i < SlashCommands.length; i++) {
      const module = SlashCommands[i];
      /** @type {Discord.SlashCommandBuilder} */
      let data = module.data;
      if (data.name == name) {
        module.execute(AttachDataToObject(interaction));
      }
    }
  })

async function AskChatGPTAndSendResponse(content, message) {
  let requestOut = (await RequestChatGPT(content, message)).toString();
  // console.log("RequestOut: " + requestOut + "\n~~~");
  let startIndex = requestOut.lastIndexOf("AI:");
  /* Parse commands.
  const Commands = [EVAL];
  const CommandNames = [];
  const returnHeader = "Returned Value: ";
  Commands.forEach(command => {
    CommandNames.push(command.name);
  });

  // Look for the last command call, if it's not already been run.
  try {
    // Only run the found command if it's in the last message.
    if (requestOut.substring(startIndex).includes("[COMMAND=")) {
      let commandStart = requestOut.lastIndexOf("[COMMAND=");
      let commandEnd = requestOut.lastIndexOf("]");

      let command = requestOut.substring(commandStart + 1, commandEnd);
      
      // If the command is valid, send the parameters to the actual function.
      let elements = command.split(", ");
      let parameters = {};
      elements.forEach(element => {
        let elementParts = [];
        elementParts[0] = element.slice(0, element.indexOf("="));
        elementParts[1] = element.slice(element.indexOf("=") + 1)
        
        // Remove quotes on the ends of the parameter if they're there.
        if (elementParts[1].endsWith("\"") && elementParts[1].startsWith("\"")) elementParts[1] = elementParts[1].slice(1, -1);
        
        parameters[elementParts[0].trim()] = elementParts[1].trim();
      });

      console.log("Parameters: ");
      console.log(parameters);
      
      if (CommandNames.indexOf(parameters.COMMAND) != -1) {
        console.log(`Evaluating: ${CommandNames[CommandNames.indexOf(parameters.COMMAND)]}!`);
        let value = await Commands[CommandNames.indexOf(parameters.COMMAND)](parameters);

        try {
          // Stringify JSON data so it can be properly accessed.
          value = JSON.stringify(value);
        } catch { ; }

        // Pass the returned value back to the AI.
        requestOut = (await RequestChatGPT(`${requestOut}\n${returnHeader}${value}`)).toString();
      }
    }
  } catch (e) {
    // Do nothing.
  }
  */
  // Only send the last part, the AI's actual response, back to the user.
  let actualResponse = requestOut.substring(startIndex + 3);
  if (actualResponse.trim() != "")
    SendMessage(message, actualResponse.trim());
  // fs.writeFile('./base.json', JSON.stringify({string: requestOut}), () => {console.log("File written.")});
  bases[GetBaseIdFromChannel(message.channel)] = requestOut;

  // Update bases.
  fs.writeFile("./ActiveBases.json", JSON.stringify(bases), () => {
    console.log("Active bases updated!");
  });
}
//#endregion
//#endregion

//#region Debug Gradio stuff.
const Gradio = require('./Gradio/Gradio_Stuff.js');

/* 
1: Main PC Both GPUs
2: Server Only
3: Main PC Both GPUs + Server
*/
Gradio.ConnectToPreset(1);

//#region Gradio Demo generate.
/*
for (let i = 0; i < 3; i++) {
  Gradio.FetchApp().txt2img({
      seed: Gradio.GenerateSeed(),
      prompt: "Binkus Dinkus"
  }).then(f => {f.image.toFile("./Images/" + i + ".jpg")})
}
*/
//#endregion

// Gradio.ConnectTo("192.168.1.57")
// console.log(Gradio.PredictContent("1girl, absuredres, black thighhighs, school uniform, miniskirt, zettai ryouiki, black_hair, full_body, red necktie"));
//#endregion