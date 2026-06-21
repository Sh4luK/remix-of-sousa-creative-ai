# Plano de Recriação: Backend Django + React (mantido)

> Documento-fonte para executar a migração com o **Sonnet 4.6**, fase a fase.
> Objetivo: tirar a lógica de 3 lugares (React + Deno/Edge + SQL/RLS) e concentrá-la em **um backend Python (Django)** com **Django Admin** para você ver e controlar tudo. O frontend React **continua o mesmo**; só troca a camada de dados (Supabase SDK → API REST do Django).

---

## 0. Decisões assumidas (vete agora se discordar)

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | **Geração exige login.** Remover modo anônimo + Upstash Redis. | Elimina toda a lógica de rate-limit anônimo e o `data:URL` inline. Menos superfície. |
| 2 | **URL de imagem estável** servida por view autenticada do Django (`/api/generations/<id>/image/`). | Mata `signed URL`, a função `refresh-url` e a expiração de 1 ano de uma vez. |
| 3 | `productName`, `category`, `style`, `format`, `favorite` viram **colunas explícitas** (não JSON `metadata`). | Schema legível, filtrável no Admin, `favorite` indexável. |
| 4 | **Google OAuth e verificação de e-mail são opcionais na v1** (adiáveis). E-mail em dev = console backend. | Reduz risco. Login email/senha já destrava tudo. |
| 5 | **Storage em disco (`MEDIA_ROOT`)** via abstração de Storage do Django, privado. Trocável por S3/R2 depois sem mexer no código. | Simples de rodar local; controlável; sem lock-in. |
| 6 | **Banco: novo projeto Supabase**, conexão via **Session Pooler (IPv4, porta 5432)**. Django é dono do schema (migrations). Sem RLS. | Mantém Supabase como Postgres gerenciado; ownership vira queryset Python (debugável). Ver gotcha #G1. |
| 7 | `promptEngine.ts` **permanece no React** — `buildPrompt()` roda no cliente. Só o `NEGATIVE_PROMPT` e a chamada Stability vão pro Django. | Menos código pra portar. O Django recebe o `prompt` pronto. |
| 8 | Monorepo: React fica na raiz (como está), Django entra em **`backend/`**. `docker-compose.yml` sobe os dois. | Churn mínimo no que já funciona. |

---

## 1. Stack alvo

**Backend** (`backend/`):
- Python 3.12, Django 5.x, Django REST Framework
- `dj-rest-auth` + `django-allauth` (auth REST: registro, login JWT, e-mail, Google)
- `djangorestframework-simplejwt` (tokens)
- `psycopg[binary]` (Postgres), `dj-database-url`, `django-environ`
- `django-cors-headers`
- `Pillow` (validação/handling de imagem)
- `requests` (Stability AI, Open Food Facts, Turnstile siteverify)
- `django-cleanup` (apaga arquivo do FileField ao deletar a linha → substitui o trigger SQL)
- `gunicorn` + `whitenoise` (produção)
- `sentry-sdk` (opcional)

**Frontend** (raiz, **inalterado** exceto a camada de dados): React 18 + Vite + TS + Tailwind + shadcn/ui.

**Banco**: Supabase Postgres (projeto novo). **Storage**: disco local (dev) → S3/R2/Supabase Storage (prod, depois).

---

## 2. Mapa de migração (de → para)

| Atual (React/Deno/SQL) | Novo (Django) |
|---|---|
| Supabase Auth (email/senha, Google, verificação) | `django-allauth` + `dj-rest-auth` (JWT) |
| Turnstile (captcha no signup) | Validar token no `RegisterView` via `siteverify` (requests) |
| `useAuth.ts` (session Supabase) | `useAuth` lê `/api/auth/user/` + guarda JWT no `localStorage` |
| Edge `generate-image` | `POST /api/generations/` (DRF view + `services/stability.py` + storage) |
| Edge `search-off` | `GET /api/products/search-off/?q=&limit=` (proxy Open Food Facts) |
| Edge `refresh-url` | **Removida** — URL estável servida por view autenticada |
| RPC `check_and_log_usage` (PL/pgSQL) | `services/quota.py` atômico (`select_for_update` em `UsageQuota`) |
| Trigger `delete_generation_storage_file` | `django-cleanup` (auto-remove arquivo no delete) |
| RLS (todas as policies) | `get_queryset().filter(user=request.user)` + `IsAuthenticated` |
| Tabela `usage_logs` | model `UsageQuota` (1 linha/usuário, contador + janela) |
| Tabela `generations` | model `Generation` (colunas explícitas) |
| Tabela `brands` | model `Brand` (OneToOne com User) |
| Tabela `products` | model `Product` |
| Buckets `generated-images`/`product-images`/`brand-logos` | `FileField`/`ImageField` em `MEDIA_ROOT` (privado p/ gerações) |
| `generationStore.ts` / `productStore.ts` (Supabase SDK) | mesmas funções, agora `fetch` à API REST |
| `openFoodFacts.ts` | `fetch('/api/products/search-off/')` |
| Sentry/PostHog client | mantém no React; adiciona `sentry-sdk` no Django |

---

## 3. Modelos (sketch — referência para o Sonnet)

```python
# backend/apps/branding/models.py
class Brand(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="brand")
    name = models.CharField(max_length=120, default="PJ Mídia")
    slogan = models.CharField(max_length=200, blank=True)
    colors = models.JSONField(default=list)          # ["#E63946", ...]
    default_phrase = models.CharField(max_length=240, blank=True)
    button_text = models.CharField(max_length=60, blank=True)
    signature = models.CharField(max_length=160, blank=True)
    logo = models.ImageField(upload_to="brand-logos/", null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

# backend/apps/products/models.py
class Product(models.Model):
    SOURCE = [("user", "user"), ("openfoodfacts", "openfoodfacts")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=40, default="outros")
    image = models.ImageField(upload_to="product-images/", null=True, blank=True)
    off_image_url = models.URLField(blank=True)
    barcode = models.CharField(max_length=32, blank=True)
    source = models.CharField(max_length=16, choices=SOURCE, default="user")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes = [models.Index(fields=["user", "name"]), models.Index(fields=["user", "-created_at"])]

# backend/apps/generations/models.py
class Generation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="generations")
    prompt = models.TextField()
    image = models.ImageField(upload_to="generated-images/")   # privado; servido por view
    product_name = models.CharField(max_length=160, blank=True)
    category = models.CharField(max_length=40, blank=True)
    style = models.CharField(max_length=40, blank=True)
    format = models.CharField(max_length=20, blank=True)
    favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]

# backend/apps/usage/models.py
class UsageQuota(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    window_start = models.DateTimeField(default=timezone.now)
    count = models.PositiveIntegerField(default=0)
```

**Quota atômica** (substitui o RPC, sem corrida):
```python
# services/quota.py
LIMIT, WINDOW = 10, timedelta(hours=24)
def consume(user) -> bool:
    with transaction.atomic():
        q, _ = UsageQuota.objects.select_for_update().get_or_create(user=user)
        now = timezone.now()
        if now - q.window_start > WINDOW:
            q.window_start, q.count = now, 0
        if q.count >= LIMIT:
            return False
        q.count += 1
        q.save(update_fields=["window_start", "count"])
        return True
```

---

## 4. Contrato da API (o React depende disto — não mude os formatos)

| Método | Rota | Request | Response |
|---|---|---|---|
| POST | `/api/auth/registration/` | `{email, password1, password2, turnstileToken}` | `{access, refresh}` ou 204 (se verificação por e-mail) |
| POST | `/api/auth/login/` | `{email, password}` | `{access, refresh, user}` |
| POST | `/api/auth/logout/` | — | 200 |
| GET | `/api/auth/user/` | (Bearer) | `{id, email, ...}` |
| GET/PUT | `/api/brand/` | Brand (multipart no PUT p/ logo) | Brand |
| GET | `/api/products/?q=` | — | `Product[]` |
| POST | `/api/products/` | `{name, category, offImageUrl?, barcode?, source}` | `Product` |
| POST | `/api/products/upload-image/` | multipart `file` | `{id, displayUrl}` |
| DELETE | `/api/products/<id>/` | — | 204 |
| GET | `/api/products/search-off/?q=&limit=` | — | `OFFProduct[]` |
| GET | `/api/generations/?cursor=&limit=` | — | `GeneratedImage[]` (cursor = `created_at`) |
| POST | `/api/generations/` | `{prompt, width, height, productName, category, style, format, productImage?, logoImage?}` | `{imageUrl, generation}` |
| PATCH | `/api/generations/<id>/` | `{favorite}` | `GeneratedImage` |
| DELETE | `/api/generations/<id>/` | — | 204 |
| GET | `/api/generations/<id>/image/` | (Bearer) | bytes webp (a `imageUrl`) |

`GeneratedImage` (camelCase, igual ao `src/types/database.types.ts`): `{id, imageUrl, prompt, productName, category, style, format, createdAt, favorite}`. Use `to_representation` no serializer pra emitir camelCase.

---

## 5. Fases de execução com o Sonnet 4.6

> **Regra de ouro:** 1 fase = 1 sessão. Faça `/clear` entre fases. Toda fase termina com **migrate + testes + subir a app + me mostre o diff**. Não avance sem o critério de aceite verde.

### Fase 0 — Scaffold + Docker + conexão com o banco
- **Objetivo:** projeto Django em `backend/`, settings com `DATABASE_URL` (Supabase novo), CORS, DRF, `MEDIA_ROOT`. `docker-compose.yml` subindo `api` (8000) + `web` (Vite). Criar `backend/CLAUDE.md` (seção 7).
- **Arquivos:** `backend/`, `backend/config/settings/{base,dev,prod}.py`, `backend/.env`, `backend/Dockerfile`, `docker-compose.yml` (editar), `backend/CLAUDE.md`.
- **Aceite:** `docker compose up` → `http://localhost:8000/admin` carrega; `manage.py migrate` OK contra o Supabase novo; `manage.py createsuperuser` funciona.

### Fase 1 — Models + Admin
- **Objetivo:** apps `accounts, branding, products, generations, usage`; models da seção 3; tudo registrado no Admin (`list_display`, `search_fields`, `list_filter`).
- **Aceite:** Admin lista as 4 entidades; dá pra criar/editar à mão; `manage.py makemigrations && migrate` OK.

### Fase 2 — Auth API
- **Objetivo:** `dj-rest-auth` + `allauth` (login email-only, JWT). Endpoints da seção 4. Validar Turnstile no registro. **Google + verificação por e-mail: deixar plugável, mas pode ficar desligado (`ACCOUNT_EMAIL_VERIFICATION='none'`, console email backend) na v1.**
- **Aceite:** `curl` registro+login retorna JWT; rota protegida dá 401 sem token e 200 com Bearer.

### Fase 3 — Brand + Products API (aquecimento)
- **Objetivo:** CRUD `/api/brand/` e `/api/products/` (+ `upload-image`, + `search-off` proxy). `get_queryset` por usuário. Serializers camelCase. Testes (com OFF mockado).
- **Aceite:** testes verdes; upload cai em `MEDIA_ROOT/product-images/`; Admin mostra as linhas.

### Fase 4 — Núcleo de geração (a parte pesada — use plan mode)
- **Objetivo:** `POST /api/generations/`:
  1. `IsAuthenticated`; `services/quota.consume(user)` → 429 se estourar.
  2. Validar imagens recebidas por **magic bytes** (porte a função do Deno; `Pillow` confirma).
  3. `services/stability.py`: text-to-image (`core`) vs image-to-image (`sd3.5-large`, `strength=0.55`); `aspect_ratio` pelo `width/height`; tratar 429/402/403 e header `finish-reason: CONTENT_FILTERED`.
  4. Salvar webp no `ImageField`; criar `Generation`; retornar `{imageUrl, generation}` (a `imageUrl` aponta pra `/api/generations/<id>/image/`).
  5. Logo: se não vier no body e houver `Brand.logo`, anexar.
  - `GET` (cursor por `created_at`), `PATCH` (favorite), `DELETE`. View autenticada que **stream**a a imagem só pro dono.
  - Testes com **Stability mockada** (sem gastar crédito).
- **Aceite:** testes verdes; 1 chamada real gera, grava em disco, aparece no Admin e a imagem abre pela URL. Rate limit bloqueia na 11ª.

### Fase 5 — Religar o React ao Django
- **Objetivo:** trocar a camada de dados, **sem mexer na UI**:
  - Novo `src/lib/api.ts`: wrapper `fetch` com `baseURL` (env `VITE_API_URL`), injeta `Authorization: Bearer`, trata 401 (refresh/logout).
  - Reescrever: `useAuth.ts`, `Login.tsx` (login/registro + Turnstile token; Google atrás de flag), `useGeneration.ts` (mantém `buildPrompt`, troca `functions.invoke` por `api.post`), `generationStore.ts`, `productStore.ts`, `openFoodFacts.ts`, `BrandSettings.tsx`.
  - Apagar `src/integrations/supabase/*` e qualquer uso de `refresh-url`.
- **Aceite:** no navegador (via compose): registrar → logar → gerar arte → ver na biblioteca → favoritar/excluir → cadastrar produto (upload + busca OFF) → salvar marca. Tudo verde.

### Fase 6 — Hardening + paridade + prep de deploy
- **Objetivo:** `settings/prod.py` (DEBUG off, `ALLOWED_HOSTS`, `SECRET_KEY` do env, `CORS_ALLOWED_ORIGINS`), `gunicorn`, `whitenoise`, `collectstatic`, servir `MEDIA` em prod, `sentry-sdk`. `Dockerfile` de produção do Django. Rodar o **checklist de paridade** (seção 8).
- **Aceite:** `docker compose -f docker-compose.prod.yml up` sobe API+web estável; checklist 100%.

---

## 6. Como pilotar o Sonnet 4.6 (para extrair o melhor)

1. **Comece cada sessão** com: *"Leia `PLANO_DJANGO.md` e `backend/CLAUDE.md`. Vamos executar **só a Fase N**. Não toque em nada fora do escopo."*
2. **Dê o contrato, não a solução.** Cole a linha da tabela da seção 4 e o critério de aceite. Deixe ele desenhar.
3. **Plan mode na Fase 4** (e só nela). Peça o plano antes de codar.
4. **Feche toda fase com verificação real:** `manage.py makemigrations && migrate`, `manage.py test`, subir a app, e **"me mostre o diff"**. Não confie em "feito" sem o teste verde.
5. **Mocke serviços externos** nos testes (Stability, OFF, Turnstile) — nunca gaste crédito em teste.
6. **Um assunto por sessão.** Bug de auth não se resolve na sessão de geração.
7. **`/clear` entre fases.** Contexto limpo = menos alucinação de arquivo.
8. **Segredos só no `.env`** (nunca commit). Reaproveite as chaves atuais: `STABILITY_KEY`, `STABILITY_MODEL`, `STABILITY_SD3_MODEL`, `VITE_TURNSTILE_SITE_KEY` (+ novo `TURNSTILE_SECRET_KEY`).
9. **Contexto Windows/Docker:** lembre o Sonnet que você roda em Windows e que os comandos rodam **dentro do container** (`docker compose exec api python manage.py ...`).

---

## 7. `backend/CLAUDE.md` (cole isto na Fase 0 — guarda-corpo do Sonnet)

```markdown
# CLAUDE.md — Backend Django (PJ Mídia API)

API REST que substitui as Edge Functions Supabase. Frontend React (raiz) consome via JSON.

## Comandos (dentro do container)
docker compose exec api python manage.py migrate
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py test
docker compose exec api python manage.py createsuperuser

## Regras
- Toda lógica de negócio em services/ (Python puro, testável). Views finas.
- Ownership SEMPRE via get_queryset().filter(user=request.user). NUNCA confie em id do request.
- Serializers emitem camelCase (to_representation) — o React espera camelCase.
- Serviços externos (Stability, Open Food Facts, Turnstile) sempre mockados em teste.
- Segredos só via env (django-environ). Nada hardcoded.
- Imagens de geração são privadas: servidas por view autenticada, nunca link público.
- Tipagem e validação nos serializers; erros retornam {"error": "msg"} com status correto.

## Contrato com o frontend
Ver seção 4 de PLANO_DJANGO.md. Não altere formatos de request/response sem atualizar o React.
```

---

## 8. Checklist de paridade (rodar na Fase 6)

- [ ] Registro email/senha + Turnstile
- [ ] Login/logout + sessão persistente (JWT refresh)
- [ ] (opc.) Google OAuth · (opc.) verificação por e-mail
- [ ] Gerar arte text-to-image (catálogo e produto custom)
- [ ] Gerar arte image-to-image (upload de produto)
- [~] Logo da marca injetado quando configurado — **adiado p/ pós-deploy** (Stability i2i só aceita 1 imagem; exige compositing Pillow pós-geração)
- [ ] Rate limit 10/24h por usuário (bloqueia na 11ª)
- [ ] Erros Stability tratados (429/402/conteúdo bloqueado)
- [ ] Biblioteca: listar (paginado por cursor), favoritar, excluir
- [ ] Excluir geração apaga o arquivo do disco (django-cleanup)
- [ ] Catálogo: criar, upload de imagem, buscar Open Food Facts, excluir
- [ ] Marca: salvar dados + logo, persistente no banco
- [ ] Imagem servida só pro dono (403 pra outro usuário)
- [ ] Admin mostra e edita tudo

---

## 9. Gotchas (vão te travar se ignorar)

- **G1 — Conexão Supabase.** Use a string do **Session Pooler** (IPv4, porta 5432) no `DATABASE_URL`. A conexão *direct* é IPv6-only (quebra em host sem IPv6). O *Transaction Pooler* (6543) não suporta prepared statements/migrations bem. Session Pooler é o caminho seguro pro Django. Mantenha `?sslmode=require`.
- **G2 — CORS + JWT.** `django-cors-headers` com `CORS_ALLOWED_ORIGINS=[http://localhost:3000, http://localhost:5173]`. JWT vai no header `Authorization`, não em cookie → sem dor de SameSite.
- **G3 — Servir MEDIA.** Em dev o Django serve `MEDIA`. Em prod, `runserver` não serve estáticos: use Nginx/whitenoise ou a view de streaming autenticada (que é o nosso caso pras gerações).
- **G4 — E-mail.** Verificação por e-mail precisa SMTP. Dev = `console.EmailBackend`. Só ligue verificação real quando tiver SMTP configurado.
- **G5 — Google OAuth** exige `redirect_uri` registrado no Google Cloud + fluxo `allauth`. É a parte mais chata — deixe por último/opcional.
- **G6 — Não commitar `.env`.** Já há histórico de `.env` versionado neste repo; confira o `.gitignore`.
- **G7 — Migração de dados.** Se quiser trazer gerações/produtos antigos do Supabase atual, é um script à parte (Fase 7 futura). A v1 começa limpa.

---

## 10. Ordem recomendada
Fase 0 → 1 → 2 → 3 → 4 → 5 → 6. As fases 3 e 4 entregam valor cedo (Admin + geração funcionando). A 5 só conecta. Não pule a 0 (o banco e o Docker são a fundação).
