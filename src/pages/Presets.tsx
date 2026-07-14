import { Link } from "react-router-dom";
import { PRESETS, STYLES, FORMATS } from "@/lib/promptEngine";
import { ArrowRight, Zap } from "lucide-react";

const PRESET_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  "oferta-popular":   { bg: "bg-red-50",    text: "text-red-600",    border: "border-red-200",    accent: "from-red-500/10" },
  "premium-clean":    { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", accent: "from-violet-500/10" },
  "atacarejo":        { bg: "bg-amber-50",  text: "text-amber-600",  border: "border-amber-200",  accent: "from-amber-500/10" },
  "descartaveis":     { bg: "bg-teal-50",   text: "text-teal-600",   border: "border-teal-200",   accent: "from-teal-500/10" },
  "bebidas-geladas":  { bg: "bg-sky-50",    text: "text-sky-600",    border: "border-sky-200",    accent: "from-sky-500/10" },
  "combo-promo":      { bg: "bg-green-50",  text: "text-green-600",  border: "border-green-200",  accent: "from-green-500/10" },
  "acougue":          { bg: "bg-rose-50",   text: "text-rose-600",   border: "border-rose-200",   accent: "from-rose-500/10" },
  "story-promo":      { bg: "bg-pink-50",   text: "text-pink-600",   border: "border-pink-200",   accent: "from-pink-500/10" },
  "tabloide":         { bg: "bg-slate-50",  text: "text-slate-600",  border: "border-slate-200",  accent: "from-slate-500/10" },
  "whatsapp":         { bg: "bg-emerald-50",text: "text-emerald-600",border: "border-emerald-200",accent: "from-emerald-500/10" },
  "inauguracao":      { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", accent: "from-purple-500/10" },
  "queima-estoque":   { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", accent: "from-orange-500/10" },
};

const POPULAR_IDS = new Set(["oferta-popular", "whatsapp", "story-promo", "queima-estoque"]);

const INTENSITY_STYLE: Record<string, string> = {
  baixa:  "bg-green-100 text-green-700",
  media:  "bg-yellow-100 text-yellow-700",
  alta:   "bg-orange-100 text-orange-700",
  maxima: "bg-red-100 text-red-700",
};

const INTENSITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  maxima: "Máxima",
};

export default function Presets() {
  const getStyleLabel = (value: string) =>
    STYLES.find((s) => s.value === value)?.label ?? value;

  const getFormatLabel = (value: string) =>
    FORMATS.find((f) => f.value === value)?.label.split(" ")[0] ?? value;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">Modelos Prontos</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {PRESETS.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Escolha um modelo pronto para o seu tipo de oferta — é só tocar e preencher o produto e o preço.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRESETS.map((preset, i) => {
          const color = PRESET_COLORS[preset.id] ?? {
            bg: "bg-muted", text: "text-foreground", border: "border-border", accent: "from-muted/50",
          };
          const isPopular = POPULAR_IDS.has(preset.id);

          return (
            <Link
              key={preset.id}
              to={`/nova-arte?preset=${preset.id}`}
              className={`group relative overflow-hidden rounded-2xl border ${color.border} bg-card transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] animate-fade-up flex flex-col`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${color.accent} to-transparent pointer-events-none`} />

              <div className="relative p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`h-12 w-12 rounded-xl ${color.bg} flex items-center justify-center text-2xl shrink-0`}>
                    {preset.icon}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {isPopular && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                        <Zap className="h-2.5 w-2.5" />
                        Popular
                      </span>
                    )}
                    {preset.defaults.format && (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {getFormatLabel(preset.defaults.format)}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-base leading-tight mb-1">{preset.name}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{preset.description}</p>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {preset.defaults.intensity && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${INTENSITY_STYLE[preset.defaults.intensity]}`}>
                      {INTENSITY_LABEL[preset.defaults.intensity]}
                    </span>
                  )}
                  {preset.defaults.style && (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {getStyleLabel(preset.defaults.style)}
                    </span>
                  )}
                  {preset.defaults.applyUrgency && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                      Urgência
                    </span>
                  )}
                </div>
              </div>

              <div className={`px-5 py-3 border-t ${color.border} flex items-center justify-between`}>
                <span className={`text-xs font-semibold ${color.text}`}>Usar este modelo</span>
                <ArrowRight className={`h-4 w-4 ${color.text} group-hover:translate-x-1 transition-transform`} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
