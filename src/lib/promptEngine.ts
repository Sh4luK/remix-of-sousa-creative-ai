// Prompt Engine — transforms simple user inputs into professional commercial prompts for Nano Banana 2

export interface GenerationInput {
  productName: string;
  brand?: string;
  category: string;
  price?: string;
  previousPrice?: string;
  discount?: string;
  quantity?: string;
  promoText?: string;
  seal?: string;
  format: string;
  style: string;
  background: string;
  primaryColors?: string;
  secondaryColors?: string;
  intensity: string;
  headline?: string;
  secondaryText?: string;
  cta?: string;
  extraInfo?: string;
  textRules: string;
  applyLogo?: boolean;
  applySeal?: boolean;
  applyPromoBand?: boolean;
  applyUrgency?: boolean;
}

const STYLE_MAP: Record<string, string> = {
  "promocional-popular": "bold Brazilian popular retail advertising style, high contrast, vibrant, aggressive pricing feel, eye-catching colors, strong commercial impact",
  "atacarejo-forte": "robust wholesale warehouse style, bulk economy feel, aggressive pricing, strong volume emphasis, no-frills commercial impact",
  "clean-moderno": "clean modern supermarket advertising, organized layout, contemporary retail design, polished and professional",
  "premium-varejo": "premium retail advertising, elegant product presentation, high-end supermarket feel, sophisticated lighting",
  "descartaveis": "clean utilitarian commercial style, organized packaging presentation, practical economy focus, clear product arrangement",
  "acougue-realista": "realistic butcher shop style, fresh meat presentation, professional food photography, appetizing and clean",
  "bebidas-geladas": "cold refreshing beverage style, condensation drops, ice crystals, bright reflections, thirst-inducing commercial feel",
  "tabloide-digital": "digital tabloid advertising style, bold typography spaces, structured promotional grid, newspaper-inspired commercial layout",
};

const BACKGROUND_MAP: Record<string, string> = {
  "solido": "solid clean colored background",
  "gradiente": "smooth gradient background with commercial appeal",
  "supermercado-desfocado": "softly blurred supermarket aisle background, bokeh retail environment",
  "prateleira": "realistic supermarket shelf background, organized retail display",
  "cozinha": "warm home kitchen background, domestic cooking environment",
  "mesa-madeira": "rustic wooden table surface, warm tones, natural setting",
  "freezer": "refrigerator or freezer interior background, cold commercial display",
  "estudio-clean": "professional studio background, clean white or light gray, commercial photography setup",
};

const INTENSITY_MAP: Record<string, string> = {
  "baixa": "subtle promotional tone, understated commercial feel",
  "media": "moderate promotional intensity, balanced commercial appeal",
  "alta": "strong promotional intensity, bold commercial impact, urgency signals",
  "maxima": "maximum promotional intensity, aggressive sale vibes, extreme urgency, bold colors, explosive offer energy",
};

const CATEGORY_CONTEXT: Record<string, string> = {
  "arroz": "rice package, grain product, pantry staple",
  "feijao": "beans package, legume product, Brazilian staple",
  "acucar": "sugar package, sweetener, pantry essential",
  "cafe": "coffee package, roasted coffee, Brazilian favorite",
  "oleo": "cooking oil bottle, soybean oil, pantry essential",
  "macarrao": "pasta package, noodles, pantry staple",
  "biscoitos": "cookie or cracker package, snack product",
  "refrigerantes": "soda bottle or can, carbonated beverage, refreshing drink",
  "agua": "water bottle, mineral water, hydration",
  "cervejas": "beer bottle or can, cold alcoholic beverage",
  "carnes": "fresh meat cuts, butcher quality, protein product",
  "frango": "whole chicken or chicken cuts, poultry, fresh protein",
  "frios": "deli meats, cold cuts, chilled products",
  "leite": "milk carton or bottle, dairy product",
  "limpeza": "cleaning product, household cleaner, hygiene",
  "higiene": "personal hygiene product, toiletries",
  "papel-higienico": "toilet paper pack, bathroom essential",
  "detergente": "dish detergent, cleaning liquid",
  "sabao": "laundry soap, washing product",
  "copos-descartaveis": "disposable cups pack, party supplies, practical items",
  "pratos-descartaveis": "disposable plates pack, convenience items",
  "talheres-descartaveis": "disposable cutlery set, practical supplies",
  "sacos-lixo": "garbage bags roll, household essential",
  "guardanapos": "napkins pack, table supplies",
  "marmitex": "meal prep containers, food storage, takeaway containers",
  "embalagens-plasticas": "plastic wrap or containers, food storage",
  "kits-promocionais": "promotional kit with multiple products, combo deal",
  "outros": "grocery product",
};

const NEGATIVE_PROMPT = "avoid distorted packaging, broken typography, unreadable labels, unrealistic anatomy, duplicated items, messy composition, low contrast, blurred product, fake supermarket environment, overly artistic abstract style, childish design, cluttered layout, poor lighting, incorrect brand rendering, malformed objects, exaggerated surrealism, deformed hands, text errors, watermarks";

export function buildPrompt(input: GenerationInput): string {
  const style = STYLE_MAP[input.style] || STYLE_MAP["promocional-popular"];
  const bg = BACKGROUND_MAP[input.background] || BACKGROUND_MAP["estudio-clean"];
  const intensity = INTENSITY_MAP[input.intensity] || INTENSITY_MAP["media"];
  const categoryCtx = CATEGORY_CONTEXT[input.category] || CATEGORY_CONTEXT["outros"];

  let prompt = `Create a high-conversion commercial promotional image for a Brazilian grocery store campaign.`;
  prompt += ` Main subject: ${input.productName}${input.brand ? ` by ${input.brand}` : ""}.`;
  prompt += ` Product category: ${categoryCtx}.`;
  prompt += ` Advertising style: ${style}.`;
  prompt += ` Background: ${bg}.`;
  prompt += ` Promotional intensity: ${intensity}.`;

  prompt += ` Composition focused on product prominence, retail realism, high visual appeal, strong commercial intention, clean background hierarchy, realistic studio lighting, premium supermarket advertising look, strong contrast, polished composition, Brazilian market aesthetics.`;

  if (input.primaryColors) {
    prompt += ` Primary color palette: ${input.primaryColors}.`;
  }

  if (input.textRules === "espaco-preco") {
    prompt += ` Leave clear empty space in the lower third for price tag and promotional text overlay. Do not render text in the image.`;
  } else if (input.textRules === "sem-texto") {
    prompt += ` Do not include any text, labels, or typography in the image. Pure product photography with promotional staging.`;
  } else if (input.textRules === "pouco-texto") {
    prompt += ` Minimal text elements, focus on visual product presentation with space for external text overlay.`;
  }

  if (input.applyPromoBand) {
    prompt += ` Include a bold promotional banner strip element in the composition.`;
  }

  if (input.applyUrgency) {
    prompt += ` Add visual urgency elements like burst shapes, flash indicators, or limited-time visual cues.`;
  }

  if (input.seal) {
    prompt += ` Feature a "${input.seal}" promotional seal/badge element.`;
  }

  prompt += ` The image must look like a real, professionally produced supermarket advertisement ready for social media. Part of the Comercial Sousa brand ecosystem: reliable, organized, popular with modern touch, clear communication, economy feel, strong promotional identity.`;

  prompt += ` Negative: ${NEGATIVE_PROMPT}`;

  return prompt;
}

export function buildSimplePrompt(simpleInput: string): string {
  return `Create a high-conversion Brazilian supermarket promotional image. Subject: ${simpleInput}. Style: bold popular retail advertising, high contrast, vibrant commercial colors. Composition: product-centered, realistic lighting, clean hierarchy, space for price overlay, supermarket context, social media ready, Brazilian market aesthetics. Part of the Comercial Sousa brand: reliable, organized, promotional, economy feel. Negative: ${NEGATIVE_PROMPT}`;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaults: Partial<GenerationInput>;
}

export const PRESETS: Preset[] = [
  {
    id: "oferta-popular",
    name: "Oferta Popular",
    description: "Estilo forte de varejo, chamativo, alto contraste",
    icon: "🔥",
    defaults: { style: "promocional-popular", intensity: "maxima", background: "supermercado-desfocado", textRules: "espaco-preco", applyPromoBand: true, applyUrgency: true, seal: "Oferta" },
  },
  {
    id: "premium-clean",
    name: "Premium Clean",
    description: "Moderno, limpo, elegante, ainda comercial",
    icon: "✨",
    defaults: { style: "premium-varejo", intensity: "media", background: "estudio-clean", textRules: "pouco-texto" },
  },
  {
    id: "atacarejo",
    name: "Atacarejo",
    description: "Volume, economia, preço agressivo",
    icon: "📦",
    defaults: { style: "atacarejo-forte", intensity: "alta", background: "prateleira", textRules: "espaco-preco", applyPromoBand: true, seal: "Leve Mais" },
  },
  {
    id: "descartaveis",
    name: "Descartáveis",
    description: "Limpo, utilitário, foco em praticidade",
    icon: "🥤",
    defaults: { style: "descartaveis", intensity: "media", background: "estudio-clean", textRules: "pouco-texto", category: "copos-descartaveis" },
  },
  {
    id: "bebidas-geladas",
    name: "Bebidas Geladas",
    description: "Frio, refrescância, brilho e contraste",
    icon: "🧊",
    defaults: { style: "bebidas-geladas", intensity: "alta", background: "freezer", textRules: "espaco-preco", category: "refrigerantes" },
  },
  {
    id: "combo-promo",
    name: "Combo Promocional",
    description: "Vários produtos, hierarquia visual clara",
    icon: "🛒",
    defaults: { style: "promocional-popular", intensity: "alta", background: "gradiente", textRules: "espaco-preco", applyPromoBand: true, seal: "Combo", category: "kits-promocionais" },
  },
  {
    id: "acougue",
    name: "Açougue do Dia",
    description: "Aspecto fresco, profissional, qualidade",
    icon: "🥩",
    defaults: { style: "acougue-realista", intensity: "media", background: "estudio-clean", textRules: "pouco-texto", category: "carnes" },
  },
  {
    id: "story-promo",
    name: "Story Promocional",
    description: "Formato vertical para Instagram Stories",
    icon: "📱",
    defaults: { style: "promocional-popular", intensity: "alta", format: "9:16", background: "gradiente", textRules: "espaco-preco", applyPromoBand: true },
  },
  {
    id: "tabloide",
    name: "Tabloide Digital",
    description: "Layout de encarte digital",
    icon: "📰",
    defaults: { style: "tabloide-digital", intensity: "alta", format: "16:9", background: "solido", textRules: "espaco-preco", applyPromoBand: true },
  },
  {
    id: "whatsapp",
    name: "Chamada WhatsApp",
    description: "Arte otimizada para envio no WhatsApp",
    icon: "💬",
    defaults: { style: "promocional-popular", intensity: "maxima", format: "1:1", background: "gradiente", textRules: "espaco-preco", applyUrgency: true, seal: "Imperdível" },
  },
  {
    id: "inauguracao",
    name: "Banner Inauguração",
    description: "Campanha institucional de abertura",
    icon: "🎉",
    defaults: { style: "clean-moderno", intensity: "alta", format: "16:9", background: "gradiente", textRules: "pouco-texto", seal: "Novo" },
  },
  {
    id: "queima-estoque",
    name: "Queima de Estoque",
    description: "Liquidação, urgência máxima",
    icon: "⚡",
    defaults: { style: "atacarejo-forte", intensity: "maxima", background: "solido", textRules: "espaco-preco", applyPromoBand: true, applyUrgency: true, seal: "Desconto" },
  },
];

export const FORMATS: { value: string; label: string; width: number; height: number }[] = [
  { value: "1:1", label: "1:1 Post Quadrado", width: 1024, height: 1024 },
  { value: "4:5", label: "4:5 Feed Vertical", width: 896, height: 1120 },
  { value: "9:16", label: "9:16 Stories", width: 768, height: 1344 },
  { value: "16:9", label: "16:9 Banner", width: 1344, height: 768 },
  { value: "1080x1920", label: "1080×1920 Story Full", width: 1024, height: 1920 },
  { value: "1080x1350", label: "1080×1350 Feed", width: 1024, height: 1344 },
  { value: "1920x1080", label: "1920×1080 Banner Wide", width: 1920, height: 1024 },
];

export const CATEGORIES = [
  { value: "arroz", label: "Arroz" },
  { value: "feijao", label: "Feijão" },
  { value: "acucar", label: "Açúcar" },
  { value: "cafe", label: "Café" },
  { value: "oleo", label: "Óleo" },
  { value: "macarrao", label: "Macarrão" },
  { value: "biscoitos", label: "Biscoitos" },
  { value: "refrigerantes", label: "Refrigerantes" },
  { value: "agua", label: "Água" },
  { value: "cervejas", label: "Cervejas" },
  { value: "carnes", label: "Carnes" },
  { value: "frango", label: "Frango" },
  { value: "frios", label: "Frios" },
  { value: "leite", label: "Leite" },
  { value: "limpeza", label: "Limpeza" },
  { value: "higiene", label: "Higiene" },
  { value: "papel-higienico", label: "Papel Higiênico" },
  { value: "detergente", label: "Detergente" },
  { value: "sabao", label: "Sabão" },
  { value: "copos-descartaveis", label: "Copos Descartáveis" },
  { value: "pratos-descartaveis", label: "Pratos Descartáveis" },
  { value: "talheres-descartaveis", label: "Talheres Descartáveis" },
  { value: "sacos-lixo", label: "Sacos para Lixo" },
  { value: "guardanapos", label: "Guardanapos" },
  { value: "marmitex", label: "Marmitex" },
  { value: "embalagens-plasticas", label: "Embalagens Plásticas" },
  { value: "kits-promocionais", label: "Kits Promocionais" },
  { value: "outros", label: "Outros" },
];

export const STYLES = [
  { value: "promocional-popular", label: "Promocional Popular" },
  { value: "atacarejo-forte", label: "Atacarejo Forte" },
  { value: "clean-moderno", label: "Clean Moderno" },
  { value: "premium-varejo", label: "Premium Varejo" },
  { value: "descartaveis", label: "Descartáveis Utilitário" },
  { value: "acougue-realista", label: "Açougue Realista" },
  { value: "bebidas-geladas", label: "Bebidas Geladas" },
  { value: "tabloide-digital", label: "Tabloide Digital" },
];

export const BACKGROUNDS = [
  { value: "solido", label: "Sólido" },
  { value: "gradiente", label: "Gradiente" },
  { value: "supermercado-desfocado", label: "Supermercado Desfocado" },
  { value: "prateleira", label: "Prateleira" },
  { value: "cozinha", label: "Cozinha" },
  { value: "mesa-madeira", label: "Mesa de Madeira" },
  { value: "freezer", label: "Freezer" },
  { value: "estudio-clean", label: "Estúdio Clean" },
];

export const SEALS = [
  "Oferta", "Imperdível", "Leve Mais", "Desconto", "Novo", "Queima", "Combo", "Destaque",
];
