const { listSupportedModels, LocalServerSettings, AIParameters } = require("..");
const fs = require('fs');
const { UpdateFunctionCallingRootBase } = require("../User");

class ModelConfig {
    id = ""
    object = "model"
    created = 123
    owned_by = "library"
    thinking = false
    toolSupport = false
    imageSupport = false
}

// On bootup, load in the models.
/**
 * @returns {{modelName: ModelConfig}}
 */
const models = {};
const directory = "./Model Configs/";
fs.readdirSync(directory).filter(v => v.includes(".json")).forEach(v => {
    // Load it in. 
    /**
     * @type {{models: ModelConfig[]}}
     */
    const data = JSON.parse(fs.readFileSync(directory + v).toString());
    data.models.forEach(v => {
        models[v.id] = v;
    });
});

// Safety check. 
listSupportedModels().then(vals => {
    vals.data.forEach(v => {
        if (!(v.id in models)) console.warn("Model id " + v.id + " is not in configurations! Please add it!");
    })
})

/**
 * @returns {{modelName: ModelConfig}}
 */
function ListModelConfigs() {
    return models;
}

const imageOnSetting = {
    state: "mainsupported", 
    separateModel: ""
}

const imageOffSetting = {
    state: "separate", 

    separateModel: "llama3.2-vision"
}

/**
 * Selects a model configuration to use.
 * @param {ModelConfig} mod 
 */
function selectModel(mod) {
    LocalServerSettings.model = mod.id;
    LocalServerSettings.cosmetic = mod.thinking ? "r1" : null;
    LocalServerSettings.FunctionCalls = mod.toolSupport // ? "mainsupported" : "teach"
    LocalServerSettings.ImageBehavior = mod.imageSupport ? imageOnSetting : imageOffSetting

    AIParameters.model = mod.id;
    UpdateFunctionCallingRootBase();
}

/**
 * @param {String} name 
 * @returns {ModelConfig}
 */
function findModelByName(name) {
    return models[name]; // Object.keys(models).filter(v => { return v == name })
}

/**
 * @returns {Promise<ModelConfig>}
 */
async function currentModel() {
    return findModelByName(await LocalServerSettings.model);
}

module.exports = {
    ListModelConfigs,
    selectModel,
    currentModel,
    ModelConfig,
    findModelByName
}