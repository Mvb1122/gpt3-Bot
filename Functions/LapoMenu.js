const Discord = require('discord.js');

const periodIds = {
  breakfast: "5776",
  lunch: "5777",
  dinner: "5778"
}

function getCurrentDate() {
  const now = new Date();
  const month = now.getMonth() + 1;
  return `${month}/${now.getDate()}/${now.getFullYear()}`
}

const makeURL = (period) =>
  `https://universityofnewmexico.campusdish.com/api/menu/GetMenus?locationId=84752&storeIds=&mode=Daily&date=${getCurrentDate()}&time=&periodId=${periodIds[period]}&fulfillmentMethod=`

module.exports = {
  keywords: Object.keys(periodIds).concat(["menu", "La Posada", "lapo", "la po"]).join(','),
  json:
  {
    "name": "LapoMenu",
    "description": "Looks up food menu information.",
    "parameters": {
      "type": "object",
      "properties": {
        "period": {
          "type": "string",
          "description": "Either \"breakfast\", \"lunch\", or \"dinner\""
        },
      }
    },
    "required": []
  },

  /**
   * Code run when the module is executed.
   * @param {{period: 'lunch' | 'dinner' | 'breakfast'}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   */
  async execute(parameters, DiscordMessage = null) {
    if (Object.keys(periodIds).some(v => v == parameters.period.toLowerCase())) {
      const url = makeURL(parameters.period.toLowerCase());
      /**
       * @type {{Menu: {MenuProducts: [{Product: {MarketingName: string}}]}}}
       */
      const json = await (await fetch(url)).json();
      
      return json.Menu.MenuProducts.map(v => v.Product.MarketingName).join("\n");
    } else {
      return "Please specify a time period to get the menu for!"
    }
  }
}