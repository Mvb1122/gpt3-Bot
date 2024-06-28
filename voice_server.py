transcription_model_id = "openai/whisper-large-v3"
musicgen_model_id = "facebook/musicgen-stereo-small"
tts_model_id = "microsoft/speecht5_tts"
language_classifier_model_id = "papluca/xlm-roberta-base-language-detection"
whisper_model_id = "openai/whisper-large-v3"
translation_model_id = "facebook/nllb-200-distilled-600M"

from transformers import pipeline
from transformers.utils import is_flash_attn_2_available
from transformers.utils import is_torch_sdpa_available
import soundfile as sf
import torch
import time
import torchaudio
from audio_denoiser.AudioDenoiser import AudioDenoiser
from threading import Timer

used_time = time.time()
embedding_file_name = "./Voice Embeddings/New_Embedding.bin"

device = "cpu"
if (torch.cuda.is_available()): device = "cuda:0"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
attn_implementation = None
if is_flash_attn_2_available(): attn_implementation = "flash_attention_2"
elif is_torch_sdpa_available(): attn_implementation = "sdpa"

print("Running audio synth on " + device)
print("Attn mode: " + str(attn_implementation))
synthesiser = pipeline("text-to-speech", tts_model_id, device=device)

# Also load denoiser.
denoiser = AudioDenoiser(device=torch.device(device))
used_time = time.time() - used_time
print("Loading time: " + str(used_time))

# Gets transcription AI stuff.
def MakeTranscriber():
  global transcriber
  from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
  torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
  model_id = whisper_model_id
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

def GetEmbedding(location):
  with open(location, "rb") as f:
    return torch.load(f).squeeze(1)

def voice(Text, Embedding, File = "./Temp/Whatever.wav"):
  used_time = time.time()

  # Get speaker embeddings.
  speaker_embedding = GetEmbedding(Embedding)

  speech = synthesiser(Text, forward_params={"speaker_embeddings": speaker_embedding, "threshold": 0.4})
  
  # Write to file.
  sf.write(File, speech["audio"], samplerate=speech["sampling_rate"])
  
  # prevent memory leaks.
  del speech
  del speaker_embedding
  
  used_time = time.time() - used_time
  print("Generation Time: " + str(used_time))
  return True

def embed(source, target):
  # First, denoise audio.
  signal, fs = torchaudio.load(source)
  auto_scale = True # Recommended for low-volume input audio
  signal = denoiser.process_waveform(waveform=signal, sample_rate=16000, auto_scale=auto_scale)

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
            
            if not ("./Voice Embeddings/" in emb): emb = "./Voice Embeddings/" + data['embed']

            result = voice(Text=data['text'], Embedding=emb, File=data['location'])
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

app.run(debug=False, port=4963)