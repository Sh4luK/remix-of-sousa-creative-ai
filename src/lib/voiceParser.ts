// Parser para transcrições de voz em pt-BR.
// Tenta extrair PREÇO e PRODUTO de uma frase falada como:
//   "promoção de cerveja heineken por cinco e noventa"
//   "arroz 5kg por 25 reais"
//   "refrigerante coca-cola por R$ 8,90"

const TENS_WORDS: Record<string, number> = {
  dez: 10, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};

const UNITS_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, "três": 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  cem: 100, cento: 100,
};

const ALL_NUM_WORDS = { ...TENS_WORDS, ...UNITS_WORDS };

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Soma uma sequência tipo "vinte e cinco" => 25, "cinco" => 5, "cento e dez" => 110
function wordsToNumber(tokens: string[]): number | null {
  let total = 0;
  let found = false;
  for (const raw of tokens) {
    const t = raw.replace(/[^\wçãéíóáâ]/gi, "");
    if (!t) continue;
    if (t === "e") continue;
    if (/^\d+$/.test(t)) {
      total += parseInt(t, 10);
      found = true;
      continue;
    }
    const n = ALL_NUM_WORDS[t];
    if (n === undefined) return found ? total : null;
    total += n;
    found = true;
  }
  return found ? total : null;
}

export interface VoiceParseResult {
  product: string;
  price: string; // formato "X,YY" ou ""
  raw: string;
}

export function parseVoiceTranscript(transcript: string): VoiceParseResult {
  const original = normalize(transcript);
  let text = " " + original + " ";
  let price = "";

  // ── 1. Tenta padrão NUMÉRICO com centavos: "5,90" / "5.90" / "R$ 25,99"
  const numCents = text.match(/r?\$?\s*(\d{1,4})\s*[,.]\s*(\d{1,2})\b/);
  if (numCents) {
    const cents = numCents[2].padEnd(2, "0").slice(0, 2);
    price = `${parseInt(numCents[1], 10)},${cents}`;
    text = text.replace(numCents[0], " ");
  }

  // ── 2. Padrão NUMÉRICO inteiro: "por 25 reais", "custa 30"
  if (!price) {
    const numOnly = text.match(/\b(?:por|custa|sai por|a|de)\s+r?\$?\s*(\d{1,4})\b\s*(reais?|pila)?/);
    if (numOnly) {
      price = `${parseInt(numOnly[1], 10)},00`;
      text = text.replace(numOnly[0], " ");
    }
  }

  // ── 3. Padrão FALADO: "por cinco e noventa" / "por vinte e cinco reais e noventa"
  if (!price) {
    const spoken = text.match(/\b(?:por|custa|sai por|a|de)\s+([a-zçãéíóáâ\s]+?)(?:\s+(reais?|centavos|pila)\b|\.|$)/);
    if (spoken) {
      const phrase = spoken[1].trim();
      const tokens = phrase.split(/\s+/);

      // Caso: "X e Y" onde Y é dezena (ex: "cinco e noventa") => reais=X, cents=Y
      const eIdx = tokens.indexOf("e");
      if (eIdx > 0 && eIdx < tokens.length - 1) {
        const left = tokens.slice(0, eIdx);
        const right = tokens.slice(eIdx + 1);
        const reaisN = wordsToNumber(left);
        const rightTok = right[0];
        const isTens = rightTok && TENS_WORDS[rightTok] !== undefined;
        if (reaisN !== null && isTens && right.length === 1) {
          price = `${reaisN},${TENS_WORDS[rightTok]}`;
          text = text.replace(spoken[0], " ");
        }
      }

      // Caso simples: "por vinte e cinco" => 25,00
      if (!price) {
        const n = wordsToNumber(tokens);
        if (n !== null) {
          price = `${n},00`;
          text = text.replace(spoken[0], " ");
        }
      }
    }
  }

  // ── 4. Limpeza do produto: remove fillers iniciais e conectores soltos
  let product = text
    .replace(/\b(promoção|promocao|oferta|encarte|arte|anúncio|anuncio|faz(er)?|criar?|gerar?)\b/gi, " ")
    .replace(/\b(de|do|da|um|uma)\s+/gi, " ")
    .replace(/\bpor\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove pontuação final
  product = product.replace(/[.,;!?]+$/g, "").trim();

  return { product, price, raw: original };
}
