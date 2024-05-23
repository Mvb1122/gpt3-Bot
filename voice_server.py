from transformers import pipeline
import soundfile as sf
import torch
import time

used_time = time.time()
embedding_file_name = "./Voice Embeddings/New_Embedding.bin"

device = "cpu"
if (torch.cuda.is_available()): device = "cuda:0"

print("Running audio synth on " + device)

synthesiser = pipeline("text-to-speech", "microsoft/speecht5_tts", device=device)
used_time = time.time() - used_time
print("Loading time: " + str(used_time))

# Gets transcription AI stuff.
def MakeTranscriber():
  from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
  torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
  model_id = "openai/whisper-large-v3"
  model = AutoModelForSpeechSeq2Seq.from_pretrained(model_id, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True)
  model.to(device)
  processor = AutoProcessor.from_pretrained(model_id)

  return pipeline(
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

transcriber = None
def transcribe(path):
  global transcriber
  # Make transcriber if needed.
  if type(transcriber) is type(None):
    transcriber = MakeTranscriber()
    
  return transcriber(path)

def GetEmbedding(location):
  with open(location, "rb") as f:
    return torch.load(f).squeeze(1)

def voice(Text, Embedding, File = "./Temp/Whatever.wav"):
  used_time = time.time()

  # Get speaker embeddings.
  speaker_embedding = GetEmbedding(Embedding)

  speech = synthesiser(Text, forward_params={"speaker_embeddings": speaker_embedding})
  
  # Write to file.
  sf.write(File, speech["audio"], samplerate=speech["sampling_rate"])
  used_time = time.time() - used_time
  print("Generation Time: " + str(used_time))
  return True

def embed(source, target):
  # Calculate speech embeddings.
  import torchaudio
  from speechbrain.inference.speaker import EncoderClassifier
  classifier = EncoderClassifier.from_hparams(source="speechbrain/spkrec-xvect-voxceleb", savedir="pretrained_models/spkrec-xvect-voxceleb", run_opts={"device":device}) # run_opts={"device":"cuda"})
  signal, fs = torchaudio.load(source)
  embeddings = classifier.encode_batch(signal)

  # Here, embeddings is length 2048, so we need to squeeze it down.
  import torch
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
'''

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

app.run(debug=False, port=4963)