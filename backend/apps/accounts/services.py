import requests
from django.conf import settings

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v1/siteverify"


def verify_turnstile(token: str) -> bool:
    secret = getattr(settings, "TURNSTILE_SECRET_KEY", "")
    # Sem secret configurado: bypass SÓ em DEBUG (dev/teste). Em produção,
    # fail-closed — esquecer a env não pode desativar o captcha silenciosamente.
    if not secret or secret.startswith("0x_CHANGE_ME"):
        return bool(getattr(settings, "DEBUG", False))
    if not token:
        return False
    try:
        resp = requests.post(_VERIFY_URL, data={"secret": secret, "response": token}, timeout=5)
        return resp.json().get("success", False)
    except (requests.RequestException, ValueError):
        return False
