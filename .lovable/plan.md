

## Usar logo Comercial Sousa na aplicação e nas imagens geradas

### O que será feito

1. **Copiar a logo para o projeto** — salvar em `src/assets/logo-comercial-sousa.png` para uso na UI e em `public/logo-comercial-sousa.png` para referência no prompt.

2. **Atualizar o layout da aplicação (`src/components/AppLayout.tsx`)**
   - Substituir o ícone Sparkles pela imagem da logo no sidebar header.
   - Usar a logo também no header mobile.

3. **Atualizar o favicon/título (`index.html`)**
   - Atualizar o título da página para "Sousa Creative AI".

4. **Enviar a logo automaticamente em todas as gerações**
   - No `src/pages/NewGeneration.tsx`: quando `applyLogo` estiver ativo (já é `true` por padrão), carregar a logo como base64 e enviá-la junto na requisição como um campo `logoImage`.
   - No `supabase/functions/generate-image/index.ts`: receber `logoImage` e adicioná-lo como parte multimodal com instrução "Place this brand logo visibly in the image composition".
   - No `src/lib/promptEngine.ts`: quando `applyLogo` estiver ativo, instruir no prompt para incluir a logo da marca "Comercial Sousa Atacarejo" de forma visível e integrada à composição.

### Arquivos a modificar
- `src/assets/logo-comercial-sousa.png` — novo arquivo (cópia da imagem enviada)
- `public/logo-comercial-sousa.png` — novo arquivo para acesso direto
- `src/components/AppLayout.tsx` — trocar ícone pela logo
- `index.html` — título
- `src/pages/NewGeneration.tsx` — carregar e enviar logo base64 automaticamente
- `supabase/functions/generate-image/index.ts` — receber e incluir logo como imagem multimodal
- `src/lib/promptEngine.ts` — reforçar instrução de logo no prompt

