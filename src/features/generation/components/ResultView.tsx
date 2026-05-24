import { Check, Download, RefreshCw, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultViewProps {
  result: string;
  onDownload: () => void;
  onShareWhatsApp: () => void;
  startOver: () => void;
}

export function ResultView({
  result,
  onDownload,
  onShareWhatsApp,
  startOver,
}: ResultViewProps) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6 animate-scale-in">
          <div className="flex items-center gap-2 text-emerald-600 mb-4">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Pronto! Seu encarte está aí 🎉</div>
              <div className="text-xs text-slate-500">Agora é só baixar ou enviar direto pro WhatsApp.</div>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
            <img src={result} alt="Encarte gerado" className="w-full h-auto object-contain max-h-[70vh]" />
          </div>

          <Button
            size="lg"
            onClick={onShareWhatsApp}
            className="w-full mt-5 h-14 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-all active:scale-[0.99]"
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Enviar no WhatsApp
          </Button>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Button variant="outline" size="lg" onClick={onDownload} className="h-12 border-slate-200">
              <Download className="h-4 w-4 mr-2" /> Baixar
            </Button>
            <Button variant="outline" size="lg" onClick={startOver} className="h-12 border-slate-200">
              <RefreshCw className="h-4 w-4 mr-2" /> Criar outro
            </Button>
          </div>

          <p className="text-xs text-center text-slate-400 mt-4">
            💡 Dica: salve a imagem no celular antes de anexar no WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
