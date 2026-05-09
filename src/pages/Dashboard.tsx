import { useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Image, Layers, Sparkles, ArrowRight, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLibrary } from "@/lib/generationStore";
import { PRESETS } from "@/lib/promptEngine";

const BUSINESS_LABELS: Record<string, string> = {
  "oferta-popular": "Oferta de Supermercado",
  "premium-clean": "Post Elegante",
  "atacarejo": "Oferta de Atacado",
  "descartaveis": "Descartáveis em Destaque",
  "bebidas-geladas": "Bebidas Geladas",
  "combo-promo": "Combos e Kits",
  "acougue": "Oferta de Açougue",
  "story-promo": "Story para Instagram",
  "tabloide": "Encarte Digital",
  "whatsapp": "Arte para WhatsApp",
  "inauguracao": "Inauguração",
  "queima-estoque": "Queima de Estoque",
};

function getBusinessLabel(presetId: string): string {
  return BUSINESS_LABELS[presetId] || presetId;
}

export default function Dashboard() {
  const library = getLibrary();
  const recentImages = library.slice(0, 6);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          Sousa Creative AI
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gere artes promocionais profissionais para o Comercial Sousa
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <Link to="/nova-arte">
          <div className="group relative overflow-hidden rounded-xl promo-gradient p-5 text-primary-foreground transition-all duration-200 hover:shadow-lg active:scale-[0.98]">
            <PlusCircle className="h-8 w-8 mb-3 opacity-90" />
            <h3 className="font-bold text-lg">Nova Arte</h3>
            <p className="text-sm opacity-80 mt-1">Criar imagem promocional</p>
            <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 opacity-60 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link to="/presets">
          <div className="group relative overflow-hidden rounded-xl bg-card border border-border p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.98]">
            <Layers className="h-8 w-8 mb-3 text-primary" />
            <h3 className="font-bold text-lg">Estilos de Arte</h3>
            <p className="text-sm text-muted-foreground mt-1">{PRESETS.length} estilos prontos para usar</p>
            <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-muted-foreground/40 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link to="/biblioteca">
          <div className="group relative overflow-hidden rounded-xl bg-card border border-border p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.98]">
            <Image className="h-8 w-8 mb-3 text-accent" />
            <h3 className="font-bold text-lg">Minhas Artes</h3>
            <p className="text-sm text-muted-foreground mt-1">{library.length} artes salvas</p>
            <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-muted-foreground/40 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Quick Presets */}
      <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            Atalhos Rápidos
          </h2>
          <Link to="/presets" className="text-sm text-primary font-medium hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {PRESETS.slice(0, 6).map((preset) => (
            <Link
              key={preset.id}
              to={`/nova-arte?preset=${preset.id}`}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.97]"
            >
              <span className="text-2xl">{preset.icon}</span>
              <span className="text-xs font-medium leading-tight">{getBusinessLabel(preset.id)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Images */}
      {recentImages.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Gerações Recentes
            </h2>
            <Link to="/biblioteca" className="text-sm text-primary font-medium hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {recentImages.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
              >
                <img
                  src={img.imageUrl}
                  alt={img.productName}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/70 to-transparent p-2">
                  <p className="text-[11px] font-medium text-primary-foreground truncate">
                    {img.productName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {library.length === 0 && (
        <div className="animate-fade-up rounded-xl border-2 border-dashed border-border p-12 text-center" style={{ animationDelay: "240ms" }}>
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma arte gerada ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Comece criando sua primeira arte promocional
          </p>
          <Button asChild>
            <Link to="/nova-arte">
              <PlusCircle className="h-4 w-4 mr-2" />
              Criar Primeira Arte
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
