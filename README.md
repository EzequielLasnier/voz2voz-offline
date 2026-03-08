# <img src="Voz2Voz.png" width="40" height="40"> VozTrans - Offline Edge AI

# VozTrans - Offline Edge AI Audio Translator

VozTrans es una aplicación web de traducción en tiempo real bidireccional (Español ↔ Ruso) que funciona 100% offline. Diseñada para entornos educativos, garantiza privacidad absoluta al procesar voz y texto localmente mediante modelos de IA ligeros

## Características Principales

* **Frontend:** React, TypeScript, Vite, Tailwind CSS. (Interfaz multimodal con chat de voz y texto).
* **Backend:** Python, FastAPI, WebSockets.
* **Pipeline de IA (Fases):**
    1. **STT (Speech-to-Text):** `Faster-Whisper` (Modelo 'base' en CPU). Transcribe el audio del usuario.
    2. **Gatekeeper:** Filtro de idioma estricto integrado en Python que rechaza idiomas no soportados.
    3. **LLM (Traducción):** `Ollama` ejecutando `Qwen2.5:1.5b`. Modelo ultraligero con un *System Prompt* estricto para mantener un rol pedagógico, neutral y seguro.
    4. **TTS (Text-to-Speech):** `Silero TTS`. Síntesis neuronal de voz ultrarrápida para generar el audio de respuesta.

## Requisitos Previos e Instalación

### 1. Gestión de Entornos (Conda)

Es fundamental para aislar las dependencias de IA como torch y faster-whisper.

* Descarga e instala Miniconda o Anaconda.

* Abre tu terminal y verifica la instalación con conda --version.

### 2. Motor de IA Local (Ollama)

VozTrans utiliza Ollama para ejecutar el modelo Qwen2.5 sin salir de tu red local.

* Instala Ollama desde ollama.com.

* Ejecuta el siguiente comando para descargar el modelo optimizado de 1.5b parámetros:

```bash
ollama pull qwen2.5:1.5b
```

### 3. Entorno de Ejecución Frontend (Node.js)

Necesario únicamente para generar el "build" inicial que FastAPI servirá.

* Instala Node.js (LTS).

* Verifica con node -v (se recomienda v20 o superior).

## Instalación Rápida

### 1. Clonar y preparar entorno

```bash
git clone https://github.com/EzequielLasnier/voz2voz-offline.git
cd voz2voz-offline/backend
conda env create -f environment.yml
conda activate voz2voz-env
```

### 2. Compilar Frontend (Solo una vez)

Si ya tienes la carpeta frontend/dist, puedes saltar este paso.

```bash
cd ../frontend
npm install
npm run build
```

### 3. Ejecución (One-Click)

Lanzadores automáticos para simplificar el uso en el aula:

* Windows: Ejecuta VozTrans.bat en la raíz.

* Linux Mint: Ejecuta ./VozTrans.sh (recuerda dar permisos con chmod +x).

### 4. Seguridad y Pedagogía

El sistema incluye un System Prompt estricto que:

* Mantiene un rol neutral y asistencial.

* Bloquea lenguaje inapropiado y protege la identidad estudiantil.

* Rechaza intentos de Prompt Injection (ej. "ignora las reglas anteriores").

* Reconduce las interacciones fuera de contexto hacia la asistencia lingüística válida.

* Es ideal para instituciones por su enfoque en soberanía tecnológica.

### Cómo ejecutar la aplicación (Diagnóstico)

```bash
cd backend
conda activate voz2voz-env
python app/main.py
```
