# CLAUDE.md — Backend Django (PJ Mídia API)

API REST que substitui as Edge Functions Supabase. Frontend React (raiz) consome via JSON.

## Comandos (dentro do container)

```bash
docker compose exec api python manage.py migrate
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py test --settings=config.settings.test
docker compose exec api python manage.py createsuperuser
```

## Regras

- Toda lógica de negócio em `services/` (Python puro, testável). Views finas.
- Ownership SEMPRE via `get_queryset().filter(user=request.user)`. NUNCA confie em id do request.
- Serializers emitem camelCase (`to_representation`) — o React espera camelCase.
- Serviços externos (Stability, Open Food Facts, Turnstile) sempre mockados em teste.
- Segredos só via env (`django-environ`). Nada hardcoded.
- Imagens de geração são privadas: servidas por view autenticada, nunca link público.
- Tipagem e validação nos serializers; erros retornam `{"error": "msg"}` com status correto.

## Contrato com o frontend

Ver seção 4 de `PLANO_DJANGO.md`. Não altere formatos de request/response sem atualizar o React.
