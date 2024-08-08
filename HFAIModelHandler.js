// This has its own debug because it can get quite spammy at times.
const DEBUG = false;

//Ignore ts(80001)
module.exports = {
    /**
     * Creates a Hugging Face Model Handler. Useful for simple tasks, but probably needs to be deup'd for more complex stuff.
     * @param {String} model Hugging Face URL for the model.
     * @param {string} type Hugging Face type of the model.
     * @param {{}} [params={}] Model parameters to pass.
     * @param {number} [timeout=3000] How long to wait before cleaning up the model.
     * @returns {{Preload: () => Promise<void>;Run: (q: string) => Promise<any>;SetParams: (p: any) => void;}}
     */
    CreateModelHandler(model, type, params = {}, timeout = 5000, quantized = false) {
        if (DEBUG) console.log(`Handler for ${model} created!`);

        let pipe = undefined;
        let lastUseTime = undefined;
        // Loads the AI in advance to decrease time-to-response for user.
        async function Preload() {
            if (DEBUG) console.log(`Loading model for ${model}!`);

            // Allocate a pipeline for the task.
            const { pipeline } = await import("@xenova/transformers");
            pipe = await pipeline(type, model, { quantized: quantized });
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
                const currentUseTime = lastUseTime = performance.now();
                pipe(q, params).then(result => {
                    res(result);

                    // If the pipe isn't used in the timeout period, then close it down.
                    setTimeout(() => {
                        if (currentUseTime == lastUseTime) {
                            lastUseTime = pipe = undefined;
                            if (DEBUG) console.log(`Unloading model for ${model}!`);
                        }
                    }, timeout);
                })
            });
        }

        function SetParams(p) {
            params = p;
            return;
        }

        const handler = {
            Preload, Run, SetParams
        };

        return handler
    }
}