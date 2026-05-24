import { useState, useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Store, Palette, MessageSquare, Plus, X, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface BrandConfig {
  name: string;
  slogan: string;
  colors: string[];          // array de hex
  defaultPhrase: string;     // texto que sempre aparece
  buttonText: string;        // antes "CTA"
  signature: string;         // assinatura no rodapé das artes
  logoUrl?: string;          // URL customizada para o logotipo
}

const STORAGE_KEY = "pj-midia-brand";

const DEFAULT_BRAND: BrandConfig = {
  name: "PJ Mídia",
  slogan: "Economia de verdade, todo dia!",
  colors: ["#E63946", "#FFB703", "#FFFFFF"],
  defaultPhrase: "Aproveite as ofertas da semana",
  buttonText: "Aproveite!",
  signature: "PJ Mídia — Sempre perto de você",
  logoUrl: "/logo-comercial-sousa.png",
};

function loadLocalBrand(): BrandConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BRAND;
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name ?? DEFAULT_BRAND.name,
      slogan: parsed.slogan ?? DEFAULT_BRAND.slogan,
      colors: Array.isArray(parsed.colors) ? parsed.colors : DEFAULT_BRAND.colors,
      defaultPhrase: parsed.defaultPhrase ?? DEFAULT_BRAND.defaultPhrase,
      buttonText: parsed.buttonText ?? DEFAULT_BRAND.buttonText,
      signature: parsed.signature ?? DEFAULT_BRAND.signature,
      logoUrl: parsed.logoUrl ?? DEFAULT_BRAND.logoUrl,
    };
  } catch {
    return DEFAULT_BRAND;
  }
}

export default function BrandSettings() {
  const { user } = useAuth();
  const [brand, setBrand] = useState<BrandConfig>(loadLocalBrand());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync Supabase brand configuration if logged in
  useEffect(() => {
    if (!user) return;

    supabase
      .from("brands")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          const parsedColors = Array.isArray(data.colors) ? (data.colors as string[]) : DEFAULT_BRAND.colors;
          const loaded: BrandConfig = {
            name: data.name,
            slogan: data.slogan || "",
            colors: parsedColors,
            defaultPhrase: data.default_phrase || "",
            buttonText: data.button_text || "",
            signature: data.signature || "",
            logoUrl: data.logo_path 
              ? supabase.storage.from("brand-logos").getPublicUrl(data.logo_path).data.publicUrl 
              : DEFAULT_BRAND.logoUrl,
          };
          setBrand(loaded);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
        }
      });
  }, [user]);

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

  const handleSave = async () => {
    setSaving(true);
    let logoPath: string | null = null;

    if (user) {
      try {
        if (logoFile) {
          // Upload brand logo file to storage bucket
          const fileExt = logoFile.name.split('.').pop() || 'webp';
          logoPath = `${user.id}/logo-${Date.now()}.${fileExt}`;
          
          const { error: uploadErr } = await supabase.storage
            .from("brand-logos")
            .upload(logoPath, logoFile, { upsert: true });

          if (uploadErr) throw uploadErr;
        } else if (brand.logoUrl && brand.logoUrl.includes("/brand-logos/")) {
          // Extract existing storage path from URL if present
          const existingPath = brand.logoUrl.split("/brand-logos/").pop()?.split("?")[0];
          if (existingPath) logoPath = decodeURIComponent(existingPath);
        }

        const { error: dbErr } = await supabase
          .from("brands")
          .upsert({
            user_id: user.id,
            name: brand.name,
            slogan: brand.slogan,
            colors: brand.colors,
            default_phrase: brand.defaultPhrase,
            button_text: brand.buttonText,
            signature: brand.signature,
            logo_path: logoPath,
            updated_at: new Date().toISOString(),
          });

        if (dbErr) throw dbErr;

        const finalLogoUrl = logoPath
          ? supabase.storage.from("brand-logos").getPublicUrl(logoPath).data.publicUrl
          : brand.logoUrl;

        const savedBrand = { ...brand, logoUrl: finalLogoUrl };
        setBrand(savedBrand);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBrand));
        
        toast.success("Configurações salvas e sincronizadas com sucesso!");
      } catch (err: unknown) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Falha ao salvar configurações no servidor.");
      } finally {
        setSaving(false);
      }
    } else {
      // Local fallback for guest users
      localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
      toast.success("Configurações salvas localmente!");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <header className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            A cara do seu negócio
          </h1>
          <p className="text-base text-slate-600 mt-2">
            Preencha uma vez. A gente aplica essas cores e textos em todas as suas artes daqui pra frente.
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
                <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Store className="h-4 w-4" /> Dados Básicos
                  </div>
                  <div className="text-xs text-slate-500 font-normal">
                    Nome do comércio, slogan e logo
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
              <div>
                <Label className="text-sm font-medium text-slate-700">Logo da sua Marca</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1">
                    <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50/50 transition">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setLogoFile(file);
                            const r = new FileReader();
                            r.onload = () => update("logoUrl", r.result as string);
                            r.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="h-5 w-5 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-600">Escolher arquivo de logo</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">PNG transparente, JPG ou WebP</span>
                    </div>
                  </div>
                  {brand.logoUrl && (
                    <div className="h-16 w-16 border rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 p-1">
                      <img src={brand.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                </div>
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
                <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
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
                      className="block rounded-xl border-2 border-slate-200 hover:border-sky-400 p-3 cursor-pointer transition"
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
                    className="rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-400 hover:bg-sky-50 p-3 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-sky-700 transition min-h-[124px]"
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
                <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
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
            disabled={saving}
            className="w-full h-14 text-base font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-all"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? "Salvando Configurações..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
