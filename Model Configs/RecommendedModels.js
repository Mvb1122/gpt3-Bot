const { findModelByName, currentModel } = require("./ListSupportedModels");

module.exports = {
    fast: findModelByName("qwen3:0.6b"),
    normal: currentModel(),
    pointing: findModelByName("qwen2.5vl:7b")
}