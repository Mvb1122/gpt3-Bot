transcription_model_id = "openai/whisper-large-v3-turbo"
musicgen_model_id = "facebook/musicgen-small"
tts_model_id = "microsoft/speecht5_tts"
language_classifier_model_id = "papluca/xlm-roberta-base-language-detection"
translation_model_id = "facebook/nllb-200-distilled-600M"
tango_model = "declare-lab/TangoFlux"
HF_Token = "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"

from transformers import pipeline, AutoProcessor, AutoModelForCausalLM
from transformers.utils import is_flash_attn_2_available
from transformers.utils import is_torch_sdpa_available
import soundfile as sf
import torch
import time
import torchaudio
from audio_denoiser.AudioDenoiser import AudioDenoiser

used_time = time.time()
embedding_file_name = "./Speaker Wavs/New_Embedding.wav"

device = "cpu"
if (torch.cuda.is_available()): device = "cuda:0"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
attn_implementation = None
if is_flash_attn_2_available(): attn_implementation = "flash_attention_2"
elif is_torch_sdpa_available(): attn_implementation = "sdpa"

print("Running audio synth on " + device)
print("Attn mode: " + str(attn_implementation))
synthesiser = None
# synthesiser = pipeline("text-to-speech", tts_model_id, device=device)
# synthesiser.model.compile() # Compile the model for just an ounce more performance.

# Gets transcription AI stuff.
def MakeTranscriber():
  global transcriber
  from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
  torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
  model_id = transcription_model_id
  model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id, torch_dtype=torch_dtype, 
    low_cpu_mem_usage=True, 
    use_safetensors=True,
    attn_implementation=attn_implementation
  )
  model.to(device)
  processor = AutoProcessor.from_pretrained(model_id)

  transcriber = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    max_new_tokens=128,
    chunk_length_s=30,
    batch_size=16,
    return_timestamps=False,
    torch_dtype=torch_dtype,
    device=device,
  )
  
  return transcriber

transcriber = None
def transcribe(path):
  global transcriber
  # Make transcriber if needed.
  if type(transcriber) is type(None):
    transcriber = MakeTranscriber()
    
  return transcriber(path)

translator = None
last_trans_to = None
last_trans_from = None
def MakeTranslator(to_lang, from_lang):
  # Even though this could be done by Whisper, I'm using a seperate model for simplicity's sake.
  global translator, last_trans_to, last_trans_from
  
  if not (type(translator) is type(None)): del translator
  
  translator = pipeline('translation',model=translation_model_id, device=device, src_lang=from_lang, tgt_lang=to_lang)
  last_trans_to = to_lang
  last_trans_from = from_lang

def Translate(natural, from_lang, to_lang):
  global transtokenizer, translator, last_trans_from, last_trans_to
  
  if (from_lang == "auto"): from_lang = DetermineLanguage(natural)
  if (to_lang == "auto"): to_lang = 'eng_Latn'
  
  if (type(translator) is type(None)) or not ((to_lang is last_trans_to) or (from_lang is last_trans_from)): MakeTranslator(to_lang, from_lang)
  
  natural = str(natural)
  translation = translator(natural, max_length=len(natural) * 10)[0] # Set a ridiculously high maximum length in order to avoid cutting stuff off.
  translation['from_lang'] = from_lang
  return translation

LanguageDeterminer = None
def DetermineLanguage(text):
  global LanguageDeterminer
  if type(LanguageDeterminer) is type(None): 
    LanguageDeterminer = pipeline("text-classification", model=language_classifier_model_id, device=device)
    
  return LanguageDeterminer(text, top_k=1, truncation=True)[0]['label']

# print("Language: '" + DetermineLanguage("こんにちは皆さん！") + "'")

def GetEmbedding(location):
  with open(location, "rb") as f:
    return torch.load(f).squeeze(1)


from TTS.api import TTS
speech_sample_rate = 24000
def voice(Text, Embedding, File = "./Temp/Whatever.wav", lang=None):
  global synthesiser
  if type(synthesiser) == type(None):
     # Create TTS model in advance.
    synthesiser = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

  used_time = time.time()

  # Get speaker embeddings.
  # speaker_embedding = GetEmbedding(Embedding)

  # speech = synthesiser(Text, forward_params={"speaker_embeddings": speaker_embedding, "threshold": 0.4})
  
  # Write to file.
  # sf.write(File, speech["audio"], samplerate=speech["sampling_rate"])
  
  # prevent memory leaks.
  # del speech
  # del speaker_embedding
  
  synthesiser.tts_to_file(text=Text,
    file_path=File,
    speaker_wav=Embedding,
    language=lang, 
    split_sentences=True
  )

  used_time = time.time() - used_time
  print("Generation Time: " + str(used_time))
  return True

denoiser = None
def embed(source, target):
  global denoiser
  if type(denoiser) == type(None):
    # Load Denoiser
    denoiser = AudioDenoiser(device=torch.device(device))

  # First, denoise audio.
  # signal, fs = torchaudio.load(source)
  # auto_scale = True # Recommended for low-volume input audio
  # signal = denoiser.process_waveform(waveform=signal, sample_rate=speech_sample_rate, auto_scale=auto_scale)
    # In new version, just denoise and save for later. 
  if not ("Speaker Wavs" in target):
    target = "./Speaker Wavs/" + target

  denoiser.process_audio_file(source, target, True)
  return

  # Calculate speech embeddings.
  from speechbrain.inference.speaker import EncoderClassifier
  classifier = EncoderClassifier.from_hparams(source="speechbrain/spkrec-xvect-voxceleb", savedir="pretrained_models/spkrec-xvect-voxceleb", run_opts={"device":device})
  embeddings = classifier.encode_batch(signal)

  # Here, embeddings is length 2048, so we need to squeeze it down.
  embeddings = torch.nn.functional.normalize(embeddings[:, :512], dim=-1).squeeze([1]) # Changes size from [1, 1, 1, 512] to [1, 512]

  # Write embeddings to a file.
  print(embeddings.size())
  with open(target, "wb") as f:
    if not ("Voice Embeddings" in target):
      target = "./Voice Embeddings/" + target

    torch.save(embeddings, f)
    return target

'''
# Debug stuff.
voice("Hello there.", embedding_file_name, "./Temp/Default.wav")
voice("Hello there.", "./Voice Embeddings/connie.bin", "./Temp/Connie.wav")

Make_Music("fast-paced jazz music", "out.wav")
'''

def Make_Composer():
  return pipeline("text-to-audio", musicgen_model_id, device=device, torch_dtype=torch.float16)

composer = None
def Make_Music(prompt, output, length = 5):
  global composer
  if type(composer) is type(None): composer = Make_Composer()
  
  length_in_tokens = length * composer.model.config.audio_encoder.frame_rate
  
  music = composer(prompt, forward_params={"max_new_tokens": length_in_tokens})
  sf.write(output, music["audio"][0].T, music["sampling_rate"])
  return True

from PIL import Image
import requests

# Read Web URLS properly.
def load_image(location):
  if "http" in location:
    location = requests.get(location, stream=True).raw
  return Image.open(location).convert("RGB") # Must convert to RGB for safety!

florenceProcessor = None
florenceModel = None
def Caption_Image(location, mode):
  global florenceModel, florenceProcessor
  if type(florenceModel) is type(None):
    florenceModel = AutoModelForCausalLM.from_pretrained("multimodalart/Florence-2-large-no-flash-attn", torch_dtype=torch_dtype, trust_remote_code=True).to(device)
    florenceProcessor = AutoProcessor.from_pretrained("multimodalart/Florence-2-large-no-flash-attn", trust_remote_code=True)

  image = load_image(location)
  inputs = florenceProcessor(text=mode, images=image, return_tensors="pt").to(device, torch_dtype)

  generated_ids = florenceModel.generate(
      input_ids=inputs["input_ids"],
      pixel_values=inputs["pixel_values"],
      max_new_tokens=1024,
      num_beams=3
    )
  generated_text = florenceProcessor.batch_decode(generated_ids, skip_special_tokens=False)[0]

  parsed_answer = florenceProcessor.post_process_generation(generated_text, task=mode, image_size=(image.width, image.height))

  if (mode == "<OD>"):
    parsed_answer[mode]['image'] = Make_Object_Detection_Image(image, parsed_answer[mode])

  return parsed_answer[mode]


import matplotlib.pyplot as plt  
import matplotlib.patches as patches  
def Make_Object_Detection_Image(image, data):
  # Create a figure and axes  
  fig, ax = plt.subplots()  
    
  # Display the image  
  ax.imshow(image)  
    
  # Plot each bounding box  
  for bbox, label in zip(data['bboxes'], data['labels']):  
      # Unpack the bounding box coordinates  
      x1, y1, x2, y2 = bbox  
      # Create a Rectangle patch  
      rect = patches.Rectangle((x1, y1), x2-x1, y2-y1, linewidth=1, edgecolor='r', facecolor='none')  
      # Add the rectangle to the Axes  
      ax.add_patch(rect)  
      # Annotate the label  
      plt.text(x1, y1, label, color='white', fontsize=8, bbox=dict(facecolor='red', alpha=0.5))  
    
  # Remove the axis ticks and labels  
  ax.axis('off')  
    
  # Save the plot to a file  
  path = './Temp/OD_Image.png'
  plt.savefig(path, bbox_inches='tight', pad_inches=0.0)
  plt.close(fig)
  return path

# Manga OCR
mangaOCRFeatureExtractor = None
mangaOCRModel = None
mangaOCRTokenizer = None

import re
from transformers import AutoTokenizer, VisionEncoderDecoderModel, AutoFeatureExtractor
import jaconv

def Manga_OCR(location):
  global mangaOCRFeatureExtractor, mangaOCRModel, mangaOCRTokenizer
  
  # If we haven't loaded up the Manga OCR model, load it up.
  if type(mangaOCRFeatureExtractor) is type(None): 
    mangaOCRTokenizer = AutoTokenizer.from_pretrained("kha-white/manga-ocr-base")
    mangaOCRModel = VisionEncoderDecoderModel.from_pretrained("kha-white/manga-ocr-base")
    mangaOCRFeatureExtractor = AutoFeatureExtractor.from_pretrained("kha-white/manga-ocr-base")

  # Now get the image.
  img = load_image(location)
  img = img.convert('L').convert('RGB') # Makes it grayscale. Still necessary to manually crop into the text you want!
  pixel_values = mangaOCRFeatureExtractor(img, return_tensors="pt").pixel_values
  output = mangaOCRModel.generate(pixel_values)[0]
  text = mangaOCRTokenizer.decode(output, skip_special_tokens=True)

  # Fix the text so it doesn't have so many spaces.
  text = ''.join(text.split())

  # Fix dot characters.
  text = text.replace('…', '...')
  text = re.sub('[・.]{2,}', lambda x: (x.end() - x.start()) * '.', text)

  # Ensure all JP text is full-width, including numbers and letters.
  text = jaconv.h2z(text, ascii=True, digit=True)
  return text

# Diarization stuff.
from pyannote.audio import Pipeline as PyanPipeline
Diarizer = None
def Diarize(path, maxSpeakers):
  global Diarizer
  if type(Diarizer) is type(None): 
    Diarizer = PyanPipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_Token)
    Diarizer.to(torch.device(device))

  diarization = Diarizer(path, max_speakers=maxSpeakers)

  # Put the output to a string.
  out = []
  for turn, _, speaker in diarization.itertracks(yield_label=True):
    t = {
       "start": f"{turn.start:.1f}",
       "stop": f"{turn.end:.1f}",
       "speaker": f"{speaker}"
    }
    out.append(t)

  return out

# Time Series Prediction stuff
from autogluon.timeseries import TimeSeriesPredictor, TimeSeriesDataFrame

def Predict(location, out, reps = 20):
  # Load data.
  df = TimeSeriesDataFrame(location)

  # Build Prediction model and predict out.
  predictor = TimeSeriesPredictor(prediction_length=reps, freq='D').fit(
    df,
    hyperparameters={
        "Chronos": {"model_path": "amazon/chronos-bolt-small"},
    },
  )

  predictions = predictor.predict(df)

  # Save out
  predictions.to_csv(out)

sfxMaker = None
def Make_SFX(prompt, output, length = 5):
  global sfxMaker
  if type(sfxMaker) is type(None): 
     from tangoflux import TangoFluxInference
     sfxMaker = TangoFluxInference(name=tango_model, device = device)
  
  music = sfxMaker.generate(prompt, steps=25, duration=length)

  sf.write(output, music[0].T, 44100)

# Server stuff.
from flask import Flask, jsonify, request
app = Flask(__name__)

# { location: "wherever", text: "hello there", embed: "whatever" }
@app.route('/gen', methods=['POST'])
def voice_function():
    if request.is_json:
        data = request.get_json()
        if 'text' in data and 'location' in data:
            # Use embed if it exists.
            emb = ""
            if 'embed' in data: emb = data['embed']
            else: emb = embedding_file_name; 

            lang = ''
            if ('lang' in data): lang = data['lang']
            # else: lang = DetermineLanguage(data['text'])
            else: lang = 'en'
            
            if not ("./Speaker Wavs/" in emb): emb = "./Speaker Wavs/" + data['embed']

            result = voice(Text=data['text'], Embedding=emb, File=data['location'], lang=lang)
            return jsonify({'message': result}), 200
        else:
            return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
    else:
        return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400

@app.route('/embed', methods=['POST'])
def embed_function():
    if request.is_json:
        data = request.get_json()
        if 'source' in data and 'output' in data:
            result = embed(data['source'], data['output'])
            return jsonify({'message': result}), 200
        else:
            return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
    else:
        return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400

@app.route('/transcribe', methods=['POST'])
def transcribe_function():
  if request.is_json:
      data = request.get_json()
      if 'source' in data:
          return jsonify({'message': transcribe(data['source'])}), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400

@app.route('/preload_transcribe', methods=['POST', 'GET'])
def preload_transcribe():
  global transcriber
  # Make transcriber if needed.
  if type(transcriber) is type(None):
    transcriber = MakeTranscriber()

  return jsonify({'Message': True}), 200

@app.route("/gen_music", methods=['POST'])
def music_function():
  if request.is_json:
      data = request.get_json()
      
      output = "./out.wav"
      if 'output' in data:
        output = data['output']
      length = 5
      if 'length' in data:
        length = data['length']
        
      if 'prompt' in data:
          Make_Music(data['prompt'], output, length)
          return jsonify({'message': True}), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400
  
@app.route("/gen_sfx", methods=['POST'])
def sfx_function():
  if request.is_json:
      data = request.get_json()
      
      output = "./out.wav"
      if 'output' in data:
        output = data['output']
      
      length = 5
      if 'length' in data:
        length = data['length']
        
      if 'prompt' in data:
          Make_SFX(data['prompt'], output, length)
          return jsonify({'message': True}), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400

@app.route("/determineLanguage", methods=['POST'])
def DetermineLanguage_function():
  if request.is_json:
      data = request.get_json()
        
      if ('text' in data):
          return jsonify({ 'code': DetermineLanguage(data['text']) }), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400
    
@app.route("/translate", methods=['POST'])
def translate_function():
  if request.is_json:
      data = request.get_json()
        
      if ('natural' in data) and ('to' in data) and ('from' in data):
          return jsonify(Translate(data['natural'], data['from'], data['to'])), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400
  
@app.route("/caption", methods=['POST'])
def caption_function():
  if request.is_json:
      data = request.get_json()
        
      if ('location' in data) and ('mode' in data):
          return jsonify(Caption_Image(data['location'], data['mode'])), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400
  
@app.route('/manga_ocr', methods=['POST'])
def manga_ocr_function():
  if request.is_json:
    data = request.get_json()
      
    if ('location' in data):
        return jsonify(Manga_OCR(data['location'])), 200
    else:
        return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400

@app.route("/diarize", methods=['POST'])
def diarize_function():
  if request.is_json:
      data = request.get_json()
        
      if 'location' in data:
          return jsonify(Diarize(data['location'], data['maxSpeakers'] or None)), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400
  
@app.route("/predict", methods=['POST'])
def predict_function():
  if request.is_json:
      data = request.get_json()
        
      if 'location' in data and 'out' in data:
          return jsonify(Predict(data['location'], data['out'], data['reps'] or None)), 200
      else:
          return jsonify({'error': 'Invalid JSON structure', 'data': data}), 400
  else:
      return jsonify({'error': 'Request must be JSON', 'data': request.form }), 400

app.run(debug=False, port=4963)

# Log out loading time properly.
used_time = time.time() - used_time
print("Loading time: " + str(used_time))