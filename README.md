# VozTrans - Offline Edge AI Audio Translator

VozTrans es una aplicación web de traducción en tiempo real (Voz-a-Voz y Texto-a-Voz) bidireccional entre **Español** y **Ruso**. Su principal característica es que funciona **100% offline**, garantizando privacidad absoluta y procesamiento en el "Edge" (localmente) sin depender de APIs en la nube.

Está optimizada para ejecutarse en equipos sin GPU dedicada, utilizando modelos de Inteligencia Artificial ligeros y altamente eficientes.

## Arquitectura del Sistema

* **Frontend:** React, TypeScript, Vite, Tailwind CSS. (Interfaz multimodal con chat de voz y texto).
* **Backend:** Python, FastAPI, WebSockets.
* **Pipeline de IA (Fases):**
    1. **STT (Speech-to-Text):** `Faster-Whisper` (Modelo 'base' en CPU). Transcribe el audio del usuario.
    2. **Gatekeeper:** Filtro de idioma estricto integrado en Python que rechaza idiomas no soportados.
    3. **LLM (Traducción):** `Ollama` ejecutando `Qwen2.5:1.5b`. Modelo ultraligero con un *System Prompt* estricto para mantener un rol pedagógico, neutral y seguro.
    4. **TTS (Text-to-Speech):** `Silero TTS`. Síntesis neuronal de voz ultrarrápida para generar el audio de respuesta.

## Requisitos Previos

Antes de instalar, asegúrate de tener en tu sistema:

* [Node.js](https://nodejs.org/) (v20 o superior).
* [Python](https://www.python.org/) (3.10 o superior) o Miniconda.
* [Ollama](https://ollama.com/) instalado y ejecutándose en segundo plano.

## Guía de Instalación

### 1. Clonar el repositorio

```bash
git clone [https://github.com/tu-usuario/voz2voz-offline.git](https://github.com/tu-usuario/voz2voz-offline.git)
cd voz2voz-offline
```

### 2. Configurar el Motor de Traducción (Ollama)

Descarga el modelo de lenguaje optimizado ejecutando en tu terminal:

```bash
ollama run qwen2.5:1.5b
# Una vez que aparezca el prompt ">>>", escribe /bye y presiona Enter.
```

### 3. Configurar el Backend (Python)

Se recomienda usar un entorno virtual (Conda o venv).

```bash
cd backend
conda create -n voz2voz-env python=3.10 -y
conda activate voz2voz-env
pip install -r requirements.txt
```

### 4. Configurar el Backend (Python)

Abre otra terminal y navega a la carpeta del frontend:

```bash
cd frontend
npm install
```

## Cómo ejecutar la aplicación

Necesitarás dos terminales abiertas en simultáneo.

Terminal 1 (El Cerebro - Backend):

```bash
cd backend
conda activate voz2voz-env
python app/main.py
```

(Nota: La primera vez que lo ejecutes, tardará unos minutos en descargar los modelos acústicos de Whisper y Silero).

Terminal 2 (La Interfaz - Frontend):

```bash
cd frontend
npm run dev
```

Abre tu navegador en la dirección que indique Vite (usualmente <http://localhost:5173>). ¡Presiona el micrófono para hablar o usa la barra de texto para escribir!

## Medidas de Seguridad Integradas

El sistema cuenta con un System Prompt diseñado para entornos educativos y profesionales que:

Rechaza intentos de Prompt Injection (ej. "ignora las reglas anteriores").

Bloquea lenguaje inapropiado y se niega a evaluar personas o estudiantes.

Reconduce las interacciones fuera de contexto hacia la asistencia lingüística válida.
