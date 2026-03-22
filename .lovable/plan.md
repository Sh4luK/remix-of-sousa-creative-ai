

## Adicionar Upload de Foto do Produto e Foto de Fundo

O modelo Gemini 3.1 Flash Image suporta imagens como input via mensagens multimodais. Vamos permitir que o usuário envie uma foto do produto e/ou uma foto de fundo, que serão enviadas junto com o prompt textual para que a IA use como referência na geração.

### Plano

#### 1. Criar bucket de storage para uploads temporários
- Criar um bucket público `generation-uploads` para armazenar as imagens enviadas pelo usuário temporariamente
- Adicionar RLS para permitir uploads anônimos (são imagens temporárias de referência)

#### 2. Atualizar o formulário (`src/pages/NewGeneration.tsx`)
- Adicionar dois campos de upload de imagem no fieldset "Dados do Produto":
  - **Foto do Produto** — imagem de referência do produto real
  - **Foto de Fundo** — imagem de fundo personalizada
- Cada campo terá preview da imagem selecionada e botão para remover
- As imagens serão convertidas para base64 no cliente antes do envio

#### 3. Atualizar a interface `GenerationInput` (`src/lib/promptEngine.ts`)
- Adicionar campos opcionais `productImageBase64` e `backgroundImageBase64`
- Atualizar `buildPrompt()` para mencionar no texto que há imagens de referência anexadas

#### 4. Atualizar a edge function (`supabase/functions/generate-image/index.ts`)
- Receber os campos `productImage` e `backgroundImage` (base64) no body
- Construir a mensagem multimodal com `content` como array contendo blocos de texto e `image_url` para cada imagem fornecida
- Adicionar instruções contextuais: "Use this product photo as reference" e "Use this as the background"

### Arquivos a modificar
- `src/lib/promptEngine.ts` — adicionar campos de imagem à interface e ao prompt textual
- `src/pages/NewGeneration.tsx` — campos de upload com preview e conversão base64
- `supabase/functions/generate-image/index.ts` — mensagem multimodal com imagens

### Detalhes técnicos

A mensagem enviada ao modelo passará de string simples para array multimodal:
```text
content: [
  { type: "text", text: "..." },
  { type: "image_url", image_url: { url: "data:image/png;base64,..." } },  // produto
  { type: "image_url", image_url: { url: "data:image/png;base64,..." } },  // fundo
]
```

Não será necessário bucket de storage — as imagens serão enviadas diretamente como base64 inline, mantendo o fluxo simples e sem dependência de URLs externas.

