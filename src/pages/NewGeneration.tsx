import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, Upload, ChevronLeft, ChevronRight, Sparkles, Check,
  ChevronDown, ChevronUp, Download, RefreshCw, X, Image as ImageIcon,
  Lightbulb, MessageCircle, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPrompt, FORMATS, STYLES, PRESETS, type GenerationInput,
} from "@/lib/promptEngine";
import { addToLibrary } from "@/lib/generationStore";
import { VoiceMagicButton } from "@/components/VoiceMagicButton";
import { parseVoiceTranscript } from "@/lib/voiceParser";

// ────────────────────────────────────────────────────────────
// Catálogo simulado (futura consulta ao Supabase)
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

// Sugestões pré-busca (chips clicáveis)
const SEARCH_SUGGESTIONS = ["Arroz", "Refrigerante", "Café", "Cerveja", "Óleo", "Frango"];

type ProductPick =
  | { kind: "catalog"; id: string; name: string; category: string; emoji: string }
  | { kind: "upload"; name: string; previewUrl: string; base64: string }
  | { kind: "custom"; name: string };

// Visual styles are now unified and imported from promptEngine.ts

// Mensagens rotativas do loading (3s cada)
const LOADING_MESSAGES = [
  "Analisando seu produto...",
  "A Inteligência Artificial está desenhando o cenário...",
  "Aplicando os preços e cores da sua marca...",
  "Quase pronto...",
];

// Comprime e redimensiona uma imagem via canvas — máx 1024px, webp 0.82
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/webp", 0.82);
      // base64 overhead is ~4/3; approximate byte size
      const byteCount = Math.ceil(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
      if (byteCount > 2 * 1024 * 1024) {
        reject(new Error("Imagem muito grande mesmo após compressão. Use uma foto menor."));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Erro ao carregar imagem.")); };
    img.src = url;
  });
}

// Formata input de preço estilo "R$ 19,90"
function formatPrice(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function NewGeneration() {
  const [searchParams] = useSearchParams();

  // Wizard
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Etapa 1
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState<ProductPick | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Etapa 2
  const [currentPrice, setCurrentPrice] = useState("");
  const [voicePrice, setVoicePrice] = useState<string | null>(null); // preço inferido pelo áudio, aguardando confirmação
  const [previousPrice, setPreviousPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discountSeal, setDiscountSeal] = useState("");
  const [headline, setHeadline] = useState("");

  // Etapa 3
  const [styleId, setStyleId] = useState<string>("promocional-popular");
  const [formatId, setFormatId] = useState<string>("1:1");

  // Loading + Resultado
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  // Aplica preset via URL (mantém compatibilidade com /presets)
  useEffect(() => {
    const presetId = searchParams.get("preset");
    if (presetId) {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (preset?.defaults.style) {
        setStyleId(preset.defaults.style);
      }
      if (preset?.defaults.format) {
        setFormatId(preset.defaults.format);
      }
      if (preset) {
        toast.success(`Modelo "${preset.name}" pré-selecionado`);
      }
    }
  }, [searchParams]);

  // Cicla mensagens + progresso visual durante o loading
  useEffect(() => {
    if (!loading) return;
    setLoadingMsgIdx(0);
    setLoadingProgress(5);
    const msgInterval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3500);
    const progInterval = setInterval(() => {
      setLoadingProgress((p) => (p < 92 ? p + Math.max(1, Math.round((95 - p) / 25)) : p));
    }, 400);
    return () => {
      clearInterval(msgInterval);
      clearInterval(progInterval);
    };
  }, [loading]);

  // Filtro de busca
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return MOCK_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [search]);

  // Upload de imagem do produto (com compressão via canvas)
  const handleUpload = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    try {
      const base64 = await compressImage(file);
      setPick({
        kind: "upload",
        name: file.name.replace(/\.[^.]+$/, ""),
        previewUrl: base64,
        base64,
      });
      toast.success("Foto enviada e otimizada!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar imagem.");
    }
  };

  // Modo Mágico por Voz: transcreve → autopreenche → avança para Etapa 2
  const handleVoiceTranscript = (transcript: string) => {
    const { product, price } = parseVoiceTranscript(transcript);

    if (!product && !price) {
      toast.error('Não entendemos. Tente: "Arroz 5kg por 25 reais".');
      return;
    }

    let matched = false;
    if (product) {
      const lower = product.toLowerCase();
      const fromCatalog = MOCK_PRODUCTS.find((p) =>
        lower.split(/\s+/).some((tk) => tk.length > 2 && p.name.toLowerCase().includes(tk)),
      );
      if (fromCatalog) {
        setPick({
          kind: "catalog",
          id: fromCatalog.id,
          name: fromCatalog.name,
          category: fromCatalog.category,
          emoji: fromCatalog.emoji,
        });
        setSearch(fromCatalog.name);
        matched = true;
      }
    }

    if (!matched && product) {
      setPick({ kind: "custom", name: product });
      setSearch(product);
    }

    if (price) {
      setCurrentPrice(`R$ ${price}`);
      setVoicePrice(`R$ ${price}`);
    }

    const parts: string[] = [];
    if (product) parts.push(`produto "${product}"`);
    if (price) parts.push(`preço R$ ${price}`);
    toast.success(
      parts.length
        ? `Entendi: ${parts.join(" e ")}. Revise e ajuste se precisar.`
        : "Áudio compreendido! Revise os campos.",
    );
  };

  // Avança/volta
  const canAdvanceFrom1 = !!pick;
  const canAdvanceFrom2 = currentPrice.trim().length > 0;

  const goNext = () => {
    if (step === 1 && !canAdvanceFrom1) return toast.error("Escolha um produto ou envie uma foto.");
    if (step === 2 && !canAdvanceFrom2) return toast.error("Informe o Preço Atual.");
    setStep((s) => (Math.min(3, s + 1) as 1 | 2 | 3));
  };
  const goBack = () => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3));

  // Geração final
  const handleGenerate = async () => {
    if (!pick) return;

    setLoading(true);
    setResult(null);

    let brandPrimaryColor = "";
    let brandSecondaryColor = "";
    let brandSignature = "";
    let brandName = "";
    let brandLogoUrl = "";
    try {
      const brandRaw = localStorage.getItem("sousa-creative-brand");
      if (brandRaw) {
        const brand = JSON.parse(brandRaw);
        brandPrimaryColor = brand.colors?.[0] ?? "";
        brandSecondaryColor = brand.colors?.[1] ?? "";
        brandSignature = brand.signature ?? "";
        brandName = brand.name ?? "";
        brandLogoUrl = brand.logoUrl ?? "";
      }
    } catch { /* use defaults */ }

    const input: GenerationInput = {
      productName: pick.name,
      brand: "",
      brandName: brandName || "Comercial Sousa",
      category: pick.kind === "catalog" ? pick.category : "outros",
      price: currentPrice,
      previousPrice,
      discount: "",
      quantity,
      promoText: "",
      seal: discountSeal,
      format: formatId,
      style: styleId,
      background: styleId === "bebidas-geladas" ? "freezer" : "estudio-clean",
      primaryColors: brandPrimaryColor,
      secondaryColors: brandSecondaryColor,
      intensity: styleId === "premium-varejo" ? "media" : "alta",
      headline,
      secondaryText: "",
      cta: "",
      extraInfo: brandSignature ? `Footer signature: "${brandSignature}"` : "",
      textRules: "espaco-preco",
      applyLogo: true,
      applyPromoBand: styleId === "promocional-popular" || styleId === "atacarejo-forte",
      applyUrgency: styleId === "promocional-popular",
      productImageBase64: pick.kind === "upload" ? pick.base64 : undefined,
    };

    const prompt = buildPrompt(input);
    const fmt = FORMATS.find((f) => f.value === formatId) || FORMATS[0];

    try {
      const body: any = { prompt, width: fmt.width, height: fmt.height };
      if (input.productImageBase64) body.productImage = input.productImageBase64;

      try {
        const logoResp = await fetch(brandLogoUrl || "/logo-comercial-sousa.png");
        const logoBlob = await logoResp.blob();
        body.logoImage = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(logoBlob);
        });
      } catch { /* logo opcional */ }

      const { data, error } = await supabase.functions.invoke("generate-image", { body });
      if (error) {
        const ctx = (error as any)?.context;
        if (ctx?.status === 402) throw new Error("Créditos insuficientes para gerar a arte.");
        if (ctx?.status === 429) throw new Error("Muitas tentativas. Aguarde alguns segundos.");
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("A IA não retornou uma imagem.");

      setLoadingProgress(100);
      setResult(data.imageUrl);
      try {
        await addToLibrary({
          imageUrl: data.imageUrl,
          prompt,
          productName: pick.name,
          category: input.category,
          style: styleId,
          format: formatId,
        });
      } catch { /* non-critical — generation succeeded */ }
      toast.success("Encarte gerado com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Não foi possível gerar o encarte.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `encarte-${Date.now()}.png`;
    a.click();
  };

  const handleShareWhatsApp = async () => {
    if (!result) return;
    const text = `🛒 *${pick?.name ?? "Oferta"}* por ${currentPrice}!`;
    // Tenta share nativo (mobile) com a imagem
    try {
      const blob = await (await fetch(result)).blob();
      const file = new File([blob], "encarte.png", { type: "image/png" });
      const nav: any = navigator;
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text });
        return;
      }
    } catch { /* fallback abaixo */ }
    // Fallback: WhatsApp web/app só com texto
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    toast.info("Para enviar a imagem, baixe primeiro e anexe no WhatsApp.");
  };

  const startOver = () => {
    setResult(null);
    setStep(1);
    setSearch("");
    setPick(null);
    setCurrentPrice("");
    setVoicePrice(null);
    setPreviousPrice("");
    setQuantity("");
    setHeadline("");
    setDiscountSeal("");
    setShowAdvanced(false);
  };

  // ────────── LOADING OVERLAY ──────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-12 max-w-md w-full text-center animate-scale-in">
          <div className="relative h-24 w-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-sky-100" />
            <div className="absolute inset-0 rounded-full border-4 border-sky-600 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto h-9 w-9 text-sky-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Gerando seu encarte</h2>
          <p key={loadingMsgIdx} className="text-base text-slate-600 animate-fade-up min-h-[24px]">
            {LOADING_MESSAGES[loadingMsgIdx]}
          </p>

          {/* Barra de progresso */}
          <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-600 to-teal-500 transition-all duration-500"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-4">
            ⏳ Pode levar até 20 segundos. Deixe esta tela aberta.
          </p>
        </div>
      </div>
    );
  }

  // ────────── RESULTADO ──────────
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
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

            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <img src={result} alt="Encarte gerado" className="w-full h-auto" />
            </div>

            {/* Ação principal: WhatsApp (mais relevante para o lojista) */}
            <Button
              size="lg"
              onClick={handleShareWhatsApp}
              className="w-full mt-5 h-14 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Enviar no WhatsApp
            </Button>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button variant="outline" size="lg" onClick={handleDownload} className="h-12">
                <Download className="h-4 w-4 mr-2" /> Baixar
              </Button>
              <Button variant="outline" size="lg" onClick={startOver} className="h-12">
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

  // ────────── WIZARD ──────────
  return (
    <div className="min-h-screen bg-slate-50 pb-24 sm:pb-8">
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-5 animate-fade-up">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Criar Novo Encarte
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">
            Em 3 passos simples. Sem complicação.
          </p>
        </header>

        {/* Stepper */}
        <Stepper step={step} />

        {/* Card principal */}
        <div
          key={step}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 animate-fade-up"
        >
          {step === 1 && (
            <Step1
              search={search}
              setSearch={setSearch}
              matches={matches}
              pick={pick}
              setPick={setPick}
              uploadRef={uploadRef}
              onUpload={handleUpload}
              onVoice={handleVoiceTranscript}
              currentPrice={currentPrice}
              setCurrentPrice={setCurrentPrice}
            />
          )}

          {step === 2 && pick && (
            <Step2
              pick={pick}
              currentPrice={currentPrice}
              setCurrentPrice={(v) => { setCurrentPrice(v); if (voicePrice) setVoicePrice(null); }}
              previousPrice={previousPrice}
              setPreviousPrice={setPreviousPrice}
              quantity={quantity}
              setQuantity={setQuantity}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              discountSeal={discountSeal}
              setDiscountSeal={setDiscountSeal}
              headline={headline}
              setHeadline={setHeadline}
              voicePrice={voicePrice}
              onConfirmVoicePrice={() => {
                setVoicePrice(null);
                toast.success("Preço confirmado!");
                setStep(3);
              }}
              onRejectVoicePrice={() => {
                setVoicePrice(null);
                setCurrentPrice("");
              }}
            />

          )}

          {step === 3 && (
            <Step3
              styleId={styleId}
              setStyleId={setStyleId}
              formatId={formatId}
              setFormatId={setFormatId}
            />
          )}

          {/* Navegação desktop (dentro do card) */}
          <div className="hidden sm:flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <Button variant="ghost" onClick={goBack} disabled={step === 1} className="text-slate-600">
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>

            {step < 3 ? (
              <Button
                onClick={goNext}
                size="lg"
                className="h-12 px-6 bg-sky-600 hover:bg-sky-700 text-white"
              >
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                size="lg"
                className="h-12 px-6 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-700 hover:to-teal-600 text-white font-semibold shadow-md"
              >
                <Sparkles className="h-5 w-5 mr-2" /> Gerar Encarte com IA
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar (mobile) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center gap-2 shadow-lg z-10">
        <Button variant="outline" onClick={goBack} disabled={step === 1} className="h-12 px-3">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {step < 3 ? (
          <Button
            onClick={goNext}
            className="flex-1 h-12 bg-sky-600 hover:bg-sky-700 text-white text-base font-semibold"
          >
            Continuar <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            className="flex-1 h-12 bg-gradient-to-r from-sky-600 to-teal-500 text-white text-base font-semibold"
          >
            <Sparkles className="h-5 w-5 mr-2" /> Gerar Encarte
          </Button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Tip Bar (dica amigável no topo de cada etapa)
// ──────────────────────────────────────────────────────────────
function TipBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
      <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-sky-600" />
      <p className="text-xs sm:text-sm leading-relaxed">{children}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Stepper
// ──────────────────────────────────────────────────────────────
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Produto" },
    { n: 2, label: "Preço" },
    { n: 3, label: "Estilo" },
  ];
  return (
    <div className="flex items-center gap-2 mb-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
      {steps.map((s, i) => {
        const isDone = step > s.n;
        const isActive = step === s.n;
        return (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div
                className={[
                  "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition",
                  isDone ? "bg-emerald-500 text-white" :
                  isActive ? "bg-sky-500 text-white shadow-md shadow-sky-200" : "bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span className={["text-sm font-medium hidden sm:inline", isActive ? "text-slate-900" : "text-slate-500"].join(" ")}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={["flex-1 h-1 mx-3 rounded-full", step > s.n ? "bg-emerald-500" : "bg-slate-200"].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ETAPA 1 – Produto
// ──────────────────────────────────────────────────────────────
function Step1({
  search, setSearch, matches, pick, setPick, uploadRef, onUpload, onVoice,
  currentPrice, setCurrentPrice,
}: {
  search: string; setSearch: (v: string) => void;
  matches: typeof MOCK_PRODUCTS;
  pick: ProductPick | null;
  setPick: (p: ProductPick | null) => void;
  uploadRef: React.RefObject<HTMLInputElement>;
  onUpload: (f: File) => void;
  onVoice: (transcript: string) => void;
  currentPrice: string;
  setCurrentPrice: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Qual produto você quer anunciar?
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Busque no nosso catálogo ou envie uma foto sua.
        </p>
      </div>

      {/* 🎤 Modo Mágico por Voz — atalho para preencher tudo falando */}
      <VoiceMagicButton onResult={onVoice} />

      {/* Pré-visualização editável do que a voz capturou */}
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

      {/* Separador "ou digite" */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          ou digite
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <TipBar>
        Não precisa ter foto profissional. Uma foto tirada com seu celular já funciona muito bem.
      </TipBar>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ex: arroz, refrigerante, café..."
          className="h-14 pl-12 text-base rounded-xl border-slate-200 focus-visible:ring-sky-500"
        />
      </div>

      {/* Sugestões antes de digitar */}
      {!search && !pick && (
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium">Ou comece por aqui:</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSearch(s)}
                className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-sky-100 text-sm text-slate-700 hover:text-sky-800 font-medium transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resultados */}
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

      {/* Card de fallback */}
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

// ──────────────────────────────────────────────────────────────
// ETAPA 2 – Preço
// ──────────────────────────────────────────────────────────────
function Step2({
  pick, currentPrice, setCurrentPrice, previousPrice, setPreviousPrice,
  quantity, setQuantity, showAdvanced, setShowAdvanced,
  discountSeal, setDiscountSeal, headline, setHeadline,
  voicePrice, onConfirmVoicePrice, onRejectVoicePrice,
}: {
  pick: ProductPick;
  currentPrice: string; setCurrentPrice: (v: string) => void;
  previousPrice: string; setPreviousPrice: (v: string) => void;
  quantity: string; setQuantity: (v: string) => void;
  showAdvanced: boolean; setShowAdvanced: (v: boolean) => void;
  discountSeal: string; setDiscountSeal: (v: string) => void;
  headline: string; setHeadline: (v: string) => void;
  voicePrice: string | null;
  onConfirmVoicePrice: () => void;
  onRejectVoicePrice: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Detalhes da oferta</h2>
        <p className="text-sm text-slate-500 mt-1">Só o preço já basta. O resto é opcional.</p>
      </div>

      {/* Confirmação do preço inferido pelo áudio */}
      {voicePrice && (
        <div className="rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-teal-50 p-4 sm:p-5 shadow-sm animate-fade-up">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
              <span className="text-lg">🎤</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                Entendi pelo seu áudio: <span className="text-sky-700">{voicePrice}</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                O preço está certo? Confirme para avançar ou corrija no campo abaixo.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  onClick={onConfirmVoicePrice}
                  className="bg-sky-600 hover:bg-sky-700 text-white h-10"
                >
                  <Check className="h-4 w-4 mr-1.5" /> Sim, está certo
                </Button>
                <Button
                  onClick={onRejectVoicePrice}
                  variant="outline"
                  className="h-10 border-sky-200 text-sky-800 hover:bg-sky-100"
                >
                  Corrigir preço
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Produto selecionado */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="h-16 w-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden text-3xl">
          {pick.kind === "upload" ? (
            <img src={pick.previewUrl} alt={pick.name} className="h-full w-full object-cover" />
          ) : pick.kind === "catalog" ? (
            <span>{pick.emoji}</span>
          ) : (
            <span>🎤</span>
          )}
        </div>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Produto escolhido</div>
          <div className="font-semibold text-slate-900">{pick.name}</div>
        </div>
      </div>

      <TipBar>
        Coloque o preço bem destacado — é o que mais chama a atenção do cliente.
      </TipBar>

      {/* Preços */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Preço Atual <span className="text-sky-600">*</span>
          </Label>
          <Input
            value={currentPrice}
            onChange={(e) => setCurrentPrice(formatPrice(e.target.value))}
            inputMode="numeric"
            placeholder="R$ 0,00"
            className="mt-1.5 h-14 text-2xl font-bold tracking-tight"
          />
          <p className="text-xs text-slate-500 mt-1.5">É só digitar os números, a gente formata pra você.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-slate-700">Preço Antigo (opcional)</Label>
            <Input
              value={previousPrice}
              onChange={(e) => setPreviousPrice(formatPrice(e.target.value))}
              inputMode="numeric"
              placeholder="R$ 0,00"
              className="mt-1.5 h-12"
            />
            <p className="text-xs text-slate-400 mt-1">Aparece riscado, mostrando o desconto.</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">Quantidade / Volume</Label>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 5kg, 2L, 500ml"
              className="mt-1.5 h-12"
            />
            <p className="text-xs text-slate-400 mt-1">Tamanho ou peso do produto.</p>
          </div>
        </div>
      </div>

      {/* Opções avançadas */}
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showAdvanced ? "Ocultar" : "Ver"} Opções Avançadas
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-fade-up">
            <div>
              <Label className="text-sm font-medium text-slate-700">Selo de Desconto</Label>
              <Input
                value={discountSeal}
                onChange={(e) => setDiscountSeal(e.target.value)}
                placeholder="Ex: 20% OFF, OFERTA, IMPERDÍVEL"
                className="mt-1.5 h-12"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Título Principal da Oferta</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex: Mega Promoção da Semana"
                className="mt-1.5 h-12"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ETAPA 3 – Estilo Visual & Formato
// ──────────────────────────────────────────────────────────────
function Step3({
  styleId,
  setStyleId,
  formatId,
  setFormatId,
}: {
  styleId: string;
  setStyleId: (v: string) => void;
  formatId: string;
  setFormatId: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Como você quer que fique?</h2>
          <p className="text-sm text-slate-500 mt-1">Toque no visual que mais combina com sua oferta.</p>
        </div>

        <TipBar>
          Cada estilo tem um clima diferente. Não precisa acertar de primeira — você pode gerar quantas variações quiser.
        </TipBar>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STYLES.map((card) => {
            const selected = styleId === card.value;
            return (
              <button
                key={card.value}
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
