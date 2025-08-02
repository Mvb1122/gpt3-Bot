/**
 * TODO!
 */

const e2b = require('@e2b/desktop');
const token = require('../token');

module.exports = class environment {
    /**
     * @type {Promise<import('@e2b/desktop').Sandbox>}
     */
    desktop = null;

    #stream = null;

    constructor() {
        this.desktop = e2b.Sandbox.create({
            apiKey: token.GetToken("e2bKey")
        });

        this.desktop.stream.start({
            requireAuth: true,
        })
    }

    /**
     * Returns a b64 screenshot of the current application.
     */
    screenshot() {

    }
}