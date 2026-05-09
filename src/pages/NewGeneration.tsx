import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, Upload, ChevronLeft, ChevronRight, Sparkles, Check,
  ChevronDown, ChevronUp, Download, RefreshCw, X, Image as ImageIcon,
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

// ────────────────────────────────────────────────────────────
// "Base" simulada de produtos (RAG mock). Em produção isto virá do Supabase.
const MOCK_PRODUCTS = [
  { id: "p1", name: "Arroz Tio João 5kg", category: "arroz" },
  { id: "p2", name: "Feijão Carioca Camil 1kg", category: "feijao" },
  { id: "p3", name: "Óleo de Soja Soya 900ml", category: "oleo" },
  { id: "p4", name: "Café 3 Corações 500g", category: "cafe" },
  { id: "p5", name: "Refrigerante Coca-Cola 2L", category: "refrigerantes" },
  { id: "p6", name: "Cerveja Brahma Lata 350ml", category: "cervejas" },
  { id: "p7", name: "Açúcar União 5kg", category: "acucar" },
  { id: "p8", name: "Macarrão Renata 500g", category: "macarrao" },
  { id: "p9", name: "Detergente Ypê 500ml", category: "detergente" },
  { id: "p10", name: "Papel Higiênico Neve 12 rolos", category: "papel-higienico" },
];

type ProductPick =
  | { kind: "catalog"; id: string; name: string; category: string }
  | { kind: "upload"; name: string; previewUrl: string; base64: string };

// Cards visuais de estilo (mapeiam para o `style` do prompt engine)
const STYLE_CARDS = [
  { id: "promocional-popular", icon: "🔥", title: "Oferta Popular", desc: "Forte e chamativo" },
  { id: "premium-varejo", icon: "✨", title: "Premium Clean", desc: "Elegante e moderno" },
  { id: "atacarejo-forte", icon: "📦", title: "Atacarejo", desc: "Volume e economia" },
  { id: "bebidas-geladas", icon: "🧊", title: "Bebidas Geladas", desc: "Frio e refrescante" },
  { id: "acougue-realista", icon: "🥩", title: "Açougue", desc: "Fresco e profissional" },
  { id: "clean-moderno", icon: "🛍️", title: "Clean Moderno", desc: "Organizado e limpo" },
] as const;

// Mensagens rotativas do loading (4s cada)
const LOADING_MESSAGES = [
  "Analisando seu produto...",
  "A Inteligência Artificial está desenhando o cenário...",
  "Aplicando os preços e cores da sua marca...",
  "Quase pronto...",
];

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

  // Cicla mensagens de loading a cada 4s
  useEffect(() => {
    if (!loading) return;
    setLoadingMsgIdx(0);
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

  // Filtro de busca (RAG mock)
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

    // Constrói payload para o promptEngine existente
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

      // Logo automática
      try {
        const logoResp = await fetch("/logo-comercial-sousa.png");
        const logoBlob = await logoResp.blob();
        body.logoImage = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(logoBlob);
        });
      } catch {/* logo opcional */}

      const { data, error } = await supabase.functions.invoke("generate-image", { body });
      if (error) {
        const ctx = (error as any)?.context;
        if (ctx?.status === 402) throw new Error("Créditos insuficientes para gerar a arte.");
        if (ctx?.status === 429) throw new Error("Muitas tentativas. Aguarde alguns segundos.");
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("A IA não retornou uma imagem.");

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
      } catch {/* storage cheio */}
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
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 px-8 py-12 max-w-md w-full text-center animate-scale-in">
          <div className="relative h-20 w-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
            <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Gerando seu encarte</h2>
          <p key={loadingMsgIdx} className="text-base text-slate-600 animate-fade-up min-h-[24px]">
            {LOADING_MESSAGES[loadingMsgIdx]}
          </p>
          <p className="text-xs text-slate-400 mt-6">
            Isso costuma levar de 15 a 20 segundos.
          </p>
        </div>
      </div>
    );
  }

  // ────────── RESULTADO ──────────
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 animate-scale-in">
            <div className="flex items-center gap-2 text-emerald-600 mb-4">
              <Check className="h-5 w-5" />
              <span className="font-semibold">Encarte pronto!</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <img src={result} alt="Encarte gerado" className="w-full h-auto" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <Button variant="outline" size="lg" onClick={startOver} className="h-12">
                <RefreshCw className="h-4 w-4 mr-2" /> Criar outro
              </Button>
              <Button
                size="lg"
                onClick={handleDownload}
                className="h-12 bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Download className="h-4 w-4 mr-2" /> Baixar imagem
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────────── WIZARD ──────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-6 animate-fade-up">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Criar Novo Encarte
          </h1>
          <p className="text-base text-slate-600 mt-2">
            Vamos montar sua arte em 3 passos simples.
          </p>
        </header>

        {/* Stepper */}
        <Stepper step={step} />

        {/* Card principal */}
        <div
          key={step}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 animate-fade-up"
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

          {/* Navegação */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 1}
              className="text-slate-600"
            >
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
    <div className="flex items-center gap-2 mb-6 animate-fade-up" style={{ animationDelay: "60ms" }}>
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
                  isActive ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span className={["text-sm font-medium hidden sm:inline", isActive ? "text-slate-900" : "text-slate-500"].join(" ")}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={["flex-1 h-0.5 mx-3 rounded-full", step > s.n ? "bg-emerald-500" : "bg-slate-200"].join(" ")} />
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
  search, setSearch, matches, pick, setPick, uploadRef, onUpload,
}: {
  search: string; setSearch: (v: string) => void;
  matches: typeof MOCK_PRODUCTS;
  pick: ProductPick | null;
  setPick: (p: ProductPick | null) => void;
  uploadRef: React.RefObject<HTMLInputElement>;
  onUpload: (f: File) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Qual produto você quer anunciar?</h2>
        <p className="text-sm text-slate-500 mt-1">Busque no nosso catálogo ou envie uma foto.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ex: arroz, refrigerante, café..."
          className="h-14 pl-12 text-base rounded-xl border-slate-200 focus-visible:ring-orange-400"
        />
      </div>

      {/* Resultados */}
      {search && (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <p className="text-sm text-slate-500 px-2">Nenhum produto encontrado no catálogo.</p>
          ) : (
            matches.map((p) => {
              const selected = pick?.kind === "catalog" && pick.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPick({ kind: "catalog", id: p.id, name: p.name, category: p.category })}
                  className={[
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition",
                    selected
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-orange-300 bg-white",
                  ].join(" ")}
                >
                  <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500 capitalize">{p.category}</div>
                  </div>
                  {selected && <Check className="h-5 w-5 text-orange-500" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Card de fallback — sempre visível em destaque */}
      <div className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Upload className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Não encontrou o produto na lista?</p>
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
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
          >
            <Upload className="h-4 w-4 mr-2" /> Enviar foto do meu produto
          </Button>
        </div>

        {pick?.kind === "upload" && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200">
            <img src={pick.previewUrl} alt={pick.name} className="h-14 w-14 rounded-lg object-cover" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-slate-900">{pick.name}</div>
              <div className="text-xs text-emerald-600">Foto carregada</div>
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Detalhes da oferta</h2>
        <p className="text-sm text-slate-500 mt-1">Informe o preço e detalhes da promoção.</p>
      </div>

      {/* Produto selecionado */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="h-16 w-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
          {pick.kind === "upload" ? (
            <img src={pick.previewUrl} alt={pick.name} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Produto escolhido</div>
          <div className="font-semibold text-slate-900">{pick.name}</div>
        </div>
      </div>

      {/* Preços */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Preço Atual <span className="text-orange-500">*</span>
          </Label>
          <Input
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            placeholder="Ex: R$ 19,90"
            className="mt-1.5 h-12 text-lg font-semibold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-slate-700">Preço Antigo (Opcional)</Label>
            <Input
              value={previousPrice}
              onChange={(e) => setPreviousPrice(e.target.value)}
              placeholder="Ex: R$ 24,90"
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">Quantidade / Volume</Label>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 5kg, 2L, 500ml"
              className="mt-1.5 h-11"
            />
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
          Opções Avançadas
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-fade-up">
            <div>
              <Label className="text-sm font-medium text-slate-700">Selo de Desconto</Label>
              <Input
                value={discountSeal}
                onChange={(e) => setDiscountSeal(e.target.value)}
                placeholder="Ex: 20% OFF, OFERTA, IMPERDÍVEL"
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Título Principal da Oferta</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex: Mega Promoção da Semana"
                className="mt-1.5 h-11"
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Escolha o Estilo do Encarte</h2>
        <p className="text-sm text-slate-500 mt-1">Toque no visual que combina mais com a sua oferta.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STYLE_CARDS.map((card) => {
          const selected = styleId === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setStyleId(card.id)}
              className={[
                "relative rounded-2xl border-2 p-5 text-left transition-all",
                selected
                  ? "border-orange-500 bg-orange-50 shadow-md scale-[1.02]"
                  : "border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm",
              ].join(" ")}
            >
              <div className="text-3xl mb-2">{card.icon}</div>
              <div className="font-semibold text-slate-900 text-sm">{card.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.desc}</div>
              {selected && (
                <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center">
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
