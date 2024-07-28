const PricePerToken = 0.0000005;
const PricePerImage = PricePerToken * 500;

const { GetUserFile, GetCurrentDate } = require("./User");

async function AddCostOfGPTTokens(userId, tokencount) {
    const file = await GetUserFile(userId);
    file.cost[GetCurrentDate()] = (file.cost[GetCurrentDate()] ?? 0) + GetCostOfNTokens(tokencount);
    return file.sync();
}

async function AddCostOfImages(userId, imageCount) {
    const file = await GetUserFile(userId);
    file.cost[GetCurrentDate()] = (file.cost[GetCurrentDate()] ?? 0) + GetCostOfNImages(imageCount);
    return file.sync();
}

function GetCostOfNTokens(tokencount) {
    return tokencount * PricePerToken;
}

function GetCostOfNImages(imagecount) {
    return imagecount * PricePerImage;
}

module.exports = {
    AddCostOfGPTTokens, GetCostOfNTokens, AddCostOfImages, GetCostOfNImages
}
