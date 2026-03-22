import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Sparkles, Download, RefreshCw, Copy, ChevronDown, ChevronUp, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPrompt,
  buildSimplePrompt,
  PRESETS,
  FORMATS,
  CATEGORIES,
  STYLES,
  BACKGROUNDS,
  SEALS,
  type GenerationInput,
} from "@/lib/promptEngine";
import { addToLibrary } from "@/lib/generationStore";

const DEFAULT_INPUT: GenerationInput = {
  productName: "",
  brand: "",
  category: "outros",
  price: "",
  previousPrice: "",
  discount: "",
  quantity: "",
  promoText: "",
  seal: "",
  format: "1:1",
  style: "promocional-popular",
  background: "estudio-clean",
  primaryColors: "",
  secondaryColors: "",
  intensity: "alta",
  headline: "",
  secondaryText: "",
  cta: "",
  extraInfo: "",
  textRules: "espaco-preco",
  applyLogo: true,
  applySeal: false,
  applyPromoBand: false,
  applyUrgency: false,
};

export default function NewGeneration() {
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState<GenerationInput>(DEFAULT_INPUT);
  const [simpleMode, setSimpleMode] = useState(false);
  const [simplePrompt, setSimplePrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [finalPrompt, setFinalPrompt] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const presetId = searchParams.get("preset");
    if (presetId) {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setInput((prev) => ({ ...prev, ...preset.defaults }));
        toast.success(`Preset "${preset.name}" aplicado`);
      }
    }
  }, [searchParams]);

  const update = (key: keyof GenerationInput, value: any) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = (file: File, type: "product" | "background") => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (type === "product") {
        setProductImagePreview(base64);
        update("productImageBase64", base64);
      } else {
        setBackgroundImagePreview(base64);
        update("backgroundImageBase64", base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (type: "product" | "background") => {
    if (type === "product") {
      setProductImagePreview(null);
      update("productImageBase64", undefined);
      if (productInputRef.current) productInputRef.current.value = "";
    } else {
      setBackgroundImagePreview(null);
      update("backgroundImageBase64", undefined);
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
    }
  };

  /** Validate for contradictions before generating */
  const validate = (): string | null => {
    if (!simpleMode && !input.productName.trim()) {
      return "Informe o nome do produto";
    }
    if (simpleMode && !simplePrompt.trim()) {
      return "Descreva o que deseja gerar";
    }
    // Warn if "sem-texto" is selected but text fields are filled
    if (input.textRules === "sem-texto") {
      const hasText = !!(input.price?.trim() || input.previousPrice?.trim() || input.headline?.trim() || input.cta?.trim() || input.discount?.trim());
      if (hasText && !simpleMode) {
        // Not a hard block — we'll render only the explicit text. Just inform the user.
        toast.info("Modo 'sem texto' selecionado, mas há campos de texto preenchidos. Apenas o texto explícito será incluído.", { duration: 5000 });
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);
    setGeneratedImage(null);

    const prompt = simpleMode ? buildSimplePrompt(simplePrompt, input.format) : buildPrompt(input);
    setFinalPrompt(prompt);

    const formatData = FORMATS.find((f) => f.value === input.format) || FORMATS[0];

    try {
      const body: any = { prompt, width: formatData.width, height: formatData.height };
      if (input.productImageBase64) body.productImage = input.productImageBase64;
      if (input.backgroundImageBase64) body.backgroundImage = input.backgroundImageBase64;

      const { data, error } = await supabase.functions.invoke("generate-image", {
        body,
      });

      if (error) {
        const context = (error as any)?.context;
        if (context?.status === 402) {
          const body = await context.json?.() ?? {};
          throw new Error(body.error || "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage.");
        }
        if (context?.status === 429) {
          const body = await context.json?.() ?? {};
          throw new Error(body.error || "Muitas requisições. Aguarde um momento e tente novamente.");
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("Nenhuma imagem retornada");

      setGeneratedImage(data.imageUrl);
      try {
        addToLibrary({
          imageUrl: data.imageUrl,
          prompt,
          productName: simpleMode ? simplePrompt : input.productName,
          category: input.category,
          style: input.style,
          format: input.format,
        });
      } catch {
        // Storage full — image still shown to user
      }
      toast.success("Arte gerada com sucesso!");
    } catch (err: any) {
      console.error("Generation error:", err);
      const msg = err.message || "Erro ao gerar imagem";
      if (msg.includes("Créditos") || msg.includes("créditos")) {
        toast.error("💳 " + msg, { duration: 8000 });
      } else if (msg.includes("429") || msg.includes("requisições")) {
        toast.error("⏳ " + msg, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = generatedImage;
    a.download = `sousa-creative-${Date.now()}.png`;
    a.click();
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(finalPrompt);
    toast.success("Prompt copiado!");
  };

  const handleRefine = async (refinement: string) => {
    if (!generatedImage) return;
    setLoading(true);
    const newPrompt = finalPrompt + `\n\nAdditional refinement: ${refinement}`;
    setFinalPrompt(newPrompt);

    try {
      const formatData = FORMATS.find((f) => f.value === input.format) || FORMATS[0];
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: newPrompt, width: formatData.width, height: formatData.height },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("Nenhuma imagem retornada");

      setGeneratedImage(data.imageUrl);
      try {
        addToLibrary({
          imageUrl: data.imageUrl,
          prompt: newPrompt,
          productName: simpleMode ? simplePrompt : input.productName,
          category: input.category,
          style: input.style,
          format: input.format,
        });
      } catch {
        // Storage full
      }
      toast.success("Arte refinada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao refinar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight">Nova Arte</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preencha os dados e gere sua arte promocional
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {/* Mode toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Switch checked={simpleMode} onCheckedChange={setSimpleMode} />
            <span className="text-sm font-medium">
              {simpleMode ? "Modo Simples" : "Modo Detalhado"}
            </span>
            <span className="text-xs text-muted-foreground">
              {simpleMode ? "Descreva com suas palavras" : "Formulário completo"}
            </span>
          </div>

          {simpleMode ? (
            <div className="space-y-3">
              <Label>Descreva o que deseja gerar</Label>
              <Textarea
                value={simplePrompt}
                onChange={(e) => setSimplePrompt(e.target.value)}
                placeholder="Ex: arroz 5kg promoção, refrigerante 2L oferta do dia, combo limpeza..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                A IA vai expandir automaticamente em um prompt profissional
              </p>
            </div>
          ) : (
            <>
              {/* Product Data */}
              <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5">
                <legend className="text-sm font-semibold px-2">Dados do Produto</legend>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nome do Produto *</Label>
                    <Input value={input.productName} onChange={(e) => update("productName", e.target.value)} placeholder="Ex: Arroz Tio João 5kg" />
                  </div>
                  <div>
                    <Label>Marca</Label>
                    <Input value={input.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Ex: Tio João" />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={input.category} onValueChange={(v) => update("category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Preço</Label>
                    <Input value={input.price} onChange={(e) => update("price", e.target.value)} placeholder="R$ 19,90" />
                  </div>
                  <div>
                    <Label>Preço anterior</Label>
                    <Input value={input.previousPrice} onChange={(e) => update("previousPrice", e.target.value)} placeholder="R$ 24,90" />
                  </div>
                  <div>
                    <Label>Desconto</Label>
                    <Input value={input.discount} onChange={(e) => update("discount", e.target.value)} placeholder="20% OFF" />
                  </div>
                  <div>
                    <Label>Quantidade/Volume</Label>
                    <Input value={input.quantity} onChange={(e) => update("quantity", e.target.value)} placeholder="5kg, 2L, 500ml" />
                  </div>
                  <div>
                    <Label>Selo</Label>
                    <Select value={input.seal || "nenhum"} onValueChange={(v) => update("seal", v === "nenhum" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {SEALS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Texto Promocional</Label>
                    <Input value={input.promoText} onChange={(e) => update("promoText", e.target.value)} placeholder="Ex: Válido até sábado!" />
                  </div>
                </div>
              </fieldset>

              {/* Visual Data */}
              <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5">
                <legend className="text-sm font-semibold px-2">Configuração Visual</legend>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Formato</Label>
                    <Select value={input.format} onValueChange={(v) => update("format", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estilo</Label>
                    <Select value={input.style} onValueChange={(v) => update("style", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fundo</Label>
                    <Select value={input.background} onValueChange={(v) => update("background", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BACKGROUNDS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Intensidade Promocional</Label>
                    <Select value={input.intensity} onValueChange={(v) => update("intensity", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="maxima">Máxima</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Texto na imagem</Label>
                    <Select value={input.textRules} onValueChange={(v) => update("textRules", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pouco-texto">Pouco texto</SelectItem>
                        <SelectItem value="moderado">Moderado</SelectItem>
                        <SelectItem value="espaco-preco">Espaço para preço</SelectItem>
                        <SelectItem value="sem-texto">Sem texto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cores principais</Label>
                    <Input value={input.primaryColors} onChange={(e) => update("primaryColors", e.target.value)} placeholder="vermelho, amarelo" />
                  </div>
                </div>
              </fieldset>

              {/* Advanced */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Opções avançadas
              </button>

              {showAdvanced && (
                <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5 animate-scale-in">
                  <legend className="text-sm font-semibold px-2">Branding & Extras</legend>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Faixa promocional</Label>
                      <Switch checked={input.applyPromoBand} onCheckedChange={(v) => update("applyPromoBand", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Elementos de urgência</Label>
                      <Switch checked={input.applyUrgency} onCheckedChange={(v) => update("applyUrgency", v)} />
                    </div>
                    <div>
                      <Label>Headline</Label>
                      <Input value={input.headline} onChange={(e) => update("headline", e.target.value)} placeholder="Ex: OFERTA IMPERDÍVEL" />
                    </div>
                    <div>
                      <Label>Texto secundário</Label>
                      <Input value={input.secondaryText} onChange={(e) => update("secondaryText", e.target.value)} placeholder="Ex: Só esta semana!" />
                    </div>
                    <div>
                      <Label>CTA</Label>
                      <Input value={input.cta} onChange={(e) => update("cta", e.target.value)} placeholder="Ex: Compre já!" />
                    </div>
                    <div>
                      <Label>Cores secundárias</Label>
                      <Input value={input.secondaryColors} onChange={(e) => update("secondaryColors", e.target.value)} placeholder="Ex: branco, preto" />
                    </div>
                    <div>
                      <Label>Observações extras</Label>
                      <Textarea value={input.extraInfo} onChange={(e) => update("extraInfo", e.target.value)} rows={2} placeholder="Instruções adicionais..." className="resize-none" />
                    </div>
                  </div>
                </fieldset>
              )}
            </>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-12 text-base font-bold promo-gradient border-0 text-primary-foreground hover:opacity-90 transition-opacity active:scale-[0.98]"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Gerando arte...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Gerar Arte Promocional
              </>
            )}
          </Button>
        </div>

        {/* Result Panel */}
        <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
          {generatedImage ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <img
                  src={generatedImage}
                  alt="Arte gerada"
                  className="w-full"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleDownload} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1.5" /> Baixar
                </Button>
                <Button onClick={handleGenerate} variant="outline" size="sm" disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-1.5" /> Nova Variação
                </Button>
                <Button onClick={handleCopyPrompt} variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-1.5" /> Copiar Prompt
                </Button>
              </div>

              {/* Refinements */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Refinamentos Rápidos</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Make it more premium and polished",
                    "Make it more popular and eye-catching",
                    "Increase promotional urgency feel",
                    "Highlight the product more, larger and centered",
                    "Improve product lighting and realism",
                    "Make the background cleaner",
                    "Adapt for vertical Stories format 9:16",
                    "Adapt for square post format 1:1",
                  ].map((ref, i) => {
                    const labels = [
                      "Mais premium", "Mais popular", "Mais promoção",
                      "Destacar produto", "Melhorar luz", "Fundo mais limpo",
                      "Adaptar Stories", "Adaptar quadrado",
                    ];
                    return (
                      <Button
                        key={i}
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={loading}
                        onClick={() => handleRefine(ref)}
                      >
                        {labels[i]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt */}
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPrompt ? "Ocultar prompt" : "Ver prompt utilizado"}
              </button>
              {showPrompt && (
                <div className="rounded-lg bg-muted p-3 text-xs font-mono leading-relaxed break-words whitespace-pre-wrap animate-scale-in">
                  {finalPrompt}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 aspect-square">
              <div className="text-center p-8">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  {loading ? "Gerando sua arte promocional..." : "Preencha os dados e clique em gerar"}
                </p>
                {loading && <Loader2 className="h-6 w-6 mx-auto mt-4 animate-spin text-primary" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
