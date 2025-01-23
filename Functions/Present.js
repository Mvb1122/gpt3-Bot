const Discord = require('discord.js');
const path = require('path');
const { NewMessage, GetSafeChatGPTResponse, DEBUG } = require('..');
const fs = require('fs'); const fp = require('fs/promises');
const { exec, spawn } = require('child_process'); // Added spawn
const VoiceV2 = require('../VoiceV2');
const GetImagesToText = require('./Marp/GetImagesToText');
const { GetRandomVoice } = require('../Commands/TTSToVC');
const FetchSources = require('./Marp/FetchSources');
const CreateSourceSlide = require('./Marp/CreateSourceSlide');

const MarpExplanation = fs.readFileSync("./Functions/Marp/Explanation.txt").toString();
const YAMLHeader = fs.readFileSync("./Functions/Marp/YAMLHeader.txt").toString();

const themes = ["default", "gaia", "gaia\n_class: lead\nbackgroundColor: #fff\nbackgroundImage: url('https://marp.app/assets/hero-background.svg')", "gaia\n_class: lead", "gaia\n_class: invert", "uncover"]
function GetYAMLHeader() {
  // Select a random theme and slot it in. Should give more visual uniqueness.
  const randomTheme = themes[Math.floor(Math.random() * themes.length)];
  return YAMLHeader.replace("{{theme}}", randomTheme);
}

module.exports = {
  keywords: "present, marp, presentation",
  json:
  {
    "name": "present",
    "description": "Creates a presentation and sends it to the user.",
    "parameters": {
      "type": "object",
      "properties": {
        "topic": {
          "type": "string",
          "description": "The content of the presentation to send. If there's a page limit, make sure to include it here."
        },
        "showmessages": {
          "type": "boolean",
          "description": "Whether to create the presentation with context from your previous conversation. Defaults false."
        },
        "voiceover": {
          "type": "boolean",
          "description": "Whether to voice-over/create a video from the slides. Defaults false."
        },
        "research": {
          "type": "boolean",
          "description": "Whether to spend time researching the topic at hand. Should only be used for factual topics."
        }
      }
    },
    "required": ["text"]
  },

  /**
   * Code run when the module is executed.
   * @param {{topic: string, showmessages: boolean, voiceover: boolean, research: boolean}} parameters Parameters from AI.
   * @param {Discord.Message | Discord.CommandInteraction} DiscordMessage 
   * @param {[{role: string, content: string}]} messages 
   */
  execute(parameters, DiscordMessage = null, messages) {
    // If we're doing a voiceover, we better get ready to read the audio aloud.
    let preload = null;
    if (parameters.voiceover && !VoiceV2.Started) preload = VoiceV2.Preload();

    if (!DiscordMessage) return "Unable to call this function right now!"
    else
      return new Promise(async mainRes => {
        let FilesForDeletion = [];
        const startTime = performance.now();

        let messageContent = `Presentation creation queued!\n\`\`\`Topic: ${parameters.topic}\nShow Messages: ${parameters.showmessages}\nVoice Over: ${parameters.voiceover}\nResearch: ${parameters.research}\`\`\``;
        // Tell the client we're making the presentation.
        let ouputMessage = await DiscordMessage.channel.send(messageContent);
        // res("Presentation creation queued.");

        // Work on the presentation via internal messages.
        /**
         * @type {[{role: String, content: String}]}
         */
        let internalMessages = [];
        if (parameters.showmessages) internalMessages = messages.map(v => v);
          // Create a copy of messages if we're using it.
        
        // Add in a message about how to use the system and what we're doing.
        internalMessages = internalMessages.concat(NewMessage("System", MarpExplanation))
          .concat(NewMessage("User", "This time, I would like you to create a presentation based on this topic: " + parameters.topic + "\nHowever, before we get started, I'd like you to take a moment to consider what should be on the presentation. What sort of topics do you think should be included? Make sure to be detailed in your description. Give a rough layout for the slides at the end of your answer." + (parameters.voiceover ? " Your presentation process will involve making a voiceover, so make sure to include a vague idea of what should be included in the voice over. Of course, slides and voiceovers must work together, so make a note on how the spoken content can improve and expand upon the text of each slide." : "")));

        // Get the AI's response.
        const resp1 = await GetSafeChatGPTResponse(internalMessages, null, 0, false);
        internalMessages.push(resp1.data.choices[0].message);
        ouputMessage.edit(messageContent += "\nIdeation complete!");

        // Get a search term and wikipeedia term.
          // Splinter this off of the main conversation to save tokens later.
        const imageSearchMessages = internalMessages.concat(NewMessage("User", "What's a quick search term you'd use to look up images for this presentation? Only write the search term. Search terms are simple, like \"coffee\", \"used EV\" or any other vaguely specific, but not too specific term."));
        const resp1a = GetSafeChatGPTResponse(imageSearchMessages, null, 0, false);
        
        // Wikipedia search is very similar.
        const wikiSearchMessages = internalMessages.concat(NewMessage("User", "What's a quick Wikipedia search term you'd use to look up a wikipedia article for this presentation? Only write the search term. Search terms are mildly specific, like \"Coffee\", \"Toyota Prius\", \"Engine\" or any other vaguely specific, but not too specific term. Don't try to write it fancily, just write it in plain English."));
        const resp1b = parameters.research ? GetSafeChatGPTResponse(wikiSearchMessages, null, 0, false) : null;
        
          // Run the two search term requests in parallel for speed. (Thus await them at the same time.)
        await Promise.all([resp1a, resp1b]); // Somehow Promise.all has a sort of magic that makes this better. 
        const searchTerm = (await resp1a).data.choices[0].message.content;
        const wikiTerm =  parameters.research ? (await resp1b).data.choices[0].message.content : null;
        
        // Now ask for actual presentation.
        const imageText = GetImagesToText(searchTerm);

          // Only do the search if we're including research.
        const sources = parameters.research ? FetchSources(wikiTerm) : null;
        if (parameters.research) {
          sources.then(() => {
            // Put the update to the log message.
            ouputMessage.edit(messageContent += "\nSource fetch complete!");
          })
          internalMessages = internalMessages.concat(
            NewMessage("User", "I've done some research for you to have more information. You may mark which source gave what text to you via putting its number in square brakets. Here's the text of the articles:\n\n" + (await sources).map((v, i) => `## ${i}: ${v.title}:\n${v.text}`).join("\n"))
          )
        }

        internalMessages = internalMessages.concat(  
          NewMessage("User", `Now, let's make that exact presentation output for Marp. As a reminder, please only write the presentation. Please make your presentation as long as is necessary/limited! Make sure to have the number of slides requested. Do not write anything except for the presentation. Do not write a slide showing your sources. Do not include \`\`\` in your answer unless you're creating a code block. Make sure to split your presentation into pages using ---\nAdditionally, make sure to use markdown syntax for images, like ![](URL HERE)\n${await imageText}\n\nMAKE SURE to split your slides with ---`)
        );
        ouputMessage.edit(messageContent += "\nImage fetch complete!");
        const resp2 = await GetSafeChatGPTResponse(internalMessages, null, 0, false);
        const filteredSlides = resp2.data.choices[0].message.content.split("---").filter(v => v.trim() != "").join("\n---\n");
        const outputContent = filteredSlides + (parameters.research ? CreateSourceSlide(await sources) : ""); // By adding the source slide to the AI's output, we can get it to read over and thank viewers during it == easy to skip segment.

        // Edit that last message to remove the wikipedia article.
        // internalMessages[internalMessages.length - 1].content = internalMessages[internalMessages.length - 1].content.replace(fullWikiText, "");

        internalMessages.push(resp2.data.choices[0].message);
        ouputMessage.edit(messageContent += "\nPresentation writing complete!");

        // Now write it to a file.
        const id = Math.floor(Math.random() * 100000);
        const input = "./Temp/Presentation_" + id + ".md";
        const outputFile = "./Temp/Presentation_" + id + ".pdf";
        await fp.writeFile(input, GetYAMLHeader() + outputContent);
        FilesForDeletion = FilesForDeletion.concat([input, outputFile]);

        // Use NPX to get the output file as a pdf regardless of whether there's a voiceover.
        const inputFile = path.resolve(input);
        const args = [
          // "@marp-team/marp-cli@latest",
          `"${inputFile}"`,
          "-o", `"${path.resolve(outputFile)}"`,
          "-y"
        ];
        const command = `marp ${args.join(" ")}`; // npx
        console.log(`Spawning! \`${command}\``); 
        
        const marpProcess = spawn(command, { shell: true, detached: true });
        marpProcess.unref(); // Allow the parent process to exit independently

        marpProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error(`Process exited with code ${code}`);
          } else {
            console.log('Presentation created successfully.');
            // Now it's done so we can send the file out.
            const TimeTakenMessage = `\nTime Taken: ~${((performance.now() - startTime) / 1000 / 60).toFixed(2)} minutes.`
            ouputMessage = await ouputMessage.reply({
              content: "Finished Presentation! See PDF attached!" + (parameters.voiceover ? " Video will be created shortly." : "") + TimeTakenMessage,
              files: [outputFile, inputFile]
            });

            if (!parameters.voiceover)
              mainRes("Presentation creation finished! Tell user to check for the file.");
          }
        });

        // If we're doing a voiceover, then make the images.
        if (parameters.voiceover) {
          // Now we really need to wait for voice capability to be online.
          await preload;
          const voice = GetRandomVoice();

          const args = [
            // "@marp-team/marp-cli@latest",
            "--images", "png",
            `"${path.resolve(input)}"`,
            "--image-scale", 2
          ];
          const command = `marp ${args.join(" ")}` // npx
          console.log(`Spawning! \`${command}\``); 
          
          const marpProcess = spawn(command, { shell: true, detached: true });
          marpProcess.unref(); // Allow the parent process to exit independently
  
          marpProcess.on('close', async (code) => {
            if (code !== 0) {
              console.error(`Process exited with code ${code}`);
            } else {
              console.log('Presentation images created successfully.');
              let voiceOvers = "";

              internalMessages = internalMessages.concat(NewMessage("User", "Now we're going to move towards making a voiceover. Make sure to say more than is just on the slide. Do not include any stage directions, eg: `pause for a short moment` or `indicate X`. DO NOT just read the slides exactly. YOU MUST ONLY SPEAK IN WORDS. DO NOT TRY TO SAY AN IMAGE ALOUD. DO NOT USE ANY SYNTAX. DO NOT talk about stuff on other slides. DO NOT try to split into different slides. DO NOT READ THE ENTIRE TEXT OF THE PRESENTATION."));
              
              // Now it's done so we can start making voiceovers.
              const slides = outputContent.split("---").filter(v => {return v.trim() != ""});
              /**
               * @type {Promise<{path: string, index: number}>[]}
               */
              const filePromises = (await fp.readdir(path.resolve("./Temp/"))).filter(
                v => v.includes(id) && v.includes(".png")
              )/* .filter((v, i) => slides[i] != "") Marp does this filter for us. */.map((v, i, a) => {                
                return new Promise(async res => {
                  // Create the voice-over for the slide. (We do this without including previous slides to save tokens and increase performance.)
                    // NVM changed mind to do it in sequence because it prevents information from being repeated.
                    // Actually, we kinda have to do it slide-by-slide because otherwise we get an async memory issue!
                  let endMessage = "";
                  if (i == 0) endMessage = "This is the first slide, so please introduce the topic of the presentation, and welcome people in, before your summary."
                  else if (i == a.length - 1) endMessage = "This is the last slide, so please thank people for watching."
                  else endMessage = "This isn't the first or the last slide."

                  const thisRunMessages = internalMessages.concat(NewMessage("User", "How would you voice over JUST this slide below? Make sure to keep your voiceover brief, as if you were speaking.\n" + "```" + slides[i] + "```\nAs a reminder, please only summarize the slide in this message. Don't include any markdown syntax. Do NOT repeat yourself. The slide in this message is contained within three ```. That's what you should summarize.\n" + endMessage));
                  const resp3 = await GetSafeChatGPTResponse(thisRunMessages, null, 0, false);
                  const voiceText = resp3.data.choices[0].message.content;
                  // thisRunMessages = thisRunMessages.concat(NewMessage("Assistant", resp3.data.choices[0].message.content));
                  
                  const audioPath = `./Temp/Audio_${id}_${i}.wav`;
                  await VoiceV2.Voice(voiceText, audioPath, voice);
                  ouputMessage.edit(messageContent += "\nVoiced Slide #" + (i + 1) + "!");
                  voiceOvers += `# SLIDE ${i + 1} VOICEOVER\n${voiceText}\n\n`;
                  
                  // Use FFMPEG to make the video for this slide.
                  // ffmpeg -loop 1 -i img.jpg -i audio.wav -shortest out.mp4
                  const imagePath = path.resolve(`./Temp/${v}`);
                  const outputVideoPath = path.resolve(`./Temp/Video_${id}_${i}.mp4`)
                  const args = [
                    "-loop", 1, "-i", `"${imagePath}"`, "-i", `"${path.resolve(audioPath)}"`, "-shortest",  "-c:v", "h264_nvenc",`"${outputVideoPath}"`
                  ]
                  const command = `ffmpeg ${args.join(" ")}`;
                  console.log("Spawning! `" + command + '`');
                  const ffmpegInside = spawn(command, { shell: true, detached: true });
                  ffmpegInside.unref(); // Allow the parent process to exit independently
                  
                  FilesForDeletion = FilesForDeletion.concat([audioPath, imagePath, outputVideoPath]);
                  await new Promise(res2 => {
                    ffmpegInside.on('close', () => {
                      ouputMessage.edit(messageContent += "\nMade video for Slide #" + (i + 1) + "!");
                      res2();    
                    });
                  });

                  res({
                    path: outputVideoPath,
                    index: i
                  });
                })
              });

              // Wait some time for the voicing to complete.
              /*
              await new Promise(res => {
                setTimeout(res, 3000 * files.length);
              })
              */

              // Come up with a name for the presentation.
              internalMessages = internalMessages.concat(NewMessage("User", "What's a simple, short name for this presentation? Just write the name only, please."));
              const resp4 = await GetSafeChatGPTResponse(internalMessages, null, 0, false);
              const title = resp4.data.choices[0].message.content
                // Sanatize file name.
                .replace(/[<>:"/\\|?*]/g, '');
              internalMessages.push(resp4.data.choices[0].message);

              // Add title to VA file.
              voiceOvers += `\n# TITLE: ${title}\n`

              // Sort to make sure that videos end up in the right order.
              /**
               * @type {{path: string;index: number;}[]}
               */
              let files = await Promise.all(filePromises);
              files = files.sort((a, b) => a.index - b.index);

              // Concat all video paths.
              let filterMap = "";
              let args = [];
              for (let i = 0; i < files.length; i++) {
                args.push("-i");
                args.push(`"${path.resolve(files[i].path)}"`);
                filterMap += `[${i}:v] [${i}:a] `;
              }
              ouputMessage.edit(messageContent += "\nMaking final video!");
              const FinalVideoOutput = path.resolve(`./Functions/Marp/Presentations/${title.substring(0, 100)}.mp4`);
              args = args.concat([
                "-filter_complex", `"${filterMap.trim()} concat=n=${files.length}:v=1:a=1 [v] [a]"`, "-map", "[v]", "-map", "[a]", "-r", "2", "-pix_fmt", "yuv420p", "-c:v", "h264_nvenc", `"${FinalVideoOutput}"`
              ]);

              // Run the final video encoding.
              const command = `ffmpeg ${args.join(" ")}`;
              console.log("Spawning! `" + command + '`');
              const ffmpegInside = spawn(command, { shell: true, detached: true });
              ffmpegInside.unref(); // Allow the parent process to exit independently

              await new Promise(res2 => {
                ffmpegInside.on('close', async () => {
                  ouputMessage.edit(messageContent += "\nFinal video uploading!");
                  res2();    
                });
              });

              // Okay, now we've got the final video. We can send it.
              const VoiceOversFile = path.resolve(`./Temp/VA_${id}.md`);
              const TimeTakenMessage = `\nTime Taken: ~${((performance.now() - startTime) / 1000 / 60).toFixed(2)} minutes.`
              await fp.writeFile(VoiceOversFile, voiceOvers.trim());
              await ouputMessage.reply({
                content: "Finished video!" + TimeTakenMessage,
                files: [FinalVideoOutput, VoiceOversFile]
              });

              // Save final video output.
              FilesForDeletion = FilesForDeletion.concat([/* FinalVideoOutput */, VoiceOversFile]);
              mainRes("The final video is complete! Tell the user to look at it! :)")

              // Now we can finally delete all the files!!!
              if (!DEBUG)
                FilesForDeletion.forEach(v => {
                  fp.unlink(v);
                });
            }
          });
        }
      })
  }
}