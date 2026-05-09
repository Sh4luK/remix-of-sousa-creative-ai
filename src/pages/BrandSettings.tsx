import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Store, Palette, MessageSquare, Plus, X } from "lucide-react";

interface BrandConfig {
  name: string;
  slogan: string;
  colors: string[];          // array de hex
  defaultPhrase: string;     // texto que sempre aparece
  buttonText: string;        // antes "CTA"
  signature: string;         // assinatura no rodapé das artes
}

const STORAGE_KEY = "sousa-creative-brand";

const DEFAULT_BRAND: BrandConfig = {
  name: "Comercial Sousa",
  slogan: "Economia de verdade, todo dia!",
  colors: ["#E63946", "#FFB703", "#FFFFFF"],
  defaultPhrase: "Aproveite as ofertas da semana",
  buttonText: "Aproveite!",
  signature: "Comercial Sousa — Sempre perto de você",
};

function loadBrand(): BrandConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BRAND;
    const parsed = JSON.parse(raw);
    // Migra formato antigo se necessário
    return {
      name: parsed.name ?? DEFAULT_BRAND.name,
      slogan: parsed.slogan ?? DEFAULT_BRAND.slogan,
      colors: Array.isArray(parsed.colors)
        ? parsed.colors
        : typeof parsed.officialColors === "string"
          ? DEFAULT_BRAND.colors
          : DEFAULT_BRAND.colors,
      defaultPhrase: parsed.defaultPhrase ?? parsed.promoStyle ?? DEFAULT_BRAND.defaultPhrase,
      buttonText: parsed.buttonText ?? parsed.defaultCta ?? DEFAULT_BRAND.buttonText,
      signature: parsed.signature ?? parsed.campaignSignature ?? DEFAULT_BRAND.signature,
    };
  } catch {
    return DEFAULT_BRAND;
  }
}

export default function BrandSettings() {
  const [brand, setBrand] = useState<BrandConfig>(loadBrand());

  const update = <K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) =>
    setBrand((prev) => ({ ...prev, [key]: value }));

  const updateColor = (i: number, hex: string) => {
    const next = [...brand.colors];
    next[i] = hex;
    update("colors", next);
  };

  const addColor = () => {
    if (brand.colors.length >= 6) return;
    update("colors", [...brand.colors, "#000000"]);
  };

  const removeColor = (i: number) => {
    update("colors", brand.colors.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
    toast.success("Configurações salvas com sucesso!");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <header className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Cores e Visual da Marca
          </h1>
          <p className="text-base text-slate-600 mt-2">
            Configure uma vez e tudo será aplicado automaticamente nas suas artes.
          </p>
        </header>

        <Accordion
          type="single"
          collapsible
          defaultValue="step-1"
          className="space-y-3 animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          {/* PASSO 1 */}
          <AccordionItem
            value="step-1"
            className="bg-white rounded-xl border border-slate-200 shadow-sm px-5"
          >
            <AccordionTrigger className="hover:no-underline py-5">
              <div className="flex items-center gap-3 text-left">
                <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Store className="h-4 w-4" /> Dados Básicos
                  </div>
                  <div className="text-xs text-slate-500 font-normal">
                    Nome do comércio e slogan
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6 pt-2 space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Nome do Comércio</Label>
                <Input
                  value={brand.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Ex: Mercado do Bairro"
                  className="mt-1.5 h-11"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Slogan</Label>
                <Input
                  value={brand.slogan}
                  onChange={(e) => update("slogan", e.target.value)}
                  placeholder="Ex: O melhor preço da região"
                  className="mt-1.5 h-11"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Frase curta que define seu negócio.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* PASSO 2 */}
          <AccordionItem
            value="step-2"
            className="bg-white rounded-xl border border-slate-200 shadow-sm px-5"
          >
            <AccordionTrigger className="hover:no-underline py-5">
              <div className="flex items-center gap-3 text-left">
                <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Palette className="h-4 w-4" /> Cores Oficiais
                  </div>
                  <div className="text-xs text-slate-500 font-normal">
                    Escolha as cores que aparecem nas suas artes
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {brand.colors.map((hex, i) => (
                  <div key={i} className="relative group">
                    <label
                      className="block rounded-xl border-2 border-slate-200 hover:border-orange-300 p-3 cursor-pointer transition"
                      style={{ background: hex + "10" }}
                    >
                      <div
                        className="h-16 rounded-lg shadow-inner border border-black/5"
                        style={{ background: hex }}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="color"
                          value={hex}
                          onChange={(e) => updateColor(i, e.target.value)}
                          className="h-8 w-8 rounded cursor-pointer border border-slate-200"
                        />
                        <Input
                          value={hex}
                          onChange={(e) => updateColor(i, e.target.value)}
                          className="h-8 text-xs font-mono uppercase"
                        />
                      </div>
                    </label>
                    {brand.colors.length > 1 && (
                      <button
                        onClick={() => removeColor(i)}
                        className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm transition"
                        aria-label="Remover cor"
                      >
                        <X className="h-3 w-3 text-slate-600" />
                      </button>
                    )}
                  </div>
                ))}

                {brand.colors.length < 6 && (
                  <button
                    onClick={addColor}
                    className="rounded-xl border-2 border-dashed border-slate-200 hover:border-orange-300 hover:bg-orange-50 p-3 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-orange-600 transition min-h-[124px]"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-xs font-medium">Adicionar cor</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                A primeira cor é a principal. Você pode adicionar até 6 cores.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* PASSO 3 */}
          <AccordionItem
            value="step-3"
            className="bg-white rounded-xl border border-slate-200 shadow-sm px-5"
          >
            <AccordionTrigger className="hover:no-underline py-5">
              <div className="flex items-center gap-3 text-left">
                <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <MessageSquare className="h-4 w-4" /> Comunicação
                  </div>
                  <div className="text-xs text-slate-500 font-normal">
                    Textos que sempre aparecem nas suas artes
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6 pt-2 space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Frase Padrão
                </Label>
                <Textarea
                  value={brand.defaultPhrase}
                  onChange={(e) => update("defaultPhrase", e.target.value)}
                  placeholder="Ex: Confira nossas ofertas da semana!"
                  rows={2}
                  className="mt-1.5 resize-none"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Texto do Botão
                </Label>
                <Input
                  value={brand.buttonText}
                  onChange={(e) => update("buttonText", e.target.value)}
                  placeholder="Ex: Aproveite agora!"
                  className="mt-1.5 h-11"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Aparece como chamada de ação na arte.
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Assinatura no Rodapé
                </Label>
                <Input
                  value={brand.signature}
                  onChange={(e) => update("signature", e.target.value)}
                  placeholder="Ex: Mercado do Bairro — Sempre perto de você"
                  className="mt-1.5 h-11"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-8 animate-fade-up" style={{ animationDelay: "160ms" }}>
          <Button
            onClick={handleSave}
            size="lg"
            className="w-full h-12 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md"
          >
            <Save className="h-5 w-5 mr-2" />
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
