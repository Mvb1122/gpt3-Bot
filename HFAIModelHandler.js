//Ignore ts(80001)
module.exports = {
    /**
     * Creates a Hugging Face Model Handler. Useful for simple tasks, but probably needs to be deup'd for more complex stuff.
     * @param {String} model Hugging Face URL for the model.
     * @returns {{ Preload: () => Promise<void>; Run: (q: string) => Promise<any>; }}
     */
    CreateModelHandler(model, type, params = {}) {
        let pipe = undefined;
        // Loads the AI in advance to decrease time-to-response for user.
        async function Preload() {
            // Allocate a pipeline for sentiment-analysis
            const { pipeline } = await import("@xenova/transformers");
            pipe = await pipeline(type, model, { quantized: false });
        }

        /**
         * Gets the voice line for a thing.
         * @param {String} q Thing to pass to the AI.
         * @returns {Promise<*>} Data from AI.
         */
        async function Run(q) {
            // Don't preload until first call.
            if (pipe == undefined) await Preload();

            return new Promise(async res => {
                pipe(q, params).then(result => {
                    res(result);
                })
            });
        }

        const handler = {
            Preload, Run
        };

        return handler
    }
}