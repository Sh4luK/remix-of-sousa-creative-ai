# Deploy — Produção

Dois ambientes **totalmente isolados**. Trabalhar local nunca toca prod.

| | Local (dev) | Produção |
|---|---|---|
| Onde | sua máquina / `docker compose up` | Railway (API+Redis) + Cloudflare Pages (SPA) |
| Código | working tree / branches | só `main` (deploy no push) |
| Settings | `config.settings.dev` | `config.settings.prod` |
| Banco | Supabase **dev** (`ipohuzfq…`) via `backend/.env` | Supabase **prod** (projeto novo) via vars do Railway |
| Segredos | `backend/.env` + `.env` (gitignored) | dashboards do Railway / Pages |
| Stability/Turnstile | chaves de teste | chaves reais |

**Regra de ouro:** `makemigrations` só roda em dev; o arquivo de migration é commitado. Prod só faz `migrate` (automático no deploy). Nunca aponte o `backend/.env` local para o Supabase de prod.

---

## 1. Supabase de produção (uma vez)

1. Criar um **projeto Supabase novo** (separado do dev). *[ação sua — criação de conta/DB]*
2. Copiar a connection string do **Session Pooler** (porta 5432, IPv4, `sslmode=require`).
3. Guardar para usar como `DATABASE_URL` no Railway (passo 2).

## 2. API no Railway

1. **New Project → Deploy from GitHub repo** → este repo.
2. Em **Settings → Root Directory** do serviço: `backend` (acha `railway.json` + `Dockerfile`).
3. **Variables**: colar o conjunto de `backend/env.prod.sample`, preenchendo os valores reais
   (`SECRET_KEY`, `DATABASE_URL` do Supabase prod, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
   `CSRF_TRUSTED_ORIGINS`, `STABILITY_KEY`, `TURNSTILE_SECRET_KEY`, `DJANGO_SETTINGS_MODULE=config.settings.prod`).
4. **Add Redis** (New → Database → Redis). Referenciar em `REDIS_URL` com `${{Redis.REDIS_URL}}`.
5. **Volume persistente** (crítico — filesystem do Railway é efêmero, senão as imagens somem a cada deploy):
   Service → **Volumes → New Volume**, mount path `/app/media`.
6. O `startCommand` (em `railway.json`) já roda `migrate` + `collectstatic` + `gunicorn` no `$PORT`.
   Healthcheck em `/api/healthz`.
7. Deploy. Anotar o domínio público (`*.up.railway.app`) → é o `VITE_API_URL` do frontend.

### Superuser (uma vez, após 1º deploy)
```bash
railway run --service <api> python manage.py createsuperuser
```

## 3. Frontend no Cloudflare Pages

1. **Create → Pages → Connect to Git** → este repo.
2. Build: **Framework = Vite**, build command `npm run build`, output `dist`, root `/`.
3. **Environment variables** (build-time):
   - `VITE_API_URL` = domínio da API do Railway (ex.: `https://api.seudominio.com`).
   - `VITE_TURNSTILE_SITE_KEY` = site key real do Turnstile.
4. `public/_redirects` e `public/_headers` já cuidam de SPA fallback + CSP/HSTS.
5. Deploy.

## 4. Domínio + TLS

1. **Pages** → Custom domain → `app.seudominio.com` (TLS automático).
2. **Railway** → Settings → Networking → Custom domain → `api.seudominio.com` (TLS automático).
3. Confirmar que `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` batem com os domínios finais.
4. Ativar `SECURE_SSL_REDIRECT=True` (já no template).

---

## Fluxo diário (o que garante "não afeta prod")

```
branch feature ──▶ roda local (Supabase dev) ──▶ PR ──▶ merge em main
                                                            │
                                          Railway + Pages buildam main ──▶ prod
```

- Enquanto você não faz merge em `main`, prod fica intocado.
- Rodar `docker compose up` / `npm run dev` usa só o Supabase **dev**.
- Migrations novas: `makemigrations` local, commitar, mergear → `migrate` roda sozinho no deploy.

## Rollback

- Railway: **Deployments → deploy anterior → Redeploy**.
- Pages: **Deployments → Rollback**.
- Migration destrutiva: escrever a migration reversa e deployar (não editar dados na mão).

## Pendências de prod a decidir depois

- **Refund de quota** quando a Stability falha em 5xx (hoje consome slot). Ver `CLAUDE.md`.
- Storage: hoje disco + Volume. Se escalar horizontalmente (>1 réplica), migrar `MEDIA_ROOT`
  para object storage (Supabase Storage / S3 via django-storages) — Volume não é compartilhado entre réplicas.
- `ACCOUNT_EMAIL_VERIFICATION="mandatory"` + SMTP quando quiser verificação de e-mail.
