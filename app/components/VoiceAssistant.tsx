/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

type AssistantAction =
  | {
      type: "apply_filters";
      filters: {
        search?: string;
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        inStock?: boolean;
        sortBy?: "name" | "price" | "stock" | "category";
        sortOrder?: "asc" | "desc";
      };
      openFilters?: boolean;
    }
  | { type: "open_product"; id: string };

export default function VoiceAssistant({
  onAction,
}: {
  onAction?: (action: AssistantAction) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [pendingSpeech, setPendingSpeech] = useState<string | null>(null);
  const [resumePayload, setResumePayload] = useState<
    | {
        action: AssistantAction;
        transcript: string;
        ts: number;
      }
    | null
  >(null);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);
      setError("");

      const ttsResponse = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!ttsResponse.ok) {
        let errMsg = "Error al generar audio";
        try {
          const errJson = await ttsResponse.json();
          errMsg = errJson?.error || JSON.stringify(errJson);
        } catch (e) {
          console.log(e);
          const errText = await ttsResponse.text();
          errMsg = errText || errMsg;
        }
        console.error("TTS API response not ok:", errMsg);
        setError(`TTS: ${errMsg}`);
        setIsSpeaking(false);
        return;
      }

      const contentType = ttsResponse.headers.get("Content-Type") || ttsResponse.headers.get("content-type") || "";
      if (!contentType.includes("audio")) {
        const txt = await ttsResponse.text();
        console.error("TTS returned non-audio response:", txt);
        setError("TTS devolvió un contenido no reproducible");
        setIsSpeaking(false);
        return;
      }

      const audioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        try {
          await audioRef.current.play();
        } catch (playErr) {
          const errObj = playErr as any;
          if (errObj?.name === "NotAllowedError") {
            // Autoplay bloqueado: encolar para reproducir en la primera interacción del usuario
            setPendingSpeech(text);
            setIsSpeaking(false);
            return;
          }
          console.error("Error reproduciendo audio:", playErr);
          setError("No se pudo reproducir el audio en este navegador");
          setIsSpeaking(false);
        }
      }
    } catch (err) {
      console.error("Error al reproducir audio:", err);
      setError("Error al reproducir audio");
      setIsSpeaking(false);
    }
  };

  const handleVoiceCommand = async (command: string) => {
    try {
      setError("");
      const normalizedCommand = command.toLowerCase().trim();

     if (resumePayload) {
        const confirmPhrases = [
          'sí', 'si', 'sí continuar', 'si continuar', 'sí, continuar', 'si, continuar',
          'por supuesto', 'claro', 'adelante', 'sí, por favor', 'si, por favor',
          'sí, continúa', 'si, continua', 'continúa', 'continua', 'sí, sigue', 'si, sigue',
          'correcto', 'afirmativo', 'de acuerdo', 'ok', 'okay', 'vale', 'de acuerdo',
          'sí, quiero continuar', 'si, quiero continuar', 'quiero continuar'
        ];

        const denyPhrases = [
          'no', 'no gracias', 'no, gracias', 'no quiero', 'no deseo', 'cancelar',
          'desechar', 'descartar', 'olvídalo', 'olvidalo', 'no, gracias', 'no, no quiero',
          'no, no deseo', 'no, cancela', 'no, olvídalo', 'no, olvidalo', 'mejor no',
          'ahora no', 'en otro momento', 'más tarde', 'luego', 'después', 'no por ahora'
        ];

        const isConfirmation = confirmPhrases.some(phrase => 
          normalizedCommand.includes(phrase)
        );
        
        const isDenial = denyPhrases.some(phrase => 
          normalizedCommand.includes(phrase)
        );

        if (isConfirmation) {
          onAction?.(resumePayload.action);
          const confirmationMsg = "Perfecto, continuando con tu búsqueda anterior.";
          setResponse(confirmationMsg);
          setResumePayload(null);
          try {
            await speakResponse(confirmationMsg);
          } catch (e) {
            console.log(e);
          }
          return;
        } else if (isDenial) {
          const dismissalMsg = "Entendido, he descartado la búsqueda anterior. ¿En qué más puedo ayudarte?";
          setResponse(dismissalMsg);
          setResumePayload(null);
          try {
            localStorage.removeItem("va:last_intent");
            await speakResponse(dismissalMsg);
          } catch (e) {
            console.log(e);
          }
          return;
        }
        // If neither confirmation nor denial, continue with normal command processing
      }

      // Normal command processing
      const aiResponse = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: command }),
      });

      if (!aiResponse.ok) {
        const txt = await aiResponse.text();
        console.error("Assistant API error:", txt);
        setError("Error del asistente: " + (txt || "respuesta no válida"));
        return;
      }

      const json = await aiResponse.json();
      const aiText = json?.response || json?.text || "";
      setResponse(aiText);

      const action = json?.action as AssistantAction | null | undefined;
      if (action && typeof action === "object" && typeof action.type === "string") {
        onAction?.(action);

        try {
          if (typeof window !== "undefined") {
            const payload = {
              ts: Date.now(),
              transcript: command,
              action,
            };
            localStorage.setItem("va:last_intent", JSON.stringify(payload));
          }
        } catch (e) {
          console.log(e);
        }
      }

      await speakResponse(aiText);
    } catch (err) {
      console.error("Error:", err);
      setError("Error al procesar el comando");
    }
  };

  // Check for resume payload on mount
  useEffect(() => {
    const checkResumePayload = () => {
      try {
        if (typeof window !== "undefined") {
          const alreadyShown = sessionStorage.getItem("va:resume_shown") === "1";
          if (!alreadyShown) {
            const raw = localStorage.getItem("va:last_intent");
            if (raw) {
              const parsed = JSON.parse(raw);
              const ts = typeof parsed?.ts === "number" ? parsed.ts : 0;
              const transcript = typeof parsed?.transcript === "string" ? parsed.transcript : "";
              const action = parsed?.action as AssistantAction | undefined;
              const maxAgeMs = 24 * 60 * 60 * 1000;
              if (ts > 0 && Date.now() - ts <= maxAgeMs && action && typeof action.type === "string") {
                setResumePayload({ ts, transcript, action });
                sessionStorage.setItem("va:resume_shown", "1");
              } else {
                localStorage.removeItem("va:last_intent");
              }
            }
          }
        }
      } catch (e) {
        console.log(e);
      }
    };

    checkResumePayload();
  }, []);

  // Initialize speech recognition
  useEffect(() => {

    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "es-ES";

      recognitionRef.current.onresult = async (event: any) => {
        const speechToText = event.results[0][0].transcript;
        setTranscript(speechToText);
        await handleVoiceCommand(speechToText);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Error de reconocimiento:", event.error);
        setError("Error al reconocer el audio. Intenta de nuevo.");
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  useEffect(() => {
    const extractSearchQuery = (text: string) => {
      // Remove common question prefixes and clean up
      const cleaned = text
        // Remove question phrases
        .replace(/^(?:puedes\s+(?:ayudarme\s+a\s+)?|podrías\s+(?:ayudarme\s+a\s+)?|quisiera\s+ver\s+|necesito\s+ver\s+|muéstrame\s*|buscar\s*:?\s*|buscar\s+para\s+mi\s*|ayúdame\s+a\s+encontrar\s*|necesito\s+encontrar\s*|quiero\s+ver\s*|quiero\s+encontrar\s*)/i, '')
        // Remove remaining question words
        .replace(/^(?:un\s+|una\s+|unos\s+|unas\s+|el\s+|la\s+|los\s+|las\s+)/i, '')
        // Clean up any remaining punctuation
        .replace(/[¿?¡!.,;:]+/g, '')
        .trim();
      
      // Special case for empty or very short queries
      if (!cleaned || cleaned.split(' ').length <= 2) {
        return cleaned;
      }
      
      // Remove any remaining "buscar" or similar at the start
      return cleaned.replace(/^(?:buscar\s*|encontrar\s*|ver\s*)/i, '').trim();
    };

    const speakResume = async () => {
      try {
        if (typeof window === "undefined") return;
        if (!resumePayload) return;
        const spoken = sessionStorage.getItem("va:resume_spoken") === "1";
        if (spoken) return;
        
        // Extract and clean the search query
        let searchQuery = extractSearchQuery(resumePayload.transcript);
        
        // If we don't have a query, use a generic message
        if (!searchQuery) {
          searchQuery = 'algunos productos';
        }
        
        // Capitalize first letter
        searchQuery = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);
        
        // Create a more natural-sounding message
        const messages = [
          `La última vez estabas buscando ${searchQuery}. ¿Te gustaría continuar con esta búsqueda?`,
          `Veo que antes buscabas ${searchQuery}. ¿Quieres que te ayude con eso de nuevo?`,
          `¿Te interesa seguir buscando ${searchQuery}?`,
          `¿Quieres que te muestre más opciones de ${searchQuery}?`
        ];
        
        // Select a random message for variety
        const msg = messages[Math.floor(Math.random() * messages.length)];
        
        setResponse(msg);
        // No intentamos autoplay: se reproducirá en la primera interacción del usuario.
        setPendingSpeech(msg);
      } catch (e) {
        console.log(e);
      }
    };
    speakResume();
  }, [resumePayload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pendingSpeech) return;

    const handler = async () => {
      try {
        const spoken = sessionStorage.getItem("va:resume_spoken") === "1";
        await speakResponse(pendingSpeech);
        if (!spoken) sessionStorage.setItem("va:resume_spoken", "1");
        setPendingSpeech(null);
      } catch (e) {
        console.log(e);
      }
    };

    const cleanup = () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };

    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });

    return cleanup;
  }, [pendingSpeech]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      setResponse("");
      setError("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const toggleSpeaking = () => {
    if (audioRef.current) {
      if (isSpeaking) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsSpeaking(false);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold text-center mb-6 text-purple-800">
        Asistente Virtual de Joyería
      </h2>

      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={toggleListening}
          className={`p-6 rounded-full transition-all transform hover:scale-110 ${
            isListening
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : "bg-purple-500 hover:bg-purple-600"
          } text-white shadow-lg`}
          aria-label={isListening ? "Detener escucha" : "Iniciar escucha"}>
          {isListening ? <MicOff size={32} /> : <Mic size={32} />}
        </button>

        <button
          onClick={toggleSpeaking}
          disabled={!isSpeaking}
          className={`p-6 rounded-full transition-all ${
            isSpeaking
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-gray-300 cursor-not-allowed"
          } text-white shadow-lg`}
          aria-label={isSpeaking ? "Detener audio" : "Sin audio"}>
          {isSpeaking ? <Volume2 size={32} /> : <VolumeX size={32} />}
        </button>
      </div>

      <div className="space-y-4">
        {resumePayload && (
          <div className="p-4 bg-white rounded-lg shadow border border-purple-100">
            <p className="text-sm text-gray-600 mb-2">
              ¿Quieres continuar con lo último que estabas buscando?
            </p>
            <p className="text-gray-800 font-medium mb-3">{resumePayload.transcript}</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  onAction?.(resumePayload.action);
                  setResponse("Listo. Continuando con tu última búsqueda.");
                  setResumePayload(null);
                  try {
                    await speakResponse("Listo. Continuando con tu última búsqueda.");
                  } catch (e) {
                    console.log(e);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700">
                Continuar
              </button>
              <button
                onClick={() => {
                  setResumePayload(null);
                  try {
                    localStorage.removeItem("va:last_intent");
                  } catch (e) {
                    console.log(e);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                Descartar
              </button>
            </div>
          </div>
        )}

        {isListening && (
          <div className="p-4 bg-purple-100 rounded-lg text-center">
            <p className="text-purple-700 font-medium">🎤 Escuchando...</p>
          </div>
        )}

        {transcript && (
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="text-sm text-gray-500 mb-1">Tú dijiste:</p>
            <p className="text-gray-800">{transcript}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-100 rounded-lg shadow">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {response && (
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="text-sm text-gray-500 mb-1">Asistente:</p>
            <p className="text-gray-800">{response}</p>
          </div>
        )}
      </div>

      <audio
        ref={audioRef}
        onEnded={() => setIsSpeaking(false)}
        onPlay={() => setIsSpeaking(true)}
        className="hidden"
      />

      <div className="mt-6 text-center text-sm text-gray-600">
        <p>Presiona el micrófono y pregunta sobre nuestros productos</p>
        <p className="mt-1">Ejemplo: ¿Qué anillos tienen disponibles?</p>
      </div>
    </div>
  );
}
