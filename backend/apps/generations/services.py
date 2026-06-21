import base64
import io

import requests
from django.conf import settings
from PIL import Image, UnidentifiedImageError

NEGATIVE_PROMPT = (
    "blurry, low quality, distorted text, misspelled text, watermark, "
    "deformed, jpeg artifacts, extra limbs"
)
IMG2IMG_STRENGTH = "0.55"
STABILITY_TIMEOUT = 120

# Stability only accepts a fixed set of aspect ratios (no arbitrary pixel sizes).
STABILITY_ASPECT_RATIOS = ["21:9", "16:9", "3:2", "5:4", "1:1", "4:5", "2:3", "9:16", "9:21"]

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}


class StabilityError(Exception):
    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.status = status


def _sniff_mime(data: bytes) -> str | None:
    if len(data) >= 3 and data[0] == 0xFF and data[1] == 0xD8 and data[2] == 0xFF:
        return "image/jpeg"
    if len(data) >= 4 and data[:4] == b"\x89PNG":
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def decode_data_url_image(data_url: str) -> bytes:
    """Validate a base64 data URL by magic bytes + Pillow, returning the raw bytes."""
    if "," not in data_url:
        raise ValueError("Formato de data URL inválido.")
    try:
        data = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    except Exception:
        raise ValueError("Falha ao decodificar base64.")
    if _sniff_mime(data) not in ALLOWED_MIME:
        raise ValueError("Tipo de imagem inválido. Use JPEG, PNG ou WebP real.")
    try:
        Image.open(io.BytesIO(data)).verify()
    except (UnidentifiedImageError, OSError):
        raise ValueError("Arquivo não é uma imagem válida.")
    return data


def pick_aspect_ratio(width: int, height: int) -> str:
    target = width / height if height else 1.0
    best, best_diff = "1:1", float("inf")
    for ar in STABILITY_ASPECT_RATIOS:
        w, h = (int(x) for x in ar.split(":"))
        diff = abs(w / h - target)
        if diff < best_diff:
            best, best_diff = ar, diff
    return best


def generate(prompt: str, *, width: int, height: int, base_image: bytes | None = None) -> bytes:
    """Call Stability AI. text-to-image (core) or image-to-image (sd3.5). Returns webp bytes."""
    key = settings.STABILITY_KEY
    if not key:
        raise StabilityError("STABILITY_KEY não configurada no ambiente.", 500)

    is_img2img = base_image is not None
    sd3_model = settings.STABILITY_SD3_MODEL
    # endpoint path segment is "core" (cheapest t2i) or "sd3" (required for i2i)
    model = "sd3" if is_img2img else settings.STABILITY_MODEL
    endpoint = f"https://api.stability.ai/v2beta/stable-image/generate/{model}"

    # (None, value) tuples force multipart/form-data even without a file part.
    fields: dict = {
        "prompt": (None, prompt),
        "negative_prompt": (None, NEGATIVE_PROMPT),
        "output_format": (None, "webp"),
    }
    if is_img2img:
        fields["mode"] = (None, "image-to-image")
        fields["model"] = (None, sd3_model)
        fields["strength"] = (None, IMG2IMG_STRENGTH)
        fields["image"] = ("input.webp", base_image, "image/webp")
    else:
        # aspect_ratio and image are mutually exclusive on Stability.
        fields["aspect_ratio"] = (None, pick_aspect_ratio(width, height))
        if model == "sd3":
            fields["mode"] = (None, "text-to-image")
            fields["model"] = (None, sd3_model)

    try:
        resp = requests.post(
            endpoint,
            headers={"Authorization": f"Bearer {key}", "Accept": "image/*"},
            files=fields,
            timeout=STABILITY_TIMEOUT,
        )
    except requests.RequestException:
        raise StabilityError("Falha de conexão com a Stability AI. Tente novamente.", 502)

    if resp.status_code != 200:
        if resp.status_code == 429:
            raise StabilityError("Limite de requisições da IA excedido. Tente em alguns segundos.", 429)
        if resp.status_code == 402:
            raise StabilityError("Créditos da Stability AI esgotados.", 402)
        if resp.status_code == 403:
            raise StabilityError("Conteúdo bloqueado pela moderação da IA. Ajuste o prompt.", 422)
        raise StabilityError("Erro ao gerar imagem com Stability AI. Tente novamente.", 500)

    # With Accept: image/*, moderation hits arrive as a header on a 200 response.
    finish = resp.headers.get("finish-reason") or resp.headers.get("finish_reason")
    if finish == "CONTENT_FILTERED":
        raise StabilityError("Conteúdo bloqueado pelo filtro de segurança da IA. Ajuste o prompt.", 422)

    if not resp.content:
        raise StabilityError("A Stability AI não retornou uma imagem.", 500)
    return resp.content
