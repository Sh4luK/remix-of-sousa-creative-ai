import React, { useMemo } from "react";
import { Search, Upload, Check, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceMagicButton } from "@/components/VoiceMagicButton";
import type { ProductPick } from "@/types/database.types";

const MOCK_PRODUCTS = [
  { id: "p1", name: "Arroz Tio João 5kg", category: "arroz", emoji: "🍚" },
  { id: "p2", name: "Feijão Carioca Camil 1kg", category: "feijao", emoji: "🫘" },
  { id: "p3", name: "Óleo de Soja Soya 900ml", category: "oleo", emoji: "🛢️" },
  { id: "p4", name: "Café 3 Corações 500g", category: "cafe", emoji: "☕" },
  { id: "p5", name: "Refrigerante Coca-Cola 2L", category: "refrigerantes", emoji: "🥤" },
  { id: "p6", name: "Cerveja Brahma Lata 350ml", category: "cervejas", emoji: "🍺" },
  { id: "p7", name: "Açúcar União 5kg", category: "acucar", emoji: "🍬" },
  { id: "p8", name: "Macarrão Renata 500g", category: "macarrao", emoji: "🍝" },
  { id: "p9", name: "Detergente Ypê 500ml", category: "detergente", emoji: "🧴" },
  { id: "p10", name: "Papel Higiênico Neve 12 rolos", category: "papel-higienico", emoji: "🧻" },
  { id: "p11", name: "Leite Italac 1L", category: "leite", emoji: "🥛" },
  { id: "p12", name: "Frango Congelado Sadia 1kg", category: "frango", emoji: "🍗" },
];

const SEARCH_SUGGESTIONS = ["Arroz", "Refrigerante", "Café", "Cerveja", "Óleo", "Frango"];

interface Step1Props {
  search: string;
  setSearch: (v: string) => void;
  pick: ProductPick | null;
  setPick: (p: ProductPick | null) => void;
  uploadRef: React.RefObject<HTMLInputElement>;
  onUpload: (f: File) => void;
  onVoice: (transcript: string) => void;
  currentPrice: string;
  setCurrentPrice: (v: string) => void;
}

export function Step1Product({
  search,
  setSearch,
  pick,
  setPick,
  uploadRef,
  onUpload,
  onVoice,
  currentPrice,
  setCurrentPrice,
}: Step1Props) {
  
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return MOCK_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [search]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Qual produto você quer anunciar?
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Busque no nosso catálogo ou envie uma foto sua.
        </p>
      </div>

      <VoiceMagicButton onResult={onVoice} />

      {(pick?.kind === "custom" || currentPrice) && (
        <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/60 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-sky-900">
              Confira o que entendemos. Pode editar antes de continuar.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Produto
              </label>
              <Input
                value={pick?.kind === "custom" ? pick.name : pick?.name ?? ""}
                onChange={(e) => {
                  const name = e.target.value;
                  if (!pick || pick.kind === "custom") {
                    setPick({ kind: "custom", name });
                    setSearch(name);
                  }
                }}
                readOnly={pick != null && pick.kind !== "custom"}
                placeholder="Ex: Cerveja Heineken"
                className="h-12 rounded-xl border-sky-200 bg-white focus-visible:ring-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Preço
              </label>
              <Input
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="R$ 0,00"
                inputMode="decimal"
                className="h-12 rounded-xl border-sky-200 bg-white focus-visible:ring-sky-500 font-semibold"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          ou digite
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
        <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-sky-600" />
        <p className="text-xs sm:text-sm leading-relaxed">
          Não precisa ter foto profissional. Uma foto tirada com seu celular já funciona muito bem.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ex: arroz, refrigerante, café..."
          className="h-14 pl-12 text-base rounded-xl border-slate-200 focus-visible:ring-sky-500"
        />
      </div>

      {!search && !pick && (
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium">Ou comece por aqui:</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSearch(s)}
                type="button"
                className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-sky-100 text-sm text-slate-700 hover:text-sky-800 font-medium transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {search && (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-xl text-center">
              <p className="text-sm text-slate-600">
                Não achamos esse produto no nosso catálogo. 😕
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Sem problema! Envie uma foto logo abaixo. 👇
              </p>
            </div>
          ) : (
            matches.map((p) => {
              const selected = pick?.kind === "catalog" && pick.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPick({ kind: "catalog", id: p.id, name: p.name, category: p.category, emoji: p.emoji })}
                  className={[
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition",
                    selected
                      ? "border-sky-600 bg-sky-50 shadow-sm"
                      : "border-slate-200 hover:border-sky-300 bg-white",
                  ].join(" ")}
                >
                  <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-2xl">
                    {p.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500 capitalize">{p.category}</div>
                  </div>
                  {selected && (
                    <div className="h-7 w-7 rounded-full bg-sky-500 text-white flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
            <Upload className="h-5 w-5 text-sky-700" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Não encontrou na lista?</p>
            <p className="text-sm text-slate-600">Envie uma foto que você mesmo tirou.</p>
          </div>
          <input
            ref={uploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
          <Button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="bg-sky-600 hover:bg-sky-700 text-white h-11"
          >
            <Upload className="h-4 w-4 mr-2" /> Enviar foto
          </Button>
        </div>

        {pick?.kind === "upload" && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-white rounded-lg border border-sky-200">
            <img src={pick.previewUrl} alt={pick.name} className="h-14 w-14 rounded-lg object-cover" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-slate-900">{pick.name}</div>
              <div className="text-xs text-emerald-600 flex items-center gap-1">
                <Check className="h-3 w-3" /> Foto carregada
              </div>
            </div>
            <button
              onClick={() => setPick(null)}
              type="button"
              className="text-slate-400 hover:text-slate-700 p-1"
              aria-label="Remover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
