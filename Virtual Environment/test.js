const e2b = require('@e2b/desktop');
const token = require('../token');
const fs = require('fs');

async function test() {
    // Start a new desktop sandbox
    const desktop = await e2b.Sandbox.create({
        apiKey: token.GetToken("e2bKey")
    });

    // Launch an application
    // await desktop.launch('google-chrome') // or vscode, firefox, etc.

    // Wait 10s for the application to open
    await desktop.wait(10000)

    // Stream the application's window
    // Note: There can be only one stream at a time
    // You need to stop the current stream before streaming another application
    await desktop.stream.start({
        windowId: await desktop.getCurrentWindowId(), // if not provided the whole desktop will be streamed
        requireAuth: true,
    })

    // Get the stream auth key
    const authKey = desktop.stream.getAuthKey()

    const streamURL = desktop.stream.getUrl({ authKey });
    // Print the stream URL
    console.log('Stream URL:', streamURL)

    // Download the image. 
    const image = await desktop.screenshot()
    fs.writeFileSync('screenshot.png', image)

    // Kill the sandbox after the tasks are finished
    desktop.kill()
}

test();