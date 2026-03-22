

## Problema

A imagem gerada não respeita o formato/proporção selecionado (1:1, 9:16, 16:9, etc.). Isso acontece por dois motivos:

1. **Prompt não menciona o formato** -- a função `buildPrompt()` nunca inclui a proporção da imagem no texto do prompt enviado ao modelo.
2. **Edge function não passa dimensões ao modelo** -- os parâmetros `width` e `height` são recebidos mas nunca enviados na requisição à AI Gateway. O modelo Gemini image preview precisa receber o aspect ratio no prompt textual, pois a API de chat completions não suporta parâmetros de dimensão diretamente.

## Plano

### 1. Incluir formato no prompt (promptEngine.ts)

Na função `buildPrompt()`, adicionar uma linha que descreva explicitamente o aspect ratio e dimensões desejadas. Ex:

```
Image aspect ratio: 9:16 vertical (768x1344 pixels). Compose the image in portrait/vertical orientation.
```

Mapear cada formato para uma descrição de orientação (square, portrait/vertical, landscape/horizontal).

Fazer o mesmo na função `buildSimplePrompt()`, recebendo o formato como parâmetro.

### 2. Atualizar a chamada do frontend (NewGeneration.tsx)

Passar o objeto de formato para `buildSimplePrompt()` para que o modo simples também respeite o formato selecionado.

### 3. Reforçar no prompt do edge function (index.ts)

Não há necessidade de alterar a edge function significativamente, mas podemos adicionar um system message reforçando que o modelo deve respeitar a proporção solicitada no prompt.

---

**Arquivos a modificar:**
- `src/lib/promptEngine.ts` -- adicionar aspect ratio ao prompt gerado
- `src/pages/NewGeneration.tsx` -- passar formato ao `buildSimplePrompt`

