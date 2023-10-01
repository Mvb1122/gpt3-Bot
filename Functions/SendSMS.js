let LastMessageText = "", LastMessageNumber = "-1"
const tokens = require('../token.js')

module.exports = {
    keywords: "text me, text, SMS",
    json: 
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
    
    async execute(parameters, DiscordMessage) {
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
          Authorization: tokens.GetToken("clicksendauthorization"),
          'Content-type': 'application/json',
          'X-RapidAPI-Key': tokens.GetToken("x-rapidapi-key"),
          'X-RapidAPI-Host': 'clicksend.p.rapidapi.com'
        },
        body: body
      };
      const url = 'https://rest.clicksend.com/v3/sms/send';
    
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
}