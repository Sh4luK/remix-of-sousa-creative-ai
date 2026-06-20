import requests
from django.conf import settings

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v1/siteverify"


def verify_turnstile(token: str) -> bool:
    secret = getattr(settings, "TURNSTILE_SECRET_KEY", "")
    if not secret or secret.startswith("0x_CHANGE_ME"):
        return True
    try:
        resp = requests.post(_VERIFY_URL, data={"secret": secret, "response": token}, timeout=5)
        return resp.json().get("success", False)
    except requests.RequestException:
        return False
