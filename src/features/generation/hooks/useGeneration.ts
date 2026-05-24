import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildPrompt, FORMATS, type GenerationInput } from "@/lib/promptEngine";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { ProductPick, GeneratedImage } from "@/types/database.types";
import { toast } from "sonner";

export const LOADING_MESSAGES = [
  "Analisando seu produto...",
  "A Inteligência Artificial está desenhando o cenário...",
  "Aplicando os preços e cores da sua marca...",
  "Quase pronto...",
];

export function useGeneration() {
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cycle loading messages and update progress
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

  const generate = async (
    pick: ProductPick,
    currentPrice: string,
    previousPrice: string,
    quantity: string,
    discountSeal: string,
    headline: string,
    styleId: string,
    formatId: string
  ): Promise<GeneratedImage | null> => {
    setLoading(true);
    setResult(null);
    setError(null);

    let brandPrimaryColor = "";
    let brandSecondaryColor = "";
    let brandSignature = "";
    let brandName = "";
    let brandLogoUrl = "";

    try {
      const brandRaw = localStorage.getItem("pj-midia-brand");
      if (brandRaw) {
        const brand = JSON.parse(brandRaw);
        brandPrimaryColor = brand.colors?.[0] ?? "";
        brandSecondaryColor = brand.colors?.[1] ?? "";
        brandSignature = brand.signature ?? "";
        brandName = brand.name ?? "";
        brandLogoUrl = brand.logoUrl ?? "";
      }
    } catch {
      // safe fallback if localStorage fails
    }

    const input: GenerationInput = {
      productName: pick.name,
      brand: "",
      brandName: brandName || "PJ Mídia",
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
      // Build strictly typed request body
      const body: Record<string, string | number | undefined> = {
        prompt,
        width: fmt.width,
        height: fmt.height,
        productName: pick.name,
        category: input.category,
        style: styleId,
        format: formatId,
      };

      if (input.productImageBase64) {
        body.productImage = input.productImageBase64;
      }

      // Load logo URL if custom URL is configured
      if (brandLogoUrl && !brandLogoUrl.startsWith("/logo-")) {
        try {
          const logoResp = await fetch(brandLogoUrl);
          if (logoResp.ok) {
            const logoBlob = await logoResp.blob();
            body.logoImage = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("Erro ao ler blob do logo."));
              reader.readAsDataURL(logoBlob);
            });
          }
        } catch (logoErr) {
          console.warn("Could not fetch remote logo, falling back to server side deduplication:", logoErr);
        }
      }

      const { data, error: invokeError } = await supabase.functions.invoke("generate-image", { body });
      
      if (invokeError) {
        if (invokeError instanceof FunctionsHttpError) {
          const status = invokeError.status;
          if (status === 402) {
            throw new Error("Créditos insuficientes para gerar a arte.");
          }
          if (status === 429) {
            throw new Error("Muitas tentativas simultâneas. Aguarde alguns segundos.");
          }
        }
        throw invokeError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.imageUrl) {
        throw new Error("A IA falhou em retornar uma URL de imagem.");
      }

      setLoadingProgress(100);
      setResult(data.imageUrl);
      toast.success("Encarte gerado com sucesso!");

      const returnedGen: GeneratedImage = (data.generation as GeneratedImage) || {
        id: crypto.randomUUID(),
        imageUrl: data.imageUrl,
        prompt,
        productName: pick.name,
        category: input.category,
        style: styleId,
        format: formatId,
        createdAt: new Date().toISOString(),
        favorite: false,
      };

      return returnedGen;
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Não foi possível gerar o encarte.";
      setError(errMsg);
      toast.error(errMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setResult(null);
    setError(null);
    setLoadingProgress(0);
  };

  return {
    loading,
    loadingMsgIdx,
    loadingProgress,
    result,
    error,
    generate,
    startOver,
  };
}
