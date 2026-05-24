import { Check, Lightbulb } from "lucide-react";
import { STYLES, FORMATS } from "@/lib/promptEngine";

interface Step3Props {
  styleId: string;
  setStyleId: (v: string) => void;
  formatId: string;
  setFormatId: (v: string) => void;
}

export function Step3Style({
  styleId,
  setStyleId,
  formatId,
  setFormatId,
}: Step3Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Como você quer que fique?</h2>
          <p className="text-sm text-slate-500 mt-1">Toque no visual que mais combina com sua oferta.</p>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
          <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-sky-600" />
          <p className="text-xs sm:text-sm leading-relaxed">
            Cada estilo tem um clima diferente. Não precisa acertar de primeira — você pode gerar quantas variações quiser.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STYLES.map((card) => {
            const selected = styleId === card.value;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => setStyleId(card.value)}
                className={[
                  "relative rounded-2xl border-2 overflow-hidden text-left transition-all",
                  selected
                    ? "border-sky-600 shadow-md scale-[1.02]"
                    : "border-slate-200 hover:border-sky-300 hover:shadow-sm",
                ].join(" ")}
              >
                <div
                  className="h-20 w-full relative flex items-center justify-center"
                  style={{ background: card.preview }}
                >
                  <span className="text-3xl drop-shadow-sm">{card.icon}</span>
                </div>
                <div className="p-3 bg-white">
                  <div className="font-semibold text-slate-900 text-sm leading-tight">{card.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{card.desc}</div>
                </div>
                {selected && (
                  <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5 space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Onde você vai postar?</h2>
          <p className="text-sm text-slate-500 mt-1">Cada rede social tem um tamanho ideal — escolha aqui.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FORMATS.map((f) => {
            const selected = formatId === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormatId(f.value)}
                className={[
                  "w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition",
                  selected
                    ? "border-sky-600 bg-sky-50/60 shadow-sm font-semibold"
                    : "border-slate-200 hover:border-sky-300 bg-white",
                ].join(" ")}
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{f.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.width} × {f.height} px</div>
                </div>
                {selected && (
                  <div className="h-6 w-6 rounded-full bg-sky-500 text-white flex items-center justify-center">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
