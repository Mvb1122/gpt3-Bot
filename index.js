//#region Imports and Constants
const Discord = require('discord.js');
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const tokens = JSON.parse(fs.readFileSync("./token.json"));

const configuration = new Configuration({
  apiKey: tokens.openai,
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
const DiscordToken = tokens.discord;
const DiscordClientId = "845159393494564904";
const Helpers = require('./Helpers.js')
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
  bases[GetBaseIdFromChannel(DiscordMessage.channel)] = [];
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
  if (parameters.Overwrite == undefined) bases[GetBaseIdFromChannel(DiscordMessage.channel)] = [];
  bases[GetBaseIdFromChannel(DiscordMessage.channel)] += RecoveryBases[parameters.RecoveryID];
  return JSON.stringify({ sucessful: true });
}
//#endregion
//#endregion

//#region Function Handlers
let functions = [ClearAll, Recover];
let Keywords = ["clearall, claer all, clear aall, cear all, clearr all, clera all, clearaal, clear lal", "Recover, Ovewrite"]
const FunctionList = [
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
const functionPath = "./Functions/";
// Import all functions on boot. 
fs.readdir(functionPath, (err, paths) => {
  paths.forEach(file => {
    /**
     * @type {{keywords: String, json: String, execute: Function}}
     */
    const f = require(functionPath + file)
    functions.push(f.execute);
    Keywords.push(f.keywords);
    FunctionList.push(f.json);

    console.log(`Added ${f.json.name}!`)
  })
})

/**
 * Searches through the provided messages for keywords and returns the relevant functions' JSON data.
 * @param {[{content: String}]} messages The inputted messages to be searched for function keywords.
 * @returns {[{name: String, description: String, parameters: {type: String, properties: {*}}}]}A list of functions which can be sent to OpenAI.
 */
function GetFunctions(messages) {
  // Convert messages to all content.
  let AllContent = GetAllMessageText(messages).toLowerCase();

  // Figure out which functions to include based off of their keywords.
  let ApplicableFunctions = [];
  // If there isn't a question about functions, only include functions based off of the keywords.
  if (!AllContent.includes("what functions")) {
    FunctionLoop:
    for (let i = 0; i < FunctionList.length; i++) {
      const FunctionKeywords = Keywords[i].toLowerCase().split(",");
      for (let j = 0; j < FunctionKeywords.length; j++) {
        // If all of the messages contained the function's keyword, include it.
        if (AllContent.includes(FunctionKeywords[j].trim())) {
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
  // Types: System, User Function
  /**
   * Creates a message object from the content.
   * @param {String} Role System || User || Function || Assistant <- For AI only, will be appended automatically.
   * @param {String} Content 
   * @returns {[{role: String, content: String}]}
   */
function NewMessage(Role, Content, User) {
  return [{
    role: Role.toLowerCase(),
    name: User,
    content: Content
  }]
}

const { encode } = require("gpt-3-encoder");

/**
 * Converts message strings into json. 
 * @param {String | [{role: String, content: String, name: String}]} InputMessages The inputted messages.
 * @returns {[{role: String, content: String, name: String}]} The messages in proper format.
 */
function ConvertToMessageJSON(InputMessages) {
  // Support old and new format by keeping this.
  if (typeof InputMessages != String) return InputMessages;

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

  if (DEBUG) {
    console.log("Messages:");
    console.log(messages);
  }

  return messages;
}

//#region GetSafeChatGPTResponse
/**
 * Gets the AI's response, without risk of crashing.
 * @param {[{role: String, content: String, name: String}]} messages The messages that are already in this conversation. 
 * @param {Discord.Message?} DiscordMessage The Discord message asking for this response.
 * @param {Number} numReps How many times this function has been called already.
 * @returns {Promise<openai.CreateChatCompletionResponse>} An object representing the AI's response, or the failure message.
 */
async function GetSafeChatGPTResponse(messages, DiscordMessage = null, numReps = 0, allowFunctions = true) {
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
      let AllMessageText = GetAllMessageText(messages);
      const tokencount = encode(AllMessageText).length;
      if (tokencount >= 8192) {
        // If there's more than 4096 tokens here, complain.
        // DiscordMessage.channel.send(`(Your conversation is getting too long! Please use \`clear all\` soon! Number of tokens: ${encode(AllMessageText).length})`);
    
        // If more than 10,000 tokens, crop down to like 8000. (Start from the end so that stuff at the start is lost first.)
        if (tokencount > 10000 && messages.length > 10) {
          let CroppedMessages = []; let NumTokens = 0;
          for (let i = messages.length; i >= 0; i--) {
            let message = messages[i];
            try {
              if (encode(message.content).length + NumTokens <= 8000 || message.role == "user")
                CroppedMessages.push(message);
  
            } catch {
              // If something goes wrong, the message is probably important.
              CroppedMessages.push(message);
            }
          }
      
          requestData.messages = CroppedMessages;
        }

        // ! Just use a larger model.
        requestData.model = "gpt-3.5-turbo-16k"
      }
    
      // Attach functions.
      let functions;
      if (allowFunctions)
        functions = GetFunctions(messages);
      else
        functions = []
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

/**
 * @param {[{content: string}]} messages 
 * @returns {String}
 */
function GetAllMessageText(messages) {
  let AllMessageText = "";
  messages.forEach(message => AllMessageText += message.content);
  return AllMessageText;
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
 * @param {String} InputMessages The messages in this conversation, in Object with the last message in string.
 * @param {Discord.Message} DiscordMessage The Discord Message calling this request.
 * @returns {Promise<[{role: String, content: String, name: String}]>} The complete conversation, including a new response from the AI.
 */
async function RequestChatGPT(InputMessages, DiscordMessage) {
  return new Promise(async (resolve, reject) => {
    let messages = ConvertToMessageJSON(InputMessages);

    // First things first, ask the AI for its thaughts.
    const gptResponse = await GetSafeChatGPTResponse(messages, DiscordMessage);

    /**
     * @type {{role: String, content: String, name: String}}}
     */
    let newMessage = (await gptResponse).data.choices[0].message;
    // messages.push(newMessage);
    let ReturnedMessages = InputMessages;
    // If the message has a function call, run it.
    async function ProcessFunctionCall(newMessage) {
      if (newMessage.function_call != null) {
        // Find function.
        console.log("looking for " + JSON.stringify(newMessage.function_call))
        let func;
        for (let i = 0; i < functions.length; i++) {
          if (FunctionList[i].name == newMessage.function_call.name) {
            func = functions[i];
            break;
          }
        }
  
        if (DEBUG) {
          console.log(func);
          console.log(`Running ${func.name} with parameters:`)
          console.log(newMessage.function_call.arguments);
        }
  
        let returnedFromFunction = await (func(JSON.parse(newMessage.function_call.arguments), DiscordMessage));

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
      } /* else if (!newMessage.role != "system") {
        ReturnedMessages += `\nAI: ${newMessage.content}`
        return;
      } else {
        ReturnedMessages += newMessage.content;
        return;
      } */
      else {
        messages.push(newMessage)
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
      resolve(messages);
    else resolve([]);
  })
}
//#endregion
//#endregion

//#region Helpers
const rootBase = "Returned Value: You will not use functions unless they are specifically asked for. You will only call a function with a given value once. The user's name is given by the words before the first colon in any particular message. DO NOT write names into your messages."
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

/**
 * Looks for markdown tables in a string.
 * @param {String} string Content of message.
 * @returns {[String | Discord.EmbedBuilder]}
 */
function ParseMessage(string) {
  const LineCounts = Helpers.CountCharactersInSections(string, "|", "\n");
  /**
   * @type {[[[String]]]}
   */
  let TableSets = [[]];
  const Lines = string.split("\n")
  let tableIndex = 0;

  // If multiple lines contain the same number of "|" characters, cut those lines out and convert them to a table embed.
  if (LineCounts[0] >= 2) TableSets[0] = LineCounts[0];
  else {
    TableSets[0] = Lines[0];
    tableIndex = 1; TableSets[1] = [];
  }

  for (let i = 1; i < LineCounts.length; i++) {
    let ContentOnThisLine = Lines[i].split("|")
    ContentOnThisLine = ContentOnThisLine.slice(1, ContentOnThisLine.length - 1)
    
    if (ContentOnThisLine.length > 0) {
      TableSets[tableIndex].push(ContentOnThisLine)
    } else {
      TableSets.push(Lines[i]);
      tableIndex += 2;
      TableSets[tableIndex] = [];
    }
    /*Old Code
    (LineCounts[i] == LineCounts[i - 1] && LineCounts[i] >= 2)
    {
      TableSets[tableIndex].push(ContentOnThisLine); 
    } else if (LineCounts[i] == LineCounts[i + 1]){
      TableSets[tableIndex] = [ContentOnThisLine]
    } else if (LineCounts[i] == 0 && TableSets[tableIndex] != []) {
      // Remove the table from the currentText.
      let TableText = "";
      TableSets[tableIndex]

      currentText = currentText.replace(TableText, "[Table Embed]");

      // Move on.
      tableIndex++;
      tableStartIndex = i + 1;
    }*/
  }

  // console.log(TableSets)

  // Construct an embed for each embed as needed, if needed.
  for (let i = 0; i < TableSets.length; i++) {
    if ((typeof TableSets[i]).toString() != "string" && TableSets[i].length > 1) {
      const table = TableSets[i];
      let ThisEmbed = new Discord.EmbedBuilder();
      // console.log(`${i}: ${typeof TableSets[i]}`)
      for (let j = 0; j < table[0].length; j++) {
        let column = [];
        for (let k = 0; k < table.length; k++)
          column.push(table[k][j])

        // Now that we have the column, we can add a field for it.
        ThisEmbed.addFields({
          name: column[0],
          value: column.slice(1).toString().replaceAll(",", "\n"),
          inline: true
        })
      }

      TableSets[i] = ThisEmbed;
    }
  }
  
  if (DEBUG)
    console.log(TableSets)

  return TableSets;
}

/* !DEBUG: g!test function.
  if (message.content == "g!test")
  SendMessage(message, 'Sure! Here is the copied text:\n' +
  '\n' +
  '|h1|h2|\n' +
  '|c1|c2|\n' +
  '|c3|c4|'
  )
*/

// ParseTables("Hello.\n|head1|head2|\n|cont1|cont2|\n|cont3|cont4|\nHello.\n|head1|head2|\n|cont1|cont2|\n|cont3|cont4|");

const DiscordMessageLengthLimit = 1900;
/**
 * Splits up the response into 1900 character blocks and sends each of them.
 * @param {Discord.Message} Message The message to send in the channel of.
 * @param {String} Content The content to be sent.
 * @returns {String} A promise which resolves when the message is complete.
 */
async function SendMessage(Message, StringContent) {
  if (StringContent.trim() == "") {
    return Message.channel.send("[Empty Message]")
  }

  async function SendString(part) {
    if (DEBUG)
      console.log("Message content: " + part)
    if (part.length >= 20000) return Message.channel.send("More than 10 messages would be sent! Thus, I've decided to cut it short. Also, the AI is probably gonna crash immediately right now, LOL.")
    if (part.length >= DiscordMessageLengthLimit) {
      do {
        const SplitPoint = part.length > DiscordMessageLengthLimit ? DiscordMessageLengthLimit : Content.length;
        const chunk = part.substring(0, SplitPoint);
        part = part.substring(SplitPoint);
        await Message.channel.send(chunk)
      } while (part.length > 0)
    } else Message.channel.send(part);
  }

  return new Promise(async res => {
    // If the input message contains a markdown table, send it as an embed.
    // [Content, Embed] = ParseTables(Content)
    let Content = ParseMessage(StringContent);

    // First, merge all empty lines into the one previous to it.
    for (let i = 1; i < Content.length; i++)
      if (Content[i] == "" || Content[i] == [])
      {
        // Only actually retain the text if the previous chunk was also a string.
        if ((typeof Content[i - 1]).toString() == "string") {
          Content[i - 1] += "\n";
        }
        Content.splice(i, 1);
        i--;
      }

    for (let i = 0; i < Content.length; i++) {
      if ((typeof Content[i]).toString() == "string")
      {
        if (Content[i].trim() == "") continue;
        await SendString(Content[i]);
      }
      else {
        await Message.channel.send({
          embeds: [Content[i]]
        });
      }
    }

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
  client,
  SendMessage,
  DEBUG
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
    let authorname = "";
    try {
      authorname = member.nickname ?? message.author.username;
    } catch (e) {
      message.reply("Something went wrong! Please tell Micah to fix this error:\n```" + e + "```");
    }

    if (message.content.startsWith("gpt3")) {
      if (message.content.length >= 1000) {
        message.channel.send("Your message is too long.");
      } else {
        const Messages = NewMessage("system", fetchUserBase(message.author.id))
          .concat(NewMessage("user", message.content.substring(5), authorname));

        let result = await RequestChatGPT(Messages, message);
        SendMessage(message, result[result.length - 1].content)
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
        bases[GetBaseIdFromChannel(message.channel)] = [];
        return message.channel.send("Memory enabled! I'm now watching this channel!");
      } else {
        ClearAll({}, message);
        bases[GetBaseIdFromChannel(message.channel)] = undefined;
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
      /**
       * @type {[{content, role, name}]}
       */
      let base = bases[GetBaseIdFromChannel(message.channel)];
      if (base == "" || base == undefined) base = NewMessage("system", fetchUserBase(message.author.id));

      base = base.concat(NewMessage("user", message.content.trim())); // `\n${authorname}: ` + message.content.trim();
      await AskChatGPTAndSendResponse(base, message);
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
        try {
          return module.execute(AttachDataToObject(interaction));
        } catch (error) {
          if (interaction.replied) interaction.editReply("Something went wrong!")
          else interaction.reply("Something went wrong!");
        }
      }
    }
  })

async function AskChatGPTAndSendResponse(content, message) {
  let requestOut = RequestChatGPT(content, message)
    .then(Convo => {
      console.log(Convo);
      // console.log("RequestOut: " + requestOut + "\n~~~");
      let startIndex = 0; // requestOut.lastIndexOf("AI:");
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
      let actualResponse = Convo[Convo.length - 1].content; // requestOut.substring(startIndex + 3);
      if (actualResponse.trim() != "")
        SendMessage(message, actualResponse.trim());
      // fs.writeFile('./base.json', JSON.stringify({string: requestOut}), () => {console.log("File written.")});
      bases[GetBaseIdFromChannel(message.channel)] = Convo;
    
      // Update bases.
      fs.writeFile("./ActiveBases.json", JSON.stringify(bases), () => {
        console.log("Active bases updated!");
      });
    })
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

//#region Gradio Tag Generation Stuff
/*
  // Make an image and then try to get its tags.
const debugImagePath = `./Images/1girl, absurdres, thighhighs_1156489048.png`
let val = Gradio.GetTagsFromImage(debugImagePath)
  .then(async val => {
    console.log(val);
  })
*/
//#endregion
// Gradio.ConnectTo("192.168.1.57")
// console.log(Gradio.PredictContent("1girl, absuredres, black thighhighs, school uniform, miniskirt, zettai ryouiki, black_hair, full_body, red necktie"));
//#endregion