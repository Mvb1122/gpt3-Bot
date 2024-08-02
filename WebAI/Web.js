const { Socket } = require("socket.io");
const { RequestChatGPT, NewMessage } = require("..");
const { GetUserFile } = require("../User");
const token = require("../token");

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
            this.Messages = this.Messages.concat(NewMessage("User", msg));
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

    /**
     * Creates a WebMessage.
     * @param {Web} Source
     */
    constructor(Source) {
        this.SourceWeb = Source;

        // If this ever overlaps with itself, I will literally :3 in real life.
        this.id = Math.floor(Math.random() * 10000000);

        // Bind the send method to ensure it has the correct context
        this.send = this.send.bind(this);

        this.channel = {
            send: this.send,
        }
        
        this.reply = this.send;
    };

    #sendInternal(type, content) {
        (this.SourceWeb ?? Instance).EmitAll(`Function Message`, `${this.id}-${type} ${content}`);
    }

    /**
     * Sends the message to all clients.
     * @param {String | {*}} text 
     */
    send(text) {
        return this.#sendInternal("Send", text);
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