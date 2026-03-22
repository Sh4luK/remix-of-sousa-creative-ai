import { Link } from "react-router-dom";
import { PRESETS } from "@/lib/promptEngine";
import { ArrowRight } from "lucide-react";

export default function Presets() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight">Modelos Prontos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Templates otimizados para cada tipo de campanha
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRESETS.map((preset, i) => (
          <Link
            key={preset.id}
            to={`/nova-arte?preset=${preset.id}`}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-lg hover:border-primary/20 active:scale-[0.98] animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{preset.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base">{preset.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {preset.defaults.style && (
                    <span className="inline-block rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {preset.defaults.style}
                    </span>
                  )}
                  {preset.defaults.intensity && (
                    <span className="inline-block rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {preset.defaults.intensity}
                    </span>
                  )}
                  {preset.defaults.format && (
                    <span className="inline-block rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {preset.defaults.format}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
