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
  buildPrompt, FORMATS, PRESETS, type GenerationInput,
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

// Cards visuais de estilo — agora com prévia de gradiente (mock visual do encarte)
const STYLE_CARDS = [
  {
    id: "promocional-popular", icon: "🔥", title: "Oferta Popular",
    desc: "Cores fortes e chamativas",
    preview: "linear-gradient(135deg,#fb923c 0%,#dc2626 60%,#facc15 100%)",
  },
  {
    id: "premium-varejo", icon: "✨", title: "Premium Clean",
    desc: "Elegante e sofisticado",
    preview: "linear-gradient(135deg,#0f172a 0%,#475569 60%,#cbd5e1 100%)",
  },
  {
    id: "atacarejo-forte", icon: "📦", title: "Atacarejo",
    desc: "Volume e economia",
    preview: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#facc15 100%)",
  },
  {
    id: "bebidas-geladas", icon: "🧊", title: "Bebidas Geladas",
    desc: "Frio e refrescante",
    preview: "linear-gradient(135deg,#0ea5e9 0%,#22d3ee 60%,#e0f2fe 100%)",
  },
  {
    id: "acougue-realista", icon: "🥩", title: "Açougue",
    desc: "Fresco e profissional",
    preview: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 60%,#fca5a5 100%)",
  },
  {
    id: "clean-moderno", icon: "🛍️", title: "Clean Moderno",
    desc: "Organizado e limpo",
    preview: "linear-gradient(135deg,#f8fafc 0%,#e2e8f0 60%,#94a3b8 100%)",
  },
] as const;

// Mensagens rotativas do loading (3s cada)
const LOADING_MESSAGES = [
  "Analisando seu produto...",
  "A Inteligência Artificial está desenhando o cenário...",
  "Aplicando os preços e cores da sua marca...",
  "Quase pronto...",
];

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
  const [previousPrice, setPreviousPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discountSeal, setDiscountSeal] = useState("");
  const [headline, setHeadline] = useState("");

  // Etapa 3
  const [styleId, setStyleId] = useState<string>("promocional-popular");

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
        toast.success(`Estilo "${preset.name}" pré-selecionado`);
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

  // Upload de imagem do produto
  const handleUpload = (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("A foto está muito grande. Máximo 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPick({
        kind: "upload",
        name: file.name.replace(/\.[^.]+$/, ""),
        previewUrl: base64,
        base64,
      });
      toast.success("Foto enviada!");
    };
    reader.readAsDataURL(file);
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

    if (price) setCurrentPrice(`R$ ${price}`);

    toast.success("Áudio compreendido! Confirmando os dados...");

    if (product) {
      setTimeout(() => setStep(2), 600);
    }
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

    const input: GenerationInput = {
      productName: pick.name,
      brand: "",
      category: pick.kind === "catalog" ? pick.category : "outros",
      price: currentPrice,
      previousPrice,
      discount: discountSeal,
      quantity,
      promoText: "",
      seal: discountSeal,
      format: "1:1",
      style: styleId,
      background: styleId === "bebidas-geladas" ? "freezer" : "estudio-clean",
      primaryColors: "",
      secondaryColors: "",
      intensity: styleId === "premium-varejo" ? "media" : "alta",
      headline,
      secondaryText: "",
      cta: "",
      extraInfo: "",
      textRules: "espaco-preco",
      applyLogo: true,
      applySeal: !!discountSeal,
      applyPromoBand: styleId === "promocional-popular" || styleId === "atacarejo-forte",
      applyUrgency: styleId === "promocional-popular",
      productImageBase64: pick.kind === "upload" ? pick.base64 : undefined,
    };

    const prompt = buildPrompt(input);
    const fmt = FORMATS[0];

    try {
      const body: any = { prompt, width: fmt.width, height: fmt.height };
      if (input.productImageBase64) body.productImage = input.productImageBase64;

      try {
        const logoResp = await fetch("/logo-comercial-sousa.png");
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
        addToLibrary({
          imageUrl: data.imageUrl,
          prompt,
          productName: pick.name,
          category: input.category,
          style: styleId,
          format: "1:1",
        });
      } catch { /* storage cheio */ }
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
    setPreviousPrice("");
    setQuantity("");
    setHeadline("");
    setDiscountSeal("");
  };

  // ────────── LOADING OVERLAY ──────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-12 max-w-md w-full text-center animate-scale-in">
          <div className="relative h-24 w-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
            <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto h-9 w-9 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Gerando seu encarte</h2>
          <p key={loadingMsgIdx} className="text-base text-slate-600 animate-fade-up min-h-[24px]">
            {LOADING_MESSAGES[loadingMsgIdx]}
          </p>

          {/* Barra de progresso */}
          <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-4">
            ⏳ Pode levar até 20 segundos. Não feche esta tela.
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
            />
          )}

          {step === 2 && pick && (
            <Step2
              pick={pick}
              currentPrice={currentPrice}
              setCurrentPrice={setCurrentPrice}
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
            />
          )}

          {step === 3 && (
            <Step3 styleId={styleId} setStyleId={setStyleId} />
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
                className="h-12 px-6 bg-orange-500 hover:bg-orange-600 text-white"
              >
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                size="lg"
                className="h-12 px-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-md"
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
            className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white text-base font-semibold"
          >
            Continuar <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-500 text-white text-base font-semibold"
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
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
      <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
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
                  isActive ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-slate-200 text-slate-500",
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
}: {
  search: string; setSearch: (v: string) => void;
  matches: typeof MOCK_PRODUCTS;
  pick: ProductPick | null;
  setPick: (p: ProductPick | null) => void;
  uploadRef: React.RefObject<HTMLInputElement>;
  onUpload: (f: File) => void;
  onVoice: (transcript: string) => void;
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

      <TipBar>
        Não precisa ter foto profissional. Uma foto tirada com seu celular já funciona muito bem.
      </TipBar>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ex: arroz, refrigerante, café..."
          className="h-14 pl-12 text-base rounded-xl border-slate-200 focus-visible:ring-orange-400"
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
                className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-orange-100 text-sm text-slate-700 hover:text-orange-700 font-medium transition"
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
                      ? "border-orange-500 bg-orange-50 shadow-sm"
                      : "border-slate-200 hover:border-orange-300 bg-white",
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
                    <div className="h-7 w-7 rounded-full bg-orange-500 text-white flex items-center justify-center">
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
      <div className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Upload className="h-5 w-5 text-orange-600" />
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
            className="bg-orange-500 hover:bg-orange-600 text-white h-11"
          >
            <Upload className="h-4 w-4 mr-2" /> Enviar foto
          </Button>
        </div>

        {pick?.kind === "upload" && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200">
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
}: {
  pick: ProductPick;
  currentPrice: string; setCurrentPrice: (v: string) => void;
  previousPrice: string; setPreviousPrice: (v: string) => void;
  quantity: string; setQuantity: (v: string) => void;
  showAdvanced: boolean; setShowAdvanced: (v: boolean) => void;
  discountSeal: string; setDiscountSeal: (v: string) => void;
  headline: string; setHeadline: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Detalhes da oferta</h2>
        <p className="text-sm text-slate-500 mt-1">Só o preço já basta. O resto é opcional.</p>
      </div>

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
            Preço Atual <span className="text-orange-500">*</span>
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
          className="flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
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
// ETAPA 3 – Estilo Visual
// ──────────────────────────────────────────────────────────────
function Step3({ styleId, setStyleId }: { styleId: string; setStyleId: (v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Como você quer que fique?</h2>
        <p className="text-sm text-slate-500 mt-1">Toque no estilo que mais combina com sua oferta.</p>
      </div>

      <TipBar>
        Cada estilo tem um clima diferente. Não precisa acertar de primeira — você pode gerar quantas variações quiser.
      </TipBar>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STYLE_CARDS.map((card) => {
          const selected = styleId === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setStyleId(card.id)}
              className={[
                "relative rounded-2xl border-2 overflow-hidden text-left transition-all",
                selected
                  ? "border-orange-500 shadow-md scale-[1.02]"
                  : "border-slate-200 hover:border-orange-300 hover:shadow-sm",
              ].join(" ")}
            >
              {/* Preview visual (mini-encarte mock) */}
              <div
                className="h-20 w-full relative flex items-center justify-center"
                style={{ background: card.preview }}
              >
                <span className="text-3xl drop-shadow-sm">{card.icon}</span>
              </div>
              <div className="p-3 bg-white">
                <div className="font-semibold text-slate-900 text-sm leading-tight">{card.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{card.desc}</div>
              </div>
              {selected && (
                <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
