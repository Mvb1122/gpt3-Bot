const tokens = require('../token');

function ToFahrenheit(tempInK) {
    return 9 / 5 * (tempInK - 273) + 32
}

module.exports = {
    keywords: "Weather, warm, cold, hot, Get the Weather",
    json: 
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

    async execute(parameters, message) {
      let town = parameters.town;
      let apiKey = tokens.GetToken("openweathermap");
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
}