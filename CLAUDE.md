# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Monorepo: **React (Vite) na raiz** consome uma **API REST Django** em `backend/`. O backend Django substituiu o Supabase (auth, DB, storage, edge functions). Detalhes do backend em `backend/CLAUDE.md`; plano e contrato da API em `PLANO_DJANGO.md`.

## Commands

Frontend (raiz):
```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

Stack completo via Docker:
```bash
docker compose up                              # dev: api (8000) + web/Vite (5173)
docker compose -f docker-compose.prod.yml up --build   # prod: gunicorn + nginx em http://localhost
docker compose exec api python manage.py test --settings=config.settings.test
docker compose exec api python manage.py migrate
docker compose exec api python manage.py createsuperuser
```

## Architecture

**Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui (mínimo: accordion, button, input, label, textarea, sonner). **Backend:** Django 5 + DRF + dj-rest-auth/allauth (JWT), Postgres (Supabase via Session Pooler), storage em disco (`MEDIA_ROOT`). Geração de imagem via Stability AI (Stable Image: `core` para text-to-image, `sd3.5-large` para image-to-image). **Geração exige login** (sem modo anônimo).

### Camada de dados (frontend)

`src/lib/api.ts` é o **único** wrapper de rede: `fetch` sobre a API REST, base `VITE_API_URL + /api` (vazio = mesma origem via nginx em prod). Injeta `Authorization: Bearer`, faz refresh de JWT single-flight no 401, emite o evento `pj-auth-change`. Tokens em `localStorage` (`pj-midia-access` / `pj-midia-refresh`). `authedImageUrl()` busca o blob autenticado da imagem de geração (privada, `<img src>` não manda header) e cacheia o object URL.

Stores que consomem a API: `generationStore.ts`, `productStore.ts`, `openFoodFacts.ts`, `BrandSettings.tsx`, `useAuth.ts`.

### Auth & routing

`App.tsx` envolve as rotas protegidas em `<ProtectedRoutes>`, que lê `useAuth` (`src/hooks/useAuth.ts`, consome `/api/auth/user/`) e redireciona para `/login` sem sessão. `AppLayout` envolve as páginas autenticadas com a sidebar.

Rotas: `/` Dashboard, `/nova-arte` NewGeneration, `/biblioteca` Library, `/presets` Presets, `/marca` BrandSettings, `/configuracoes` SettingsPage. Login/registro em `Login.tsx` (envia `turnstile_token`; Google é stub).

### Image generation flow

1. `NewGeneration.tsx` — wizard de 3 passos (produto → preço → estilo). Monta `GenerationInput` e chama `buildPrompt()`.
2. `src/lib/promptEngine.ts` — transforma `GenerationInput` num prompt estruturado em inglês. **`buildPrompt()` roda no cliente** (não foi portado pro Python). Exporta também `PRESETS`, `FORMATS`, `STYLES`, `CATEGORIES`, `BACKGROUNDS`, `SEALS`.
3. `useGeneration.ts` chama `api.post("/generations/", body)` com `prompt`, `width/height`, `productName/category/style/format` e, se houver, `productImage`/`logoImage` (base64).
4. Backend `POST /api/generations/` (`backend/apps/generations/`): `IsAuthenticated` → `usage.consume()` (quota atômica 10/24h, `select_for_update`) → valida imagens por magic bytes + Pillow → `services.generate()` chama Stability (multipart; `aspect_ratio` derivado de width/height; trata 429/402/403 e `finish-reason: CONTENT_FILTERED`) → salva webp no `ImageField` → cria `Generation` → retorna `{imageUrl, generation}`. A `imageUrl` aponta para `/api/generations/<id>/image/`.
5. `authedImageUrl()` busca o blob protegido e exibe.

### Data persistence

Tudo no Postgres via Django ORM, **ownership por `get_queryset().filter(user=request.user)`** (sem RLS). Models em `backend/apps/*/models.py`:
- `Generation` — colunas explícitas (`prompt`, `image`, `product_name`, `category`, `style`, `format`, `favorite`, `created_at`). Listagem paginada por **cursor** (`created_at`). `favorite` é coluna real (PATCH).
- `Brand` — OneToOne com User (`name`, `slogan`, `colors`, `default_phrase`, `button_text`, `signature`, `logo`). Espelhado em `localStorage` (`pj-midia-brand`) só para o `buildPrompt()` injetar cores/assinatura no cliente.
- `Product` — catálogo do usuário (`name`, `category`, `image`, `off_image_url`, `barcode`, `source`).
- `UsageQuota` — 1 linha/usuário (`window_start`, `count`) para o rate limit.

Storage: `MEDIA_ROOT` em disco. **Gerações são privadas** (servidas pela view autenticada `GenerationImageView`, só pro dono → 404 pra outro). `product-images`/`brand-logos` são públicas via `/media/` (dev: Django; prod: nginx). `django-cleanup` apaga o arquivo ao deletar a linha.

### Serializers (contrato com o frontend)

Serializers emitem **camelCase** (via `to_representation` / `source=`). `GeneratedImage`: `{id, imageUrl, prompt, productName, category, style, format, createdAt, favorite}`. Não altere formatos de request/response sem atualizar o React. Contrato completo na seção 4 de `PLANO_DJANGO.md`.

### Deploy / settings

`backend/config/settings/{base,dev,prod,test}.py`. Prod: `DEBUG=False`, gunicorn + whitenoise (static), HSTS/cookies seguros, Sentry opcional (`SENTRY_DSN`), nginx reverse-proxy (`nginx.prod.conf`) servindo o SPA e fazendo proxy de `/api`,`/admin`,`/static` + `/media` do volume. Segredos só em `.env` (gitignored); ver `backend/.env.example`.

### Pendências conhecidas

- **Logo da marca não é injetado** na imagem (adiado): Stability i2i aceita 1 imagem só; exigiria compositing Pillow pós-geração. `views.py` ainda valida `logoImage` sem usar (validação morta).
- Quota é consumida **antes** da chamada Stability → falha 5xx da IA gasta 1 slot (sem refund).
- `@supabase/supabase-js` ficou órfão no `package.json`.

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