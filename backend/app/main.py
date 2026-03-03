import os
import io
import json
import asyncio
import requests
import torch
import uvicorn
import soundfile as sf

import mimetypes

# --- FORZAR TIPOS MIME PARA WEBAPP ---
# Esto asegura que Windows y Linux reconozcan .js como JavaScript
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles  # NUEVO
from fastapi.responses import FileResponse   # NUEVO
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

app = FastAPI(title="Voz2Voz Offline WebApp")

# Permite que el frontend y backend se hablen sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# INICIALIZACIÓN DE MODELOS (Se mantiene igual)
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

print("Cargando modelo Faster-Whisper...")
whisper_model = WhisperModel("base", device="cpu", compute_type="int8", download_root=str(MODELS_DIR))
print("¡Modelo Whisper cargado!")

print("Cargando modelos de Voz (Silero TTS)...")
device = torch.device('cpu')
model_ru, _ = torch.hub.load(repo_or_dir='snakers4/silero-models', model='silero_tts', language='ru', speaker='v4_ru')
model_ru.to(device)
model_es, _ = torch.hub.load(repo_or_dir='snakers4/silero-models', model='silero_tts', language='es', speaker='v3_es')
model_es.to(device)
print("¡Voces cargadas!")

# ---------------------------------------------------------
# LÓGICA DEL WEBSOCKET (Tu código original intacto)
# ---------------------------------------------------------
@app.websocket("/ws/translator")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("UI Frontend conectada con éxito.")
    await websocket.send_json({"type": "status", "message": "SYSTEM STANDBY"})
    
    try:
        while True:
            mensaje = await websocket.receive()
            texto_detectado = ""
            idioma = ""

            if "bytes" in mensaje:
                print("Audio recibido...")
                await websocket.send_json({"type": "status", "message": "ESCUCHANDO..."})
                audio_bytes = mensaje["bytes"]
                audio_file = io.BytesIO(audio_bytes)
                audio_file.name = "audio.webm" 
                segments, info = whisper_model.transcribe(audio_file, beam_size=5)
                texto_detectado = "".join([segment.text for segment in segments]).strip()
                idioma = info.language.upper() 

            elif "text" in mensaje:
                import re
                datos = json.loads(mensaje["text"])
                texto_detectado = datos.get("text", "").strip()
                if not texto_detectado: continue
                await websocket.send_json({"type": "status", "message": "PROCESANDO TEXTO..."})
                idioma = "RU" if bool(re.search(r'[А-Яа-я]', texto_detectado)) else "ES"

            if idioma not in ["ES", "RU"]:
                await websocket.send_json({"type": "transcription", "original": f"⚠️ Idioma no admitido ({idioma}).", "lang_detected": idioma})
                continue 

            await websocket.send_json({"type": "transcription", "original": texto_detectado, "lang_detected": idioma})
            await websocket.send_json({"type": "status", "message": "TRADUCIENDO..."})
            idioma_destino = "RUSO" if idioma == "ES" else "ESPAÑOL"
            
            instrucciones_sistema = f"Traductor estricto {idioma} -> {idioma_destino}. Solo texto traducido."

            def traducir_con_ollama():
                try:
                    res = requests.post("http://localhost:11434/api/chat", json={
                        "model": "qwen2.5:1.5b",
                        "messages": [{"role": "system", "content": instrucciones_sistema},
                                   {"role": "user", "content": f"Traduce: '{texto_detectado}'"}],
                        "stream": False,
                        "options": {"temperature": 0.1}
                    })
                    return res.json().get("message", {}).get("content", "").strip()
                except: return "Error: Verifica Ollama."

            texto_traducido = await asyncio.to_thread(traducir_con_ollama)
            await websocket.send_json({"type": "translation", "translation": texto_traducido, "lang_target": "RU" if idioma == "ES" else "ES"})
            
            await websocket.send_json({"type": "status", "message": "GENERANDO VOZ..."})
            
            def generar_audio_silero(texto, idioma_dest):
                sr = 48000
                model = model_ru if idioma_dest == "RUSO" else model_es
                spk = 'xenia' if idioma_dest == "RUSO" else 'es_1'
                audio_tensor = model.apply_tts(text=texto, speaker=spk, sample_rate=sr)
                wav_io = io.BytesIO()
                sf.write(wav_io, audio_tensor.numpy(), sr, format='WAV', subtype='PCM_16')
                return wav_io.getvalue()

            try:
                wav_bytes = await asyncio.to_thread(generar_audio_silero, texto_traducido, idioma_destino)
                await websocket.send_bytes(wav_bytes)
            except Exception as e: print(f"Error TTS: {e}")

    except WebSocketDisconnect: print("UI Frontend desconectada.")
    except Exception as e: print(f"Error: {e}")

# ==============================================================================
# SECCIÓN WEBAPP: SERVIR FRONTEND DESDE FASTAPI (Fase 2 corregida)
# ==============================================================================

# 1. Calculamos la raíz real del proyecto (subiendo un nivel desde 'backend')
# Si BASE_DIR apunta a 'backend', necesitamos subir uno para ver 'frontend'
ROOT_DIR = os.path.dirname(BASE_DIR) 
FRONTEND_DIST_DIR = os.path.join(ROOT_DIR, "frontend", "dist")

print(f"DEBUG: Buscando WebApp en: {FRONTEND_DIST_DIR}") # Esto te ayudará a verificar

# 2. Montar archivos estáticos
assets_path = os.path.join(FRONTEND_DIST_DIR, "assets")
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

# 3. Servir index.html
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    # Si falla, te mostrará en el navegador dónde la está buscando exactamente
    return {"error": f"No se encontró index.html en: {index_path}"}

# ---------------------------------------------------------
# EJECUCIÓN (Ajustado para producción)
# ---------------------------------------------------------
if __name__ == "__main__":
    # Cambiamos uvicorn.run("main:app"...) por uvicorn.run(app...) para mayor estabilidad
    # Usamos host 0.0.0.0 para que sea visible en red local
    uvicorn.run(app, host="0.0.0.0", port=8000)