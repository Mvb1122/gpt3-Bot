const { GetSafeChatGPTResponse, GPTMessage, NewMessage } = require(".");

const DefaultFeedbackPhrase = NewMessage("User", "Please make sure to respond with one of the keywords you know! Make sure to write it exactly as it was given to you!");

module.exports = 
    /**
     * @param {GPTMessage[]} testMessages Array of messages, should have a seperate message for the text to judge.
     * @param {String[]} keywords 
     * @param {GPTMessage | undefined} feedbackPhrase 
     * @returns {Promise<String | null>} The keyword last found. Null if not found.
     */
    async (testMessages, keywords, feedbackPhrase = DefaultFeedbackPhrase) => {
        // Deep clone messages.
        const internalMessages = JSON.parse(JSON.stringify(testMessages));

        // First, pose the question.
        const response = GetSafeChatGPTResponse(internalMessages, undefined, 0, false);

        // Try to extract an answer.
        let r = 0;
        do {
            const message = (await response).data.choices[0].message;
            
            // Look for the indexes.
            const indexes = keywords.map(v => {
                // Find index.
                return {
                    index: message.content.lastIndexOf(v),
                    word: v 
                };
            })
                .toSorted((a, b) => {
                    return b.index - a.index; // Reversed sort means Highest -> Lowest
                });

            console.log(indexes);

            // If there's a valid one, find it and return.
            if (indexes.some(v => (v.index != -1))) {
                return indexes[0].word;
            } else {
                // Otherwise, ask for clarification.
                internalMessages = internalMessages.concat(message);
                internalMessages = internalMessages.concat(feedbackPhrase);
                response = GetSafeChatGPTResponse(internalMessages, undefined, 0, false);
            }
        } while (r < 10)
        
        return null;
    }


// Debug tests.
if (false) {
    // Tests.
    const test = require('node:test');
    
    test('LLM Judge test', () => {
        return new Promise(async (v, r) => {
            const messages = NewMessage("System", "You are an expert text judgement AI. When given text, you will answer with TRUE, or FALSE, judging if the statement is valid or not.")
                .concat(NewMessage("User", "The sky is blue."));

            if (await this.Judge(messages, ["TRUE", "FALSE"]) == "TRUE") v(true);
            else r(false);
        })
    })
}