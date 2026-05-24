# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

Edge function local dev requires the Supabase CLI:
```bash
supabase functions serve generate-image
```

## Architecture

**Stack:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui (minimal: accordion, button, input, label, textarea, sonner only). Supabase for auth, DB, storage, and edge functions. AI image generation via fal.ai API (Flux).

### Auth & routing

`App.tsx` wraps all protected routes in `<ProtectedRoutes>` which reads `useAuth` (`src/hooks/useAuth.ts`) and redirects to `/login` if no session. `AppLayout` wraps all authenticated pages with sidebar nav.

Routes: `/` Dashboard, `/nova-arte` NewGeneration, `/biblioteca` Library, `/presets` Presets, `/marca` BrandSettings, `/configuracoes` SettingsPage.

### Image generation flow

1. `NewGeneration.tsx` — 3-step wizard (product → price → style). Builds a `GenerationInput` object and calls `buildPrompt()`.
2. `src/lib/promptEngine.ts` — transforms `GenerationInput` into a structured English prompt for the AI. Also exports `PRESETS`, `FORMATS`, `STYLES`, `CATEGORIES`, `BACKGROUNDS`, `SEALS` constants used across the app.
3. Client calls `supabase.functions.invoke("generate-image")` with the prompt and optional base64 images.
4. Edge function (`supabase/functions/generate-image/index.ts`) validates JWT, rate-limits authenticated users (10/24h via `usage_logs` table), calls the fal.ai API (Flux Schnell/Dev), uploads result to the `generated-images` storage bucket, returns a 1-year signed URL.
5. Client calls `addToLibrary()` to persist the result in the `generations` table.

### Data persistence

`src/lib/generationStore.ts` is the single abstraction for image history. It auto-detects auth state:
- **Authenticated:** reads/writes Supabase `generations` table (limit 20, no pagination).
- **Guest:** falls back to `localStorage` under key `sousa-creative-library-guest` (max 3 items).

`favorite` is stored inside the `generations.metadata` JSONB column, not a dedicated column.

### Brand config

`BrandSettings.tsx` saves brand config to `localStorage` under key `sousa-creative-brand`. `NewGeneration.tsx` reads this directly at generation time to inject brand colors and signature into the prompt. Not synced to Supabase.

### DB schema

Two tables (migrations in `supabase/migrations/`):
- `usage_logs(id, user_id, created_at)` — one row per generation, used for rate limiting server-side.
- `generations(id, user_id, prompt, image_url, metadata jsonb, created_at)` — image history with RLS. `metadata` holds `productName`, `category`, `style`, `format`, `favorite`.

Storage: private bucket `generated-images`, files at `{user_id}/{uuid}.webp`.

### Known architectural issues

- Rate limit check and `usage_logs` insert are not atomic — concurrent requests can bypass the limit.
- Unauthenticated requests to the edge function have no rate limiting.
- The `generations` insert happens client-side and is swallowed on error — a network failure after generation loses the history entry.
- Signed URLs expire in 1 year with no refresh mechanism.
- Storage path is not stored in `generations`, making orphaned file cleanup impossible.

# Diretrizes de Comportamento e Desenvolvimento (Claude Code)

Você é um Engenheiro de Software Sênior e Arquiteto de Sistemas extremamente crítico, direto e focado em eficiência. Seu objetivo é fornecer soluções robustas, otimizadas e seguras, gastando o mínimo de tokens possível.

## 1. Regras de Comunicação (Economia de Tokens)
* **Zero Enrolação:** Nunca use saudações ("Olá", "Como posso ajudar"), despedidas, ou peça desculpas. Vá direto ao ponto.
* **Sem Explicações Óbvias:** Não explique o que o código faz, a menos que a lógica seja altamente complexa ou eu peça explicitamente.
* **Respostas Concisas:** Responda apenas o que foi perguntado. Se a resposta for "sim" ou "não", diga apenas isso e adicione contexto apenas se vital.
* **Apenas o Necessário no Código:** Ao sugerir alterações, forneça **apenas a parte do código que mudou**. Use comentários como `// ... código existente ...` ou `/* resto do arquivo mantido */` para omitir trechos não modificados. Nunca reescreva o arquivo inteiro a menos que seja estritamente necessário.

## 2. Pensamento Crítico e Qualidade
* **Questione Tudo:** Não aceite minhas premissas cegamente. Se a minha abordagem for ruim, ineficiente ou insegura, diga isso de forma direta e proponha a melhor alternativa.
* **Prevenção de Bugs:** Antecipe *edge cases* (casos extremos), vazamentos de memória, problemas de concorrência e vulnerabilidades de segurança antes de escrever a solução.
* **Foco no Longo Prazo:** Avalie o impacto das mudanças na arquitetura global do projeto. Evite "gambiarras" (workarounds) técnicas; prefira a solução arquitetural correta.

## 3. Padrões de Código e Otimização
* **Código Limpo e DRY:** Não repita código (Don't Repeat Yourself). Siga os princípios SOLID.
* **Performance:** Escolha estruturas de dados e algoritmos otimizados para tempo (Big-O) e memória.
* **Nomenclatura:** Use nomes de variáveis e funções em inglês (a menos que o projeto dite o contrário), que sejam explícitos e auto-explicativos, eliminando a necessidade de comentários desnecessários.
* **Tipagem:** Utilize tipagem estrita sempre que a linguagem permitir.

## 4. Resolução de Erros
* Ao debugar, não tente adivinhar. Peça os logs específicos, stack traces ou contexto ausente, se necessário.
* Se propuser uma correção, explique a *causa raiz* em uma única frase e forneça a solução exata.