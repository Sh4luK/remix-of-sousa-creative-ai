import { describe, it, expect } from "vitest";
import { parseVoiceTranscript } from "../lib/voiceParser";
import { buildPrompt, type GenerationInput } from "../lib/promptEngine";

describe("Voice Parser (pt-BR)", () => {
  it("should extract numeric price and clean product name", () => {
    const result1 = parseVoiceTranscript("Cerveja Heineken por R$ 5,90");
    expect(result1.product).toBe("cerveja heineken");
    expect(result1.price).toBe("5,90");

    const result2 = parseVoiceTranscript("Óleo de soja 8.50");
    expect(result2.product).toBe("óleo soja");
    expect(result2.price).toBe("8,50");
  });

  it("should extract whole number prices when followed by word numbers", () => {
    const result = parseVoiceTranscript("Arroz 5kg por trinta");
    expect(result.product).toBe("arroz 5kg");
    expect(result.price).toBe("30,00");
  });

  it("should extract spoken numbers with reals and cents", () => {
    const result = parseVoiceTranscript("Feijão carioca por cinco e noventa");
    expect(result.product).toBe("feijão carioca");
    expect(result.price).toBe("5,90");
  });

  it("should clean up filler words from product name", () => {
    const result = parseVoiceTranscript("criar anúncio de refrigerante coca-cola por dez");
    expect(result.product).toBe("refrigerante coca-cola");
    expect(result.price).toBe("10,00");
  });
});

describe("Prompt Engine", () => {
  it("should build a prompt containing product details and dynamic brand name", () => {
    const input: GenerationInput = {
      productName: "Coca-Cola 2L",
      brandName: "Mercado da Esquina",
      category: "refrigerantes",
      price: "R$ 8,99",
      format: "1:1",
      style: "promocional-popular",
      background: "estudio-clean",
      intensity: "alta",
      textRules: "espaco-preco",
      applyLogo: true,
    };

    const prompt = buildPrompt(input);
    expect(prompt).toContain("Product: Coca-Cola 2L");
    expect(prompt).toContain("current price \"R$ 8,99\"");
    expect(prompt).toContain("Mercado da Esquina");
    expect(prompt).not.toContain("Comercial Sousa");
  });
});
