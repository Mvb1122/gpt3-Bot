const { ModelConfig, selectModel, currentModel } = require("./ListSupportedModels");

module.exports = class TemporaryModel {
    #beforeModel = null;

    /**
     * 
     * @param {ModelConfig} newModel 
     */
    constructor(newModel) {
        this.#beforeModel = currentModel();
        selectModel(newModel);
    }

    end() {
        this.#beforeModel.then(v => selectModel(v));
    }
}