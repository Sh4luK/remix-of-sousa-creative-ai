import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Palette } from "lucide-react";

interface BrandConfig {
  name: string;
  slogan: string;
  officialColors: string;
  tone: string;
  promoStyle: string;
  defaultCta: string;
  campaignSignature: string;
}

const STORAGE_KEY = "sousa-creative-brand";

function loadBrand(): BrandConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {
      name: "Comercial Sousa",
      slogan: "Economia de verdade, todo dia!",
      officialColors: "Vermelho, Amarelo, Branco",
      tone: "Popular com toque moderno, confiável, promocional",
      promoStyle: "Varejo forte, organizado, alto impacto",
      defaultCta: "Aproveite!",
      campaignSignature: "Comercial Sousa — Sempre perto de você",
    };
  } catch {
    return {} as BrandConfig;
  }
}

export default function BrandSettings() {
  const [brand, setBrand] = useState<BrandConfig>(loadBrand());

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
    toast.success("Configurações da marca salvas!");
  };

  const update = (key: keyof BrandConfig, value: string) => {
    setBrand((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          Configurações da Marca
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Esses dados são usados automaticamente em todas as gerações
        </p>
      </div>

      <div className="space-y-5 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5">
          <legend className="text-sm font-semibold px-2">Identidade</legend>
          <div>
            <Label>Nome da marca</Label>
            <Input value={brand.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label>Slogan</Label>
            <Input value={brand.slogan} onChange={(e) => update("slogan", e.target.value)} />
          </div>
          <div>
            <Label>Cores oficiais</Label>
            <Input value={brand.officialColors} onChange={(e) => update("officialColors", e.target.value)} />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5">
          <legend className="text-sm font-semibold px-2">Estilo Visual</legend>
          <div>
            <Label>Tom visual</Label>
            <Textarea value={brand.tone} onChange={(e) => update("tone", e.target.value)} rows={2} className="resize-none" />
          </div>
          <div>
            <Label>Estilo promocional</Label>
            <Textarea value={brand.promoStyle} onChange={(e) => update("promoStyle", e.target.value)} rows={2} className="resize-none" />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5">
          <legend className="text-sm font-semibold px-2">Comunicação</legend>
          <div>
            <Label>CTA padrão</Label>
            <Input value={brand.defaultCta} onChange={(e) => update("defaultCta", e.target.value)} />
          </div>
          <div>
            <Label>Assinatura de campanha</Label>
            <Input value={brand.campaignSignature} onChange={(e) => update("campaignSignature", e.target.value)} />
          </div>
        </fieldset>

        <Button onClick={handleSave} className="w-full" size="lg">
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
