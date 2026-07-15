import requests
from django.conf import settings

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v1/siteverify"

# Chaves dummy documentadas pela Cloudflare para dev/test (não requerem round-trip de rede):
# https://developers.cloudflare.com/turnstile/troubleshooting/testing/
_DUMMY_PASS_SECRETS = {"1x0000000000000000000000000000000AA"}
_DUMMY_FAIL_SECRETS = {
    "2x0000000000000000000000000000000AA",
    "3x0000000000000000000000000000000AA",
}


def verify_turnstile(token: str) -> bool:
    secret = getattr(settings, "TURNSTILE_SECRET_KEY", "")
    if not secret or secret.startswith("0x_CHANGE_ME") or secret in _DUMMY_PASS_SECRETS:
        return True
    if secret in _DUMMY_FAIL_SECRETS:
        return False
    try:
        resp = requests.post(_VERIFY_URL, data={"secret": secret, "response": token}, timeout=5)
        return resp.json().get("success", False)
    except requests.RequestException:
        return False
