import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Hooks, Utils, Components & Types
import { useGeneration } from "@/features/generation/hooks/useGeneration";
import { useImageCompression } from "@/features/generation/hooks/useImageCompression";
import { parseVoiceTranscript } from "@/lib/voiceParser";
import { addToLibrary } from "@/lib/generationStore";
import { PRESETS } from "@/lib/promptEngine";
import type { ProductPick } from "@/types/database.types";

import { WizardStepper } from "@/features/generation/components/WizardStepper";
import { Step1Product } from "@/features/generation/components/Step1Product";
import { Step2Price } from "@/features/generation/components/Step2Price";
import { Step3Style } from "@/features/generation/components/Step3Style";
import { LoadingOverlay } from "@/features/generation/components/LoadingOverlay";
import { ResultView } from "@/features/generation/components/ResultView";

// Simulated database catalog
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

export default function NewGeneration() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Etapa 1
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState<ProductPick | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Etapa 2
  const [currentPrice, setCurrentPrice] = useState("");
  const [voicePrice, setVoicePrice] = useState<string | null>(null);
  const [previousPrice, setPreviousPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discountSeal, setDiscountSeal] = useState("");
  const [headline, setHeadline] = useState("");

  // Etapa 3
  const [styleId, setStyleId] = useState("promocional-popular");
  const [formatId, setFormatId] = useState("1:1");

  // Hooks
  const { compressImage } = useImageCompression();
  const {
    loading,
    loadingMsgIdx,
    loadingProgress,
    result,
    generate,
    startOver: resetGeneration,
  } = useGeneration();

  // URL parameters presets application
  useEffect(() => {
    const presetId = searchParams.get("preset");
    if (presetId) {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (preset?.defaults.style) setStyleId(preset.defaults.style);
      if (preset?.defaults.format) setFormatId(preset.defaults.format);
      if (preset) toast.success(`Modelo "${preset.name}" pré-selecionado`);
    }
  }, [searchParams]);

  // Image Upload Compress
  const handleUpload = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    try {
      const base64 = await compressImage(file, 800 * 1024); // max 800KB
      setPick({
        kind: "upload",
        name: file.name.replace(/\.[^.]+$/, ""),
        previewUrl: base64,
        base64,
      });
      toast.success("Foto enviada e comprimida com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar imagem.");
    }
  };

  // Voice command parsing
  const handleVoiceTranscript = (transcript: string) => {
    const { product, price } = parseVoiceTranscript(transcript);

    if (!product && !price) {
      toast.error('Não entendi bem. Diga por exemplo: "Arroz 5kg por 25 reais".');
      return;
    }

    let matched = false;
    if (product) {
      const lower = product.toLowerCase();
      const fromCatalog = MOCK_PRODUCTS.find((p) =>
        lower.split(/\s+/).some((tk) => tk.length > 2 && p.name.toLowerCase().includes(tk))
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

    const parts = [];
    if (product) parts.push(`produto "${product}"`);
    if (price) parts.push(`preço R$ ${price}`);
    toast.success(parts.length ? `Entendi: ${parts.join(" e ")}.` : "Transcrição compreendida!");
  };

  // Stepper navigation
  const goNext = () => {
    if (step === 1 && !pick) return toast.error("Escolha um produto ou envie uma foto.");
    if (step === 2 && !currentPrice.trim()) return toast.error("Informe o preço do produto.");
    setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3);
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3);

  // Trigger Edge Function generate-image
  const handleGenerate = async () => {
    if (!pick) return;
    
    const genRecord = await generate(
      pick,
      currentPrice,
      previousPrice,
      quantity,
      discountSeal,
      headline,
      styleId,
      formatId
    );

    if (genRecord) {
      // If user is a guest, add the record to client-side localStorage
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        try {
          await addToLibrary({
            imageUrl: genRecord.imageUrl,
            prompt: genRecord.prompt,
            productName: genRecord.productName,
            category: genRecord.category,
            style: genRecord.style,
            format: genRecord.format,
          });
        } catch (err) {
          console.error("Local storage sync error:", err);
        }
      }
    }
  };

  // Actions for generated results
  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `encarte-${Date.now()}.png`;
    a.click();
  };

  const handleShareWhatsApp = () => {
    if (!result) return;
    const text = `🛒 *${pick?.name ?? "Oferta"}* por apenas ${currentPrice}!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleStartOver = () => {
    resetGeneration();
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

  if (loading) {
    return <LoadingOverlay progress={loadingProgress} messageIndex={loadingMsgIdx} />;
  }

  if (result) {
    return (
      <ResultView
        result={result}
        onDownload={handleDownload}
        onShareWhatsApp={handleShareWhatsApp}
        startOver={handleStartOver}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 sm:pb-8">
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <header className="mb-5 animate-fade-up">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Criar Novo Encarte
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">
            Em 3 passos simples. Sem complicação.
          </p>
        </header>

        <WizardStepper step={step} />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 animate-fade-up">
          {step === 1 && (
            <Step1Product
              search={search}
              setSearch={setSearch}
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
            <Step2Price
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
              onConfirmVoicePrice={() => { setVoicePrice(null); toast.success("Preço confirmado!"); setStep(3); }}
              onRejectVoicePrice={() => { setVoicePrice(null); setCurrentPrice(""); }}
            />
          )}

          {step === 3 && (
            <Step3Style
              styleId={styleId}
              setStyleId={setStyleId}
              formatId={formatId}
              setFormatId={setFormatId}
            />
          )}

          <div className="hidden sm:flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <Button variant="ghost" onClick={goBack} disabled={step === 1} className="text-slate-600">
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < 3 ? (
              <Button onClick={goNext} size="lg" className="h-12 px-6 bg-sky-600 hover:bg-sky-700 text-white">
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

      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center gap-2 shadow-lg z-10">
        <Button variant="outline" onClick={goBack} disabled={step === 1} className="h-12 px-3">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {step < 3 ? (
          <Button onClick={goNext} className="flex-1 h-12 bg-sky-600 hover:bg-sky-700 text-white text-base font-semibold">
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
