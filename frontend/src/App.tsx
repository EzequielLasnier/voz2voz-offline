/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Languages, MessageSquare, History, Volume2, VolumeX, Loader2, AlertCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// --- Helper Functions ---
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// --- Main Component ---
export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelResponding, setIsModelResponding] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("SYSTEM STANDBY");
  const [langIndicator, setLangIndicator] = useState("ES ↔ RU");

  // Refs para conexión local y audio
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]); // Aquí guardaremos la frase completa

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inicializar la conexión WebSocket una sola vez
  useEffect(() => {
    const connectWebSocket = () => {
      // --- AJUSTE WEBAPP: Dirección dinámica ---
      // Esto permite que funcione en localhost, 127.0.0.1 o incluso IP de red local
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/translator`;

      console.log("Conectando a:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          // --- NUEVO: ¿Es un archivo de audio enviado desde Python? ---
          if (event.data instanceof Blob) {
            const audioUrl = URL.createObjectURL(event.data);
            const audio = new Audio(audioUrl);
            audio.play(); // ¡Habla!
            setStatusText("SISTEMA EN ESPERA");
            setIsModelResponding(false);
            return;
          }

          // --- Procesamos el texto normal (JSON) ---
          const data = JSON.parse(event.data);

          if (data.type === "status") {
            setStatusText(data.message);
            setIsModelResponding(
              data.message === "TRADUCIENDO..." || data.message === "GENERANDO VOZ..."
            );
          }

          if (data.type === "transcription" && data.original?.trim() !== "") {
            setLangIndicator(data.lang_detected === "ES" ? "ES → RU" : "RU → ES");
            const newMsg: ChatMessage = {
              id: generateId(),
              role: 'user',
              text: data.original,
              timestamp: Date.now()
            };
            setMessages(prev => [...prev, newMsg].slice(-50));
          }

          if (data.type === "translation" && data.translation?.trim() !== "") {
            const newMsg: ChatMessage = {
              id: generateId(),
              role: 'model',
              text: data.translation,
              timestamp: Date.now()
            };
            setMessages(prev => [...prev, newMsg].slice(-50));
          }
        } catch (err) {
          console.error("Error procesando mensaje del servidor:", err);
        }
      };

      ws.onerror = (e) => {
        console.error("Error en WebSocket:", e);
        setError("Error de conexión con el motor local. Verifica que FastAPI esté corriendo.");
        setIsActive(false);
      };

      // Opcional: Intento de reconexión si se cierra inesperadamente
      ws.onclose = () => {
        console.log("Conexión cerrada. Intentando reconectar en 3s...");
        // setTimeout(connectWebSocket, 3000); 
      };
    };

    connectWebSocket();

    // Limpieza al cerrar la app
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []); // El array vacío asegura que solo se ejecute al montar la app

  // Lógica de Grabación (Push-To-Talk)
  const startSession = async () => {
    setError(null);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("El servidor no está conectado. Espera unos segundos o recarga la página.");
      return;
    }

    try {
      setIsActive(true);
      setStatusText("ESCUCHANDO...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = []; // Limpiamos grabaciones anteriores

      // Mientras hablamos, guardamos el audio en la memoria
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Cuando detenemos la grabación, empaquetamos el archivo y lo enviamos
      mediaRecorder.onstop = async () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          setStatusText("ENVIANDO...");
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          wsRef.current.send(arrayBuffer);
        }
        // Apagamos la luz del micrófono
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(); // Iniciamos grabación continua

    } catch (err: any) {
      if (err.name === 'NotAllowedError') setError("Permiso de micrófono denegado.");
      else setError(`Error al iniciar el micrófono: ${err.message}`);
      setIsActive(false);
    }
  };

  const stopSession = () => {
    setIsActive(false);
    // Al detener el mediaRecorder, se dispara automáticamente el evento 'onstop' que envía el audio
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("El servidor no está conectado. Haz clic en el micrófono una vez para iniciar la conexión local.");
      return;
    }

    // Enviamos el texto envuelto en un JSON
    wsRef.current.send(JSON.stringify({ text: inputText }));

    // (Opcional) Mostramos el mensaje en pantalla instantáneamente
    // Comentamos esto si prefieres que la pantalla se actualice cuando Python responda
    // const newMsg: ChatMessage = { id: generateId(), role: 'user', text: inputText, timestamp: Date.now() };
    // setMessages(prev => [...prev, newMsg].slice(-50));

    setInputText("");
  };

  return (
    <div className="min-h-screen bg-[#E6E6E6] font-sans text-[#151619] flex flex-col items-center justify-center p-4 md:p-8">
      {/* Header */}
      <header className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#151619] p-2 rounded-lg">
            <Languages className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">VozTrans</h1>
            <p className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">Offline Edge AI Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-red-100 text-red-600' : 'bg-white text-[#151619] hover:bg-gray-200'}`}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      {/* Main Widget */}
      <main className="w-full max-w-2xl bg-[#151619] rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px] border border-white/10">

        {/* Status Bar */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              {isActive && !error && (
                <motion.div
                  animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute inset-0 rounded-full bg-green-500 -z-10"
                />
              )}
            </div>
            <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest flex items-center gap-2">
              {error ? (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertCircle size={10} /> System Error
                </span>
              ) : (
                <span className={isActive ? "text-green-400" : "text-white"}>{statusText}</span>
              )}

              {isModelResponding && (
                <span className="flex items-center gap-1 text-emerald-400 ml-2">
                  <Loader2 size={10} className="animate-spin" />
                </span>
              )}
            </span>
          </div>
          <div className="text-[10px] font-mono text-[#8E9299] uppercase">
            {langIndicator}
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <AnimatePresence initial={false}>
            {messages.length === 0 && !isActive && !isConnecting && (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40"
              >
                <MessageSquare size={48} className="text-white" />
                <p className="text-white text-sm max-w-xs">Pulsa el botón para grabar. Vuelve a pulsar para traducir.</p>
              </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={`msg-${msg.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-start' : 'items-end'}`}
              >
                <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user'
                  ? 'bg-white/10 text-white rounded-tl-none'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-tr-none'
                  }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className="mt-2 flex items-center gap-2 opacity-40">
                    <span className="text-[9px] font-mono uppercase">
                      {msg.role === 'user' ? 'Original' : 'Traducción Local'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
            <div key="scroll-anchor" ref={messagesEndRef} />
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="p-6 bg-white/5 border-t border-white/5 flex flex-col items-center gap-6">
          <form
            onSubmit={handleSendText}
            className="w-full flex items-center gap-2 bg-white/5 rounded-xl p-2 border border-white/10 focus-within:border-emerald-500/50 transition-colors"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe en español o ruso..."
              className="flex-1 bg-transparent border-none outline-none text-white text-sm px-2"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 bg-emerald-500 rounded-lg text-white disabled:opacity-50 disabled:bg-gray-600 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>

          <button
            onClick={isActive ? stopSession : startSession}
            disabled={isConnecting}
            className={`group relative w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 ${isActive
              ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
              : 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isActive ? <MicOff className="text-white w-8 h-8" /> : <Mic className="text-white w-8 h-8" />}

            {isActive && (
              <motion.div
                animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 rounded-full bg-red-500 -z-10"
              />
            )}
          </button>

          <p className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">
            {isActive ? 'Tap to Stop & Translate' : 'Tap to Speak'}
          </p>
        </div>
      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error-toast"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-xl z-50"
          >
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">×</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
