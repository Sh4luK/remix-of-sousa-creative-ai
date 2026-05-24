import { Sparkles } from "lucide-react";
import { LOADING_MESSAGES } from "../hooks/useGeneration";

interface LoadingOverlayProps {
  progress: number;
  messageIndex: number;
}

export function LoadingOverlay({ progress, messageIndex }: LoadingOverlayProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-12 max-w-md w-full text-center animate-scale-in">
        <div className="relative h-24 w-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-sky-100" />
          <div className="absolute inset-0 rounded-full border-4 border-sky-600 border-t-transparent animate-spin" />
          <Sparkles className="absolute inset-0 m-auto h-9 w-9 text-sky-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Gerando seu encarte</h2>
        <p className="text-base text-slate-600 animate-fade-up min-h-[24px]">
          {LOADING_MESSAGES[messageIndex]}
        </p>

        <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-600 to-teal-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-4">
          ⏳ Pode levar até 20 segundos. Deixe esta tela aberta.
        </p>
      </div>
    </div>
  );
}
