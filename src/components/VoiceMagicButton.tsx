import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Polyfill de tipos para a Web Speech API (não está no lib.dom padrão).
type SR = any;

declare global {
  interface Window {
    SpeechRecognition?: SR;
    webkitSpeechRecognition?: SR;
  }
}

interface VoiceMagicButtonProps {
  onResult: (transcript: string) => void;
}

export function VoiceMagicButton({ onResult }: VoiceMagicButtonProps) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Seu navegador não suporta gravação de voz.");
      return;
    }

    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = "";

    rec.onstart = () => {
      setRecording(true);
      setInterim("");
    };

    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText || finalText);
    };

    rec.onerror = (e: any) => {
      setRecording(false);
      setInterim("");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Permissão de microfone negada. Libere no navegador.");
      } else if (e.error === "no-speech") {
        toast.info("Não ouvimos nada. Tente novamente.");
      } else {
        toast.error("Erro ao gravar áudio. Tente novamente.");
      }
    };

    rec.onend = () => {
      setRecording(false);
      const text = (finalText || interim).trim();
      setInterim("");
      if (text) onResult(text);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // já está rodando — ignora
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  };

  if (!supported) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={recording ? stop : start}
        className={[
          "relative w-full overflow-hidden rounded-2xl p-5 text-white shadow-lg transition active:scale-[0.99]",
          recording
            ? "bg-gradient-to-br from-red-500 to-orange-500"
            : "bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600",
        ].join(" ")}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            {recording && (
              <>
                <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
                <span
                  className="absolute inset-0 rounded-full bg-white/20 animate-ping"
                  style={{ animationDelay: "300ms" }}
                />
              </>
            )}
            <div className="relative h-14 w-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/40">
              {recording ? (
                <MicOff className="h-7 w-7" />
              ) : (
                <Mic className="h-7 w-7" />
              )}
            </div>
          </div>
          <div className="flex-1 text-left">
            <div className="text-base sm:text-lg font-bold leading-tight">
              {recording ? "Estou ouvindo..." : "Criar encarte por voz"}
            </div>
            <div className="text-xs sm:text-sm text-white/85 mt-0.5">
              {recording
                ? "Pode falar! Ex: \"Arroz 5kg por 25 reais\""
                : "Toque e fale o produto e o preço"}
            </div>
          </div>
        </div>

        {recording && interim && (
          <div className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-left text-sm font-medium">
            “{interim}”
          </div>
        )}

        {recording && (
          <div className="absolute bottom-2 right-3 flex items-center gap-1 text-[11px] text-white/80">
            <Loader2 className="h-3 w-3 animate-spin" /> gravando
          </div>
        )}
      </button>
    </div>
  );
}
