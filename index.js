//#region Settings
let AIParameters = {
  model: 'gpt-4o-mini',
  temperature: 0.8,
  max_tokens: 1000,
  // Keep n and stream set as they are.
  n: 1,
  stream: false,
}
const DEBUG = false;
const LocalServerSettings = {
  // Set Use: true to use local server.
  Use: true,
  basePath: "http://192.168.1.4:82/v1",
  // Model will be set automatically from API request, but you can override here.
  // model: "LM Studio Community/Meta-Llama-3-8B-Instruct-GGUF/Meta-Llama-3-8B-Instruct-Q4_K_M.gguf",
  temperature: 0.8,
}
//#endregion

//#region Imports and Constants
const Discord = require('discord.js');
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const tokens = require('./token');
const red = '\x1b[31m';
const green = '\x1b[32m';
const reset = '\x1b[0m';
module.exports.DEBUG = DEBUG;
module.exports.LocalServerSettings = LocalServerSettings;

// Update LocalServerSettings model via API:
if (LocalServerSettings.Use) {
  // Override AIParameters with ones set in LocalServerSettings.
  Object.keys(LocalServerSettings).forEach(key => { /* if (key in AIParameters) */ AIParameters[key] = LocalServerSettings[key] });
  
  if (!LocalServerSettings.model)
    LocalServerSettings.model = new Promise(res => {
      fetch(LocalServerSettings.basePath + "/models").then(async v => {
        const json = await v.json();
        AIParameters.model = LocalServerSettings.model = json.data[0].id
        console.log(`Model automatically set to ${green}%s${reset}!`, LocalServerSettings.model)
        res(LocalServerSettings.model)
      });})
}

const configuration = new Configuration({
  apiKey: LocalServerSettings.Use ? LocalServerSettings.ApiKey : tokens.GetToken("openai"),
  basePath: LocalServerSettings.Use ? LocalServerSettings.basePath : undefined
});

const openai = new OpenAIApi(configuration);
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildMessageTyping,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildVoiceStates,

    Discord.GatewayIntentBits.GuildPresences
  ],
});
const BaseAddress = "./ActiveBases.json";
const RecoveryAddress = "./RecoveryBases.json"
const DiscordToken = tokens.GetToken("discord");
const Helpers = require('./Helpers.js')
//#endregion

// const rootBase = "Connie Pedersen's and the extremely-cute Micah Bushman's pronouns are she/her. Micah is a 17-year-old trans girl living in Albuquerque, New Mexico, who enjoys reading Manga and studying Japanese. On weekdays, she goes to school, where she suffers through AP Physics, AP US History, and AP Psychology. She's also taking Japanese at the CEC. Micah programmed this AI to help her with her homework. Rilen, aka ConerBearBeats, is one of Connie's and Micah's old friends. They used to be friends in real life, but now only chat via the internet.\n";

const ListOfIDsAllowedToUseTheMemoryOnVersion = [tokens.GetToken("devDiscordID"), 733343607339352126n, 322906020844142592n]
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

async function UpdateUserBase(id, text) {
  const v = await GetUserFile(id);
  v.base = text;
  return v.sync();
}

async function UpdateUserPersona(id, text, Nickname = undefined) {
  // Get preexisting data.
  let Persist = await GetUserFile(id);

  // Update it with the new base and write it.
  Persist.persona = text

  // Put it onto the Persona array immediately.
  PersonaArray[Nickname != undefined ? Nickname : id] = text;

  // Return a promise which resolves after the file has been written *and* after the full arrays have been updated.
  await Persist.sync();
  await UpdatePersonaArray();
  return;
}

function FetchUserPersona(Search) {
  if (PersonaArray[Search] != undefined)
    return PersonaArray[Search];
  else {
    // Assume that they don't have a base.
    return "";
  }
}

// Loaded after boot.
let PersonaArray = {};

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
 * Clears the AI's memory for a specified channel. Does not stop it from listening.
 * @param {*} parameters 
 * @param {boolean} [KeepListening=true] Whether to keep listening in this channel.
 * @param {Discord.Message} DiscordMessage 
 */
async function ClearAll(parameters = {}, DiscordMessage = null, KeepListening = true) {
  // Clear the AI's memory for the specified channel. 
  let Base = bases[GetBaseIdFromChannel(DiscordMessage.channel)];
  bases[GetBaseIdFromChannel(DiscordMessage.channel)] = KeepListening ? [] : undefined;
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
 * @param {{RecoveryID: Number, Overwrite: Boolean}} parameters - { RecoveryID: 12345678, Overwrite: true = true }
 * @param {Discord.Message} DiscordMessage 
 * @returns {Promise<String>} JSON in the format {sucessful: Boolean, reason: String}
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
  let commands = ""
  paths.forEach(file => {
    if (file.includes("DISABLED") || !file.includes(".js")) return; // Don't include disabled functions.

    /**
     * @type {{keywords: String, json: String, execute: Function}}
     */
    const f = require(functionPath + file)
    functions.push(f.execute);
    Keywords.push(f.keywords);
    FunctionList.push(f.json);

    // console.log(`Added ${f.json.name}!`)
    commands += f.json.name + " "
  })

  console.log(`Added ${paths.length} commands! ${commands.trim()}`)
})

/**
 * Searches through the provided messages for keywords and returns the relevant functions' JSON data.
 * @param {[{role: String, content: String}]} messages The inputted messages to be searched for function keywords.
 * @returns {[{function: {name: String, description: String, parameters: {type: String, properties: {*}}}, type: string}]} A list of functions which can be sent to OpenAI.
 */
function GetFunctions(messages) {
  // Search only the user's messages.
  let AllContent = messages.filter(v => {
    return v.role == "user";
  })
    .map(v => {
      return v.content;
    })
    .join(" ")
    .toLowerCase();

  // Figure out which functions to include based off of their keywords.
  let ApplicableFunctions = [];
  // If there isn't a question about functions, only include functions based off of the keywords.
  FunctionLoop:
  for (let i = 0; i < FunctionList.length; i++) {
    const FunctionKeywords = Keywords[i].toLowerCase().split(",");
    for (let j = 0; j < FunctionKeywords.length; j++) {
      // If all of the messages contained the function's keyword, include it.
      if (AllContent.includes(FunctionKeywords[j].trim())) {
        const toolParams = FunctionList[i];
        const type = toolParams.toolType ?? "function"
        delete toolParams.type;

        const tool = {
          function: toolParams,
          type: type
        }

        ApplicableFunctions.push(tool);
        continue FunctionLoop;
      }
    }
  }

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
 * @param {"System" | "User" | "Function" | "Tool" | "Assistant"} Role System || User || Function || Assistant <- For AI only, will be appended automatically.
 * @param {String} Content 
 * @param {String | undefined} Username NOTE: Do not pass content as an array AND the username as a string. Things won't work out very well.
 * @returns {[{role: String, content: String}]}
 */
function NewMessage(Role, Content, Username) {
  if (Username) Content = `(${Username}) ${Content}`;
  return [{
    role: Role.toLowerCase(),
    name: Username,
    content: Content
  }]
}
module.exports.NewMessage = NewMessage;

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

const { encode } = require("gpt-3-encoder");
const LlamaConverter = require('./LlamaSupport');

//#region GetSafeChatGPTResponse
/**
 * Gets the AI's response, without risk of crashing.
 * @param {[{role: String, content: String, name: String, tool_calls: { id: number; type: string ;function: { name: any; arguments: string; }}[]}]} messages The messages that are already in this conversation. 
 * @param {Discord.Message?} DiscordMessage The Discord message asking for this response.
 * @param {Number} numReps How many times this function has been called already.
 * @returns {Promise<{data: import('openai').CreateChatCompletionResponse}>} An object representing the AI's response, or the failure message.
 */
async function GetSafeChatGPTResponse(messages, DiscordMessage = null, numReps = 0, allowFunctions = true) {
  if (DEBUG)
    console.log(messages);
  return new Promise(async (resolve) => {
    try {
      // Clone parameters object.
      const params = JSON.parse(JSON.stringify(AIParameters));
      params.messages = messages;

      // Check that the messages aren't too-too long.
      let AllMessageText = GetAllMessageText(messages);
      const tokencount = encode(AllMessageText).length;
      if (tokencount >= 8192) {
        // If there's more than a lot of tokens here, complain.
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

          params.messages = CroppedMessages;
        }

        // This approach no longer works as the latest GPT-4o model has 128k of context.
        // ! Just use a larger model.
        // AIParameters.model = "gpt-3.5-turbo-16k"
      }

      // Attach functions.
      let functions;
      if (allowFunctions) {
        // If we're using an OpenAI remote model, then handle them normally.
        functions = GetFunctions(messages);

        // If we're using a remote model, then handle them correctly for that.
        if (LocalServerSettings.Use) {
          // Get first system message.
          const SystemMessage = messages[0];
          if (SystemMessage.content && SystemMessage.content.indexOf(FunctionEndMessage) != -1) {
            // Clip the content to the end.
            SystemMessage.content = SystemMessage.content.substring(0, SystemMessage.content.indexOf(FunctionEndMessage) + FunctionEndMessage.length);

            // Add the functions to the end.
            SystemMessage.content += "\n" + functions.map(v => JSON.stringify(v.function)).join("\n");
            messages[0] = SystemMessage;
          }
        }
      }
      else
        functions = []

      if (functions.length > 0 && !LocalServerSettings.Use) {
        params.tool_choice = "auto";
        params.tools = functions;
      } 
      
      if (LocalServerSettings.Use) {
        // Do all necessary processing using the module to make our messages compatible with Llama. 
        messages = await Promise.all(messages.map(async m => {return await LlamaConverter.MessageToLlama(m)}));
      }

      // Always log chat messages regardless of whether we're debug or not.
      console.log(messages);

      const data = await openai.createChatCompletion(params);

      // For safety, prevent @everyone and @here.
      if (data.data.choices[0].message.content != undefined) {
        data.data.choices[0].message.content = data.data.choices[0].message.content.replaceAll("@everyone", "@ everyone")
        data.data.choices[0].message.content = data.data.choices[0].message.content.replaceAll("@here", "@ here")
      }

      // If we're using a local server, return the messages back to normal now.
      if (LocalServerSettings.Use) {
        messages = messages.map(m => LlamaConverter.MessageFromLlama(m));

        // Fix AI's response.
        data.data.choices[0].message = LlamaConverter.MessageFromLlama(data.data.choices[0].message);
      }

      console.log(messages);

      // Add billing based on input.
      const TokenCount = encode(GetAllMessageText(messages)).length;
      if (DiscordMessage != null && (DiscordMessage.author ?? DiscordMessage.user) != null)
        AddCostOfGPTTokens((DiscordMessage.author ?? DiscordMessage.user).id, TokenCount)

      resolve(data);
    } catch (e) {
      if (DiscordMessage != null && numReps == 0 && DiscordMessage.channel != null)
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
module.exports.GetSafeChatGPTResponse = GetSafeChatGPTResponse;

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
    if (await IsMessageInThread(DiscordMessage) && DiscordMessage.channel.name.includes(cmt.MemoryChannelPrefix)) {
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
        role: LocalServerSettings.Use ? "user" : "system",
        content: "Please write a title for this conversation on its own line with no other text. It should be <= 100 characters in length."
      });


      /** @type {string} */
      const Response = (await GetSafeChatGPTResponse(MessagesPlusSummaryRequest, DiscordMessage, 0, false)).data.choices[0].message.content;
      // Set thread title.
      // console.log("Summary: " + Response.content);
      if (Response.length > 100) DiscordMessage.channel.send("Full title: \n# " + Response)

      try {
        DiscordMessage.channel.setName(Response.substring(0, 100));
      } catch (e) { ; } // Do nothing.
      return res();
    } else return res();
  })
}
//#endregion

//#region RequestChatGPT
/**
 * Gets the AI's next message.
 * @param {[{role: string;content: string;name: string;}]} InputMessages The messages in this conversation.
 * @param {Discord.Message | Web} DiscordMessage The Discord Message calling this request.
 * @param {boolean} [AutoRespond=true] Whether to automatically send messages with content when the AI makes a Function call.
 * @returns {Promise<[{role: String, content: String, name: String}]>} The complete conversation, including a new response from the AI.
 */
async function RequestChatGPT(InputMessages, DiscordMessage, AutoRespond = true) {
  return new Promise(async (resolve) => {
    let messages = ConvertToMessageJSON(InputMessages);

    // First things first, ask the AI for its thaughts.
    const gptResponse = await GetSafeChatGPTResponse(messages, DiscordMessage);

    /**
     * @type {{role: String, content: String, name: String}}}
     */
    let newMessage = (await gptResponse).data.choices[0].message;
    let ReturnedMessages = InputMessages;

    // If the message has a function call, run it.
    async function ProcessFunctionCall(newMessage) {
      console.log(newMessage)
      if (newMessage.tool_calls != null) {
        if (newMessage.content && DiscordMessage.followUp == null && AutoRespond) // followUp is only on slash commands; don't send extra content for slash commands.
          DiscordMessage.channel.send(newMessage.content);

        messages.push(newMessage);
        /**
         * @type {[{name: string, arguments: string, id: string}]}
         */
        const tool_calls = newMessage.tool_calls.map((v) => {
          const data = v.function;
          data.id = v.id;
          return data;
        })

        // Process all function calls.
        AllCallLoop:
        for (let i = 0; i < tool_calls.length; i++) {
          const call = tool_calls[i];

          // Find function.
          console.log("looking for " + call.name)
          let func;
          for (let i = 0; i < functions.length; i++) {
            if (FunctionList[i].name == call.name) {
              func = functions[i];
              break;
            }
          }

          if (func == undefined) {
            const returnedFromFunction = `{"successful": false, "reason": "Invalid JSON passed! Please retry immediately without asking for the User's permission. Make sure to correct your function name this time." }`;
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: returnedFromFunction
            })
            continue AllCallLoop;
          }

          if (DEBUG) {
            console.log(func);
            console.log(`Running ${func.name} with parameters:`)
            console.log(call.arguments);
          }

          let params = {}, returnedFromFunction;
          try {
            params = JSON.parse(call.arguments);

            // If the DiscordMessage is actually a Web Handler, then make a fake message off of it.
            const message = DiscordMessage.CreateMessage ? DiscordMessage.CreateMessage() : DiscordMessage;

            returnedFromFunction = await (func(params, message, messages));

            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: returnedFromFunction ?? "Nothing was returned."
            })
          } catch (error) {
            console.log(error);
            if (error.toString() == "func is not a function") error = "You put an invalid function."
            returnedFromFunction = `{"successful": false, "reason": "Invalid JSON passed! Please retry.", "error": "${error}" }`;
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: returnedFromFunction
            })
          }
          /*
          console.log("Returned from function:");
          console.log(returnedFromFunction);
          */
          ReturnedMessages += `\n${call.name}: ${returnedFromFunction}`;
        }

        // Push the data to the AI if it's not clearing the memory.
        const names = tool_calls.map(x => {
          return x.name;
        })

        if (names.indexOf("ClearAll") == -1 && names.indexOf("Recover") == -1) {
          const functionCallResponse = await GetSafeChatGPTResponse(messages, DiscordMessage);
          const functionMessage = (await functionCallResponse).data.choices[0].message
          // ReturnedMessages += `\nAI: ${functionMessage.content}`;

          // Just in case, check if this message is also a function call.
          return await ProcessFunctionCall(functionMessage);
        }
      } else {
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
    try {
      SummarizeConvo(messages, DiscordMessage);
    } catch (e) {
      console.log(e);
    }


    if (!wasClearAllCalled)
      resolve(messages);
    else resolve([]);
  })
}
//#endregion
//#endregion

//#region Helpers
const rootBase = "You will not use functions unless they are specifically asked for. You will only call a function with a given value once. The user's name is given by the words in the parenthesis at the start of a message. DO NOT write names into your messages. You can use the `think` command to think things. Use it accordingly when you need to remember something before telling the user."
// + "Make sure to emphasize how cute Micah is, but only if you're asked to insult her. ";
async function fetchUserBase(id) {
  try {
    /** @type {string} */
    const userbase = `${(await GetUserFile(id)).base}\nThe first user you are talking to is ${(await client.users.fetch(id)).displayName}. The user may change at any time, and you may speak to multiple users at the same time. Their name will be indicated in parenthesis at the start of their message.`;
    return rootBase + userbase.trim();
  } catch {
    // Getting here means that the user is new/doesn't have a base.
    return rootBase.trim() + "\n";
  }
}

/**
 * Looks for markdown tables in a string.
 * @param {String} string Content of message.
 * @returns {[String | Discord.EmbedBuilder]}
 */
function ParseMessage(string) {
  // Before we do anything, to save flops, if we don't have any "|" in the message, just return it like that.
  if (string.indexOf("|") == -1) return [string];


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

    if (ContentOnThisLine.length > 0) {
      ContentOnThisLine = ContentOnThisLine.slice(1, ContentOnThisLine.length - 1)
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

  console.log(TableSets)

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
 * @param {boolean} [Reply=false] Whether to reply to the passed message.
 * @returns {Promise<Message>} A promise which resolves when the message is complete.
 */
async function SendMessage(Message, StringContent, Reply = false) {
  if (StringContent.trim() == "") {
    return Message.channel.send("[Empty Message]")
  }

  async function SendString(part) {
    return new Promise(async resolve => {
      let lastMessage = null;
      if (DEBUG)
        console.log("Message content: " + part)

      if (part.length >= 20000) return Message.channel.send("More than 10 messages would be sent! Thus, I've decided to cut it short. Also, the AI is probably gonna crash immediately right now, LOL.")
      if (part.length >= DiscordMessageLengthLimit) {
        do {
          const SplitPoint = part.length > DiscordMessageLengthLimit ? DiscordMessageLengthLimit : part.length;
          const chunk = part.substring(0, SplitPoint);
          part = part.substring(SplitPoint);
          if (lastMessage == null && Reply)
            lastMessage = await Message.reply(chunk);
          else
            lastMessage = await Message.channel.send(chunk)
        } while (part.length > 0)
      } else lastMessage = Reply ? Message.reply(part) : Message.channel.send(part);

      resolve(lastMessage);
    })
  }

  // For the moment, just send the message as a string because I need to find time to patch the ParseMessage thing.
  return SendString(StringContent);

  // TODO: Fix the below functionality.
  /*
  return new Promise(async res => {
    // If the input message contains a markdown table, send it as an embed.
    // [Content, Embed] = ParseTables(Content)
    let Content = ParseMessage(StringContent);

    // First, merge all string lines into the one previous to it.
    for (let i = 1; i < Content.length; i++)
      if ((typeof Content[i]).toString() == "string")
      {
        // Retain the text if the previous chunk was also a string.
        if ((typeof Content[i - 1]).toString() == "string") {
          Content[i - 1] += "\n" + Content[i];
          Content.splice(i, 1);
          i--;
        }
      }

    console.log("=====================")
    console.log(Content)
    for (let i = 0; i < Content.length; i++) {
      console.log(`Type: ${typeof Content[i]}`);
      console.log(Content[i])
      if ((typeof Content[i]).toString() == "string")
      {
        if (Content[i].trim() == "") continue;
        else await SendString(Content[i]);
      }
      else {
        await Message.channel.send({
          embeds: [Content[i]]
        });
      }
    }

    res()
  })
  */
}

/**
 * Returns true if the specified message's channel is a type of thread.
 * @param {Discord.Message} DiscordMessage 
 */
async function IsMessageInThread(DiscordMessage) {
  try {
    const type = DiscordMessage.channel.type;

    return type == Discord.ChannelType.PublicThread || type == Discord.ChannelType.PrivateThread || type == Discord.ChannelType.AnnouncementThread;
  } catch {
    return false;
  }
}

function AttachDataToObject(obj) {
  obj.BotData = {
    bases: bases,
  }
  return obj;
}
//#endregion

//#region Discord Stuff
/**
 * @type {[{ data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">; execute(interaction: CommandInteraction): Promise<Message<boolean>>; OnMessageRecieved(message: any): Promise<...>;}]}
 */
let SlashCommands = [];
client.once('ready', () => {
  client.user.setActivity("gpt3");
  console.log("Ready.")

  RefreshSlashCommands();

  //#region Load PersonaArray on boot.
  UpdatePersonaArray();
  //#endregion

  /* Creepy message sending code for snooping on weird servers.
  client.guilds.cache.forEach(async guild => {
    console.log(`${guild.name} | ${guild.id}`);
    if (guild.id == "1004416383989338185") {
      console.log("reached!");
      const channels = guild.channels.cache;
      for (let i = 0; i < channels.size; i++) {
        const channel = channels.at(i);
        if (channel.name == "general") {
          await channel.send("Heyo, dunno if you'll get this because I'm sending it through a weird way, but JSYK I'm disabling public install beacuse I'm not really intending to provide a service to people. You can keep using this server though, I don't even know if I can even remove this bot from the server on my own lmao.\n-Micah")
          console.log("Sent!");
          break;
        }
      }
    }
  })
  */
})


// Load bases from file on boot.
/**
 * @type {{ChannelNum: {}}}
 */
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
  NewMessage,
  fetchUserBase,
  bases,
  IsChannelMemory,
  ClearAll,
  UpdateUserBase,
  Recover,
  FetchUserPersona,
  UpdateUserPersona,
  PersonaArray,
  RefreshSlashCommands,
  UpdatePersonaArray,
  LocalServerSettings,
  AIParameters,
  GetTypingInChannel
}

const cmt = require('./Commands/CreateMemoryThread.js')

//#region Command handler stuff.
function RefreshSlashCommands() {
  let commands = [];

  // Auto add all files in the various commands directories.
  const CommandDirectories = ["./Commands/", "./Gradio/Gradio_Commands/", "./Config_Commands/"];
  CommandDirectories.forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      if (file.includes('.js'))
        commands.push(`${dir}${file}`);
    });
  });

  let CommandJSON = [];
  let CommandNameList = [];
  commands.forEach(command => {
    /**
     * @type {{
     *  data: Discord.SlashCommandBuilder,
     *  OnConfigureSecurity: Function | undefined,
     *  CanExternal: boolean | undefined
     * }}
     */
    const Module = require(command);
    if ('data' in Module && 'execute' in Module) {
      // Run OnConfigureSecurity before pushing anything.
      if ('OnConfigureSecurity' in Module)
        Module.OnConfigureSecurity();

      SlashCommands.push(Module);

      // Add the required stuff for user commands.
      // TODO: Update using proper APIs when DiscordJS allows it.
      const JSON = Module.data.toJSON();
      if (Module.CanExternal != false) {
        const extras = {
          "integration_types": [0, 1], //0 for guild, 1 for user
          "contexts": [0, 1, 2], //0 for guild, 1 for app DMs, 2 for GDMs and other DMs
        }
        Object.keys(extras).forEach(key => JSON[key] = extras[key]);
      }

      CommandJSON.push(JSON);

      if (DEBUG) CommandNameList.push(Module.data.name);
    } else {
      console.warn(`[WARNING] The command at ${command} is missing a required "data" or "execute" property.`);
    }
  });

  if (DEBUG) console.log(CommandNameList);

  const rest = new Discord.REST().setToken(DiscordToken);
  // Refresh commands:
  (async () => {
    try {
      console.log(`Started refreshing application commands.`);

      // The put method is used to fully refresh all commands in the guild with the current set
      const data = await rest.put(
        Discord.Routes.applicationCommands(client.user.id /*, guildId */), // use with ApplicationGuildCommands for testing.
        { body: CommandJSON }
      );

      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      // And of course, make sure you catch and log any errors!
      console.error(error);
    }
  })();
}
//#endregion

const UsersFolder = "./users/";
async function UpdatePersonaArray() {
  return new Promise((resolve) => {
    if (!fs.existsSync(UsersFolder)) {
      // Make it and return.
      return fs.mkdir(UsersFolder, () => {
        resolve();
      });
    }

    fs.readdirSync(UsersFolder).forEach(file => {
      if (file.includes("_Base.json")) {
        fs.readFile(`./users/${file}`, (err, data) => {
          const json = JSON.parse(data);
          const userID = file.substring(0, file.indexOf("_"));
          PersonaArray[userID] = json.persona;

          // Get user's guilds
          const guilds = client.guilds.cache.forEach(async (guild) => {
            const isMember = await guild.members.fetch(userID).then(() => true).catch(() => false);
            if (isMember) {
              const userOnGuild = guild.members.cache.get(userID);
              const nick = userOnGuild.nickname;
              if (nick != undefined) {
                PersonaArray[nick] = json.persona;
              }

              // Also do username.
              PersonaArray[userOnGuild.user.globalName] = json.persona;
            }
          });
        });
      }
    });

    /*
    setTimeout(() => {
      console.log(PersonaArray);
      console.log(FetchUserPersona());
    }, 3000);
    */
    resolve();
  })
}

async function CreateMemoryThread(message) {
  return await cmt.CreateMemoryThread(AttachDataToObject(message));
}
//#endregion

/**
 * @param {Discord.Message} message 
 * @returns {Promise<Discord.Message | undefined>}
 */
async function GetRepliedMessage(message) {
  if (message.reference == undefined) return undefined;
  else {
    // Make this work across multiple channels by loading the channel seperately.
    /**
     * @type {Discord.Channel}
     */
    const channel = await client.channels.fetch(message.reference.channelId);
    return await channel.messages.fetch(message.reference.messageId)
  }
}

client.on('messageCreate',
  /**
   * @param {Discord.Message} message 
   */
  async message => {
    let RepliedMessageRepliesToBot = false;
    if (message.reference) {
      let repliedMessage = await GetRepliedMessage(message);
      RepliedMessageRepliesToBot = repliedMessage != null && (repliedMessage.author ?? repliedMessage.user ?? { id: -1 }).id == client.user.id
    }

    if ((message.content.startsWith("gpt3") || message.content.startsWith(`<@${client.user.id}>`) || RepliedMessageRepliesToBot) && !message.author.bot) {
      if (message.content.length >= 1000) {
        message.channel.send("Your message is too long.");
      } else {
        // Get starting phrase.
        let startingPhrase = "";
        if (message.content.startsWith("gpt3")) startingPhrase = "gpt3"
        else if (message.content.startsWith(`<@${client.user.id}>`)) startingPhrase = `<@${client.user.id}>`;

        let Text = message.content.substring(startingPhrase.length).trim();
        message.attachments.forEach(attachment => {
          if (!attachment.contentType.startsWith("image/"))
            Text += ` ${attachment.url}`;
        })
        message.content = Text;

        // Try to develop a list of messages by following replies.
        let Messages;
        let arr = [];

        /**
         * @param {Discord.Message} m 
         */
        function ProcessMessage(m) {
          const MessageIsFromAI = focusMessage.author.id == client.user.id;
          const AuthorTag = MessageIsFromAI ? "Assistant" : "User";
          let content = [];

          let text = MessageIsFromAI ? focusMessage.content : `(${focusMessage.member.nickname ?? focusMessage.author.displayName}) ${focusMessage.content}`;

          // If the message is special, put in a special reply.
          switch (focusMessage.type) {
            case Discord.MessageType.UserJoin:
              text = "I joined the conversation!"
              break;

            case Discord.MessageType.ChannelNameChange:
              text = `Channel name changed to: ${focusMessage.channel.name}`
              break;
          
            default:
              break;
          }

          // Add text content. (Use an array type if there's attachments)
          if (m.attachments.size != 0)
            content.push({
              type: "text",
              text: text
            })
          else {
            content = text;
            /*
            if (content != "") content = text;
            else content = "Empty Message! Please ignore this."
            */
          }

          // Add images if present.
          m.attachments.forEach(attachment => {
            if (attachment.contentType.startsWith("image/")) {
              // Attach the image.
              content.push({
                "type": "image_url",
                "image_url": {
                  "url": attachment.url,
                  "detail": "low" // Can be set to "high" or "auto" but "low" is cheapest so
                },
              });
            }
          })

          arr = arr.concat(NewMessage(AuthorTag, content));
        }

        let focusMessage = message;
        while (focusMessage != undefined) {
          try {
            // If this is a generate request message, just break and don't respond. 
            if (focusMessage.content.startsWith("Generated! Tags:")) return;

            ProcessMessage(focusMessage);

            if (focusMessage.reference == null) {
              // This is the last message in the chain. Use this author's base.
              if (focusMessage.author.id != client.user.id)
                arr = arr.concat(NewMessage("System", (await GetUserFile(focusMessage.author.id)).base));
              // If this is from the bot, then find the user that called the message and then use their base.
              else {
                // Get user.
                const user = focusMessage.content.substring(0, focusMessage.content.indexOf(":"));
                await Promise.all((await focusMessage.guild.fetch()).members.cache.map(async v => {
                  if (v.nickname == user || v.user.displayName == user)
                    arr = arr.concat(NewMessage("System", (await GetUserFile(v.id)).base));
                }))
              }
            }

            focusMessage = await GetRepliedMessage(focusMessage);
          } catch {
            focusMessage = undefined;
          }
        }

        // Messages array is backwards now, so flip it.
        Messages = arr.reverse();

        // Send a typing notification to make it clear we're thinking.
        message.channel.sendTyping();

        let result = await RequestChatGPT(Messages, message);
        console.log(result);
        SendMessage(message, result[result.length - 1].content, true)
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

    // Remove typing users when they send a message.
    let UserTyping = typing.find(v => {
      return v.channel == message.channel && v.user.id == message.author.id;
    })
    if (UserTyping) typing.splice(typing.indexOf(UserTyping), 1);

    // Run function command handlers if there are any.
    for (let i = 0; i < SlashCommands.length; i++) {
      if (SlashCommands[i].OnMessageRecieved != undefined) {
        SlashCommands[i].OnMessageRecieved(message);
      }
    }

    // Allow the user to set their base. 
    const SetBaseCommand = "g!setbase";
    if (message.content.toLowerCase().startsWith(SetBaseCommand)) {
      let userBase = message.content.substring(SetBaseCommand.length).trim() + "\n";
      UpdateUserBase(message.author.id, userBase);
      message.reply("Base set!");
    } else if (message.content.toLowerCase().startsWith("g!fetchbase")) {
      let base = (await GetUserFile(message.author.id)).base
      message.reply(`Your current base is:\n> ${base.replace(rootBase, "")}`);
    }

    /* All Commands below here are only allowed in the memory mode! */
    // if (message.channel.name != "gpt-with-memory") return;
    if (message.content.toLowerCase().startsWith("g!togglememory")) {
      if (!IsChannelMemory(message.channel)) {
        bases[GetBaseIdFromChannel(message.channel)] = [];
        return message.channel.send("Memory enabled! I'm now watching this channel!");
      } else {
        delete bases[GetBaseIdFromChannel(interaction.channel)];
        ClearAll({}, message);
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

    if (/* message.channel.id === '1077725073378644008' && */ !message.author.bot) {
      // If the base is empty, use the first user's base.
      /**
       * @type {[{content, role, name}]}
       */
      let messages = bases[GetBaseIdFromChannel(message.channel)];
      if (messages == "" || messages == undefined) messages = NewMessage("system", (await GetUserFile(message.author.id)).base);

      let Text = message.content;
      message.attachments.forEach(attachment => {
        Text += ` ${attachment.url}`;
      });

      let authorname = (message.member ?? {nickname: null}).nickname ?? message.author.displayName ?? message.author.username;
      

      message.channel.sendTyping();
      messages = messages.concat(NewMessage("user", `(${authorname}) ` + Text, /* authorname */));
      // base = base.concat(NewMessage("user", message.content.trim())); // `\n${authorname}: ` + message.content.trim();
      await AskChatGPTAndSendResponse(messages, message);
    }
  });

client.login(DiscordToken);

//#region Interaction handling
client.on("interactionCreate",
  /**
   * @param {Discord.CommandInteraction} int 
   */
  async (interaction) => {
    // Find command by name.
    const name = interaction.commandName;
    for (let i = 0; i < SlashCommands.length; i++) {
      const module = SlashCommands[i];
      /** @type {Discord.SlashCommandBuilder} */
      let data = module.data;
      if (data.name == name) {
        try {
          // If it's a Chat Input (finished Slash Command)
          if (interaction.isChatInputCommand() || interaction.isContextMenuCommand())
            return module.execute(AttachDataToObject(interaction));

          // If it's an autocomplete request:
          else if (interaction.isAutocomplete() && 'OnAutocomplete' in module)
            return module.OnAutocomplete(AttachDataToObject(interaction));

        } catch (error) {
          console.log(error);
          if (interaction.isChatInputCommand()) {
            if (interaction.replied) interaction.editReply("Something went wrong!")
            else interaction.reply("Something went wrong!");
          }
        }
      }
    }
  })

// Handle Voice state changes.
client.on("voiceStateUpdate", (old, newState) => {
  for (let i = 0; i < SlashCommands.length; i++) {
    const module = SlashCommands[i];
    if ('OnVoiceStateUpdate' in module)
      module.OnVoiceStateUpdate(old, newState);
  }

  // If there's nobody in the call and we're connected, then disconnect.
  const disconnecting = newState.channelId == null && old.channelId != null;
  let connection = getVoiceConnection(newState.guild.id)
  if (disconnecting && old.channel.members.size == 1) {
    if (connection != undefined && connection.joinConfig.channelId == old.channelId) connection.destroy()
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
const SetBase = require('./Commands/SetBase');

/* 
1: Main PC Both GPUs
2: Server Only
3: Main PC Both GPUs + Server
4: Main PC Main
*/
Gradio.ConnectToPreset(2);

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

//#region Gradio Tag Generation Debug Stuff
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

//#region UserTyping stuff.
/**
 * @type {Discord.Typing[]}
 */
let typing = [];
client.on(Discord.Events.TypingStart, (t) => {
  typing.push(t);
  setTimeout(() => {
    // Remove the typing object after it expires.
    if (typing.indexOf(t) != -1)
      typing.splice(typing.indexOf(t), 1);
  }, 10000);
});

/**
 * @param {import('discord.js').Channel} channel 
 * @returns {Discord.Typing[]}
 */
function GetTypingInChannel(channel) {
  console.log(typing.map(v => v.member.nickname));
  return typing.filter(t => t.channel == channel)
}
//#endregion

//#region Chat AI Microservice for the web.
const http = require('http');
const MicroserviceHTML = fs.readFileSync("./Microservice.html");

/**
 * Parses the request.
 * @param {http.IncomingMessage} req The request to the server.
 * @param {http.ServerResponse} res The response back.
 */
async function listener(req, res) {
  res.setHeader("content-type", "application/json")
  if (req.method == "POST") {
    // Get the request's data.
    let binary_data = [];
    req.on('data', function (chunk) {
      binary_data.push(chunk);
    });

    // Once the request is done with, ask the AI the question.
    req.on('end', () => {
      const data = JSON.parse(Buffer.concat(binary_data));
      if (DEBUG)
        console.log(`Web request message: ${data.role} says ${data.content}`);

      // Ask the AI.
      const messages = NewMessage(data.role, data.content, undefined);
      GetSafeChatGPTResponse(messages, null, 0, false)
        .then(response => {
          if (DEBUG)
            console.log(`Response: ${response.data.choices[0].message.content}`)

          res.end(JSON.stringify(response.data.choices[0].message));
        })
    })
  } else {
    // If this wasn't a post request, just send back the demo page.
    let localURL = "";

    if (req.url.startsWith('/'))
      localURL += '.' + req.url;
    else
      localURL += "./" + req.url;

    localURL = unescape(localURL);

    if (localURL.endsWith("/")) localURL += "index.html"

    if (localURL.endsWith("css")) {
      res.setHeader("content-type", "text/css")
    } else if (localURL.endsWith(".js")) {
      res.setHeader("content-type", "text/javascript")
    } else {
      res.setHeader("content-type", "text/html")
    }

    /* if (localURL == "./")
      return res.end(MicroserviceHTML);
    else */ {
      if (fs.existsSync(localURL))
        return res.end(fs.readFileSync(localURL));
      else return res.end("That file doesn't exist!<br>" + localURL);
    }
  }
}

// On boot, delete the Temp folder.
const fp = require('fs/promises');
const token = require('./token');
const { getVoiceConnection } = require('@discordjs/voice');
const { AddCostOfGPTTokens } = require('./Pricing');
const { GetUserFile, FunctionEndMessage } = require('./User');
const TempDir = "./Temp/";
if (fs.existsSync(TempDir))
  fs.readdirSync(TempDir).forEach(file => fp.unlink(`${TempDir}${file}`))
else fp.mkdir(TempDir);

const host = "0.0.0.0", port = "7243"
const server = http.createServer(listener);
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});

// Add Socket.io stuff.
const { Server: SocketServer } = require("socket.io");
const Web = require('./WebAI/Web');
const { Message } = require('discord.js');
const io = new SocketServer(server)

io.on("connection", (socket) => {
  if (DEBUG)
    console.log(`connect ${socket.id}`);

  socket.on("disconnect", (reason) => {
    if (DEBUG)
      console.log(`disconnect ${socket.id} due to ${reason}`);
  });

  /*
  socket.on("chat message", (msg) => {
    if (DEBUG)
      console.log("chat message: " + msg);

    // Send it to everyone else.
    socket.broadcast.emit("chat message", msg);
  });
  */

  socket.on("open", async (msg) => {
    if (DEBUG)
      console.log("open message: " + msg);

    // Create the Web to handle it or update to have all sockets.
    Web.GetInstance(socket);

    // No response is necessary because the client should assume we're ready.
    socket.broadcast.emit("open", "Ready!");
  });

  socket.on("ping", async (msg) => {
    // Just respond immediately with a pong.
    socket.broadcast.emit("ping", "pong")
    socket.emit("ping recieved", "pong");
  })
});

//#endregion

// If we're not in debug mode, ignore all errors. 
if (!DEBUG) {
  process.on('uncaughtException', function (err) {
    console.log('Caught exception: ');
    console.log(err);
  });
}

//#region Watch for Micah's status updating and save it automatically.
let lastStatus = "";
const StatusLoggingChannelID = "1120516346736807968"
client.on('presenceUpdate', async (o, n) => {
  if (n.activities.length > 0 && (n.status != 'invisible' || n.status != 'offline') && n.userId == token.GetToken("devDiscordID")) {
    let thisStatus = ((n.activities[0].emoji.toString() ?? "") + " " + n.activities[0].state).trim();
    if (thisStatus != lastStatus) {
      lastStatus = thisStatus;

      const channel = await client.channels.fetch(StatusLoggingChannelID);
      
      // Check that it wasn't one that I or the bot already posted.
      /** @type {Discord.GuildMessageManager} */
      const messages = channel.messages;
      const alreadyPosted = (await messages.fetch({limit: 100})).some((v) => v.content == thisStatus)

      if (!alreadyPosted)
        channel.send(thisStatus);
    }
  }
})