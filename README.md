[![DevSkim](https://github.com/Mvb1122/gpt3-Bot/actions/workflows/devskim.yml/badge.svg)](https://github.com/Mvb1122/gpt3-Bot/actions/workflows/devskim.yml) [![CodeQL](https://github.com/Mvb1122/gpt3-Bot/actions/workflows/codeql.yml/badge.svg)](https://github.com/Mvb1122/gpt3-Bot/actions/workflows/codeql.yml)
# gpt3-Bot
A discord bot that allows access to ChatGPT and other misc AIs. Also, if you do find an issue, please open a pull request, I guess.

# AI:
I've bridged together ChatGPT and Stable Diffusion via GPT functions, I guess. The bot is currently running the Stable Diffusion model "AnythingV4.5" because that's what I had acess to on my computer.
There's also a text-to-speech and voice cloning interaction with Microsoft's SpeechT5 that can be fun to toy with, but produces mediocre results overall.
I also added call transcription via OpenAI's Whisper Large V3 model.

# Try it!:
If you want to try the bot, you can [join the discord server](https://discord.com/invite/JNSdRSPBQ4)

# Example videos:
- [A video of generating from plain words](./Example%20Videos/testing_thread____MicahB.Dev_-_Discord_2023-09-16_11-51-12.mp4)
- [A video of generating from conversation](./Example%20Videos/TextToImageBridge-C1.mp4)
- [A video of generating Text-To-Speech](./Example%20Videos/#Voice-Demo%20%20%20Micahb.Dev%20-%20Discord%202024-06-18%2015-16-37-C.mp4)
- [A video of transcribing a voice call and file.](./Example%20Videos/#Transcribe-Demo%20%20%20Micahb.Dev%20-%20Discord%202024-06-18%2015-23-57-C.mp4)

# Setup: 
1. Copy the Repo.
2. `npm i package.json` or whatever
3. Fill up `token_blank.json` and rename it to `token.json`
4. Run `pip install -r requirements.txt` to get stuff for AI voicing.
5. Run start.bat or `node index.js`