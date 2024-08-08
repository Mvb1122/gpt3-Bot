const { Socket } = require("socket.io");
const { RequestChatGPT, NewMessage, client } = require("..");
const { GetUserFile } = require("../User");
const token = require("../token");
const { User } = require("discord.js");
const fp = require('fs/promises');
const path = require("path");
const XMLHttpRequest = require('xhr2');

/**
 * @type {Web}
 */
let Instance = null;

class Web {
    /** @type {Socket[]} */
    sockets = [];

    /** [{
        role: string;
        content: string;
        name: string;
    }] */
    Messages = [];

    Username = "";

    /** @type {User} */
    User = null;

    /**
     * Creates a new Web AI handler.
     * @param {Socket} socket Socket to listen on.
     */
    constructor(socket) {
        // Come up with an ID. 
        Instance = this;

        // Load the dev's base into the AI's memory.
        GetUserFile(token.GetToken("devDiscordID")).then(v => {
            this.Messages = NewMessage("System", v.base);
        })

        // Use the dev's name.
        client.guilds.fetch(token.GetToken("devServerID")).then(async v => {
            const member = await v.members.fetch(token.GetToken("devDiscordID"));
            this.User = member;
            this.Username = member.nickname ?? member.user.displayName;
        })

        this.UpdateSocket(socket)

        console.log("WebAI Handler opened.")
    };

    /**
     * Adds a new socket to talk over.
     * @param {Socket} socket 
     */
    UpdateSocket(socket) {
        // Add listener.
        this.sockets.push(socket);
        socket.on("chat message", async (msg) => {
            // Send it to everyone else.
            socket.broadcast.emit("chat message", msg);
            
            // Request a completion and send it back.
            this.Messages = this.Messages.concat(NewMessage("User", `(${this.Username}) ` + msg));
            const response = await RequestChatGPT(this.Messages, this);
            
            // Only send back the AI's response, since functions should handle themselves.
            this.EmitAll("chat response", response[response.length - 1].content)
        });
    }

    EmitAll(type, content) {
        for (let i = 0; i < this.sockets.length; i++)
            this.sockets[i].emit(type, content);
    }

    /**
     * Creates a fake Discord Message.
     * @returns {WebMessage}
     */
    CreateMessage() {
        return new WebMessage(this);
    }
}

/**
 * Fakes looking like a Discord Message.
 */
class WebMessage {
    /** @type {Web} */
    SourceWeb;

    id = 0;

    guildId = 0;

    /** @type {User} */
    user = null;

    /**
     * Creates a WebMessage.
     * @param {Web} Source
     */
    constructor(Source) {
        this.SourceWeb = Source;

        // If this ever overlaps with itself, I will literally :3 in real life.
        this.id = Math.floor(Math.random() * 10000000);

        // Use dev server for guild id.
        this.guildId = token.GetToken("devServerID");

        // Bind the send method to ensure it has the correct context
        this.send = this.send.bind(this);

        this.channel = {
            send: this.send,
        }
        
        this.reply = this.send;

        this.user = Source.User;
    };

    #sendInternal(type, content) {
        (this.SourceWeb ?? Instance).EmitAll(`Function Message`, `${this.id}-${type} ${content}`);
    }

    /**
     * Sends the message to all clients.
     * @param {{files: [string], content: string}} text string | 
     */
    send(text) {
        return new Promise((resolve, reject) => {
            const Promises = [];
            if (typeof(text) != String) {
                // This is a Discord Message object, meaning it probably has files or whatnot. So, let's push the files forward.
                if (text.files) text.files.forEach(f => {
                    Promises.push(new Promise(async res => {
                        // Upload file to the server.
                        const data = await fp.readFile(f);
                        const actualData = data.buffer;
                        const SplitPath = path.parse(f);
                        let name = "../Canvas/@Res/" + SplitPath.name + SplitPath.ext;
                        name = name.replaceAll(" ", "_")
                        var url = "https://micahb.dev/FTP/Post_Modules/Upload.js&target=" + name;

                        var xhr = new XMLHttpRequest();
                        xhr.open("POST", url);
                        xhr.setRequestHeader("Content-Type", data.type);

                        xhr.onreadystatechange = () => {
                            if (xhr.readyState === 4) {
                                res();
                            }
                        };

                        // Read and send the file.
                        xhr.send(actualData);
                    }))
                })

                text = JSON.stringify(text);
            }
            
            Promises.push(this.#sendInternal("Send", text));   
            
            Promise.all(Promises).then(() => {resolve();})
        })
    };

    editable() { return true; };

    edit(text) {
        this.#sendInternal("Edit", text);
    };
}

/**
 * @param {Socket} socket Socket.io socket to use for communication.
 * @returns {Web} The current web instance or a new one if nonexistant.
 */
function GetInstance(socket) {
    if (Instance == null) Instance = new Web(socket);
    else {
        // Add the new socket.
        Instance.UpdateSocket(socket);
    }

    return Instance;
}

module.exports = 
{
    Web, GetInstance
}