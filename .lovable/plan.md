

## Problema

A função `buildPrompt()` em `promptEngine.ts` não inclui no prompt várias informações preenchidas pelo usuário: **preço**, **preço anterior**, **desconto**, **quantidade**, **headline**, **CTA**, e **observações extras**. Essas informações são coletadas no formulário mas nunca chegam ao modelo de IA.

Além disso, o `localStorage` está estourando a cota porque as imagens base64 estão sendo armazenadas nele.

## Plano

### 1. Incluir todos os campos no prompt (`src/lib/promptEngine.ts`)

Na função `buildPrompt()`, após a linha do produto, adicionar condicionalmente:

- `price` → "Price displayed: R$ 19,90"
- `previousPrice` → "Previous price (crossed out): R$ 24,90"  
- `discount` → "Discount: 20%"
- `quantity` → "Product size/volume: 5kg"
- `headline` → "Main headline text: OFERTA IMPERDÍVEL"
- `cta` → "Call to action: Compre já!"
- `extraInfo` → instruções extras

### 2. Corrigir erro de localStorage (`src/lib/generationStore.ts`)

O localStorage está lotado porque armazena URLs base64 enormes. Soluções:
- Adicionar `try/catch` no `saveLibrary` para não quebrar a geração
- Limitar o tamanho da biblioteca (manter últimas 20 imagens)
- Na falha, remover itens antigos para liberar espaço

### 3. Mostrar imagem mesmo com erro de storage (`src/pages/NewGeneration.tsx`)

Mover o `addToLibrary` para depois do `setGeneratedImage` e envolver em try/catch para que a imagem apareça mesmo se o storage falhar.

---

**Arquivos a modificar:**
- `src/lib/promptEngine.ts` — incluir price, previousPrice, discount, quantity, headline, cta, extraInfo no prompt
- `src/lib/generationStore.ts` — limitar tamanho e tratar erro de quota
- `src/pages/NewGeneration.tsx` — proteger addToLibrary com try/catch

