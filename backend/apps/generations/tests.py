import base64
import io
import tempfile
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from .models import Generation

User = get_user_model()
GENERATIONS = "/api/generations/"
_MEDIA = tempfile.mkdtemp()


def _webp_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "blue").save(buf, format="WEBP")
    return buf.getvalue()


def _png_data_url() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _stability_response(status_code=200, headers=None, content=None):
    return MagicMock(
        status_code=status_code,
        headers=headers or {},
        content=_webp_bytes() if content is None else content,
    )


@override_settings(MEDIA_ROOT=_MEDIA, STABILITY_KEY="sk-test", STABILITY_MODEL="core", STABILITY_SD3_MODEL="sd3.5-large")
class GenerationCreateTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@example.com", password="pw")
        self.client.force_authenticate(self.user)

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(GENERATIONS).status_code, 401)

    @patch("apps.generations.services.requests.post")
    def test_text_to_image_success(self, mock_post):
        mock_post.return_value = _stability_response()
        resp = self.client.post(GENERATIONS, {
            "prompt": "arroz na mesa", "width": 1024, "height": 1024,
            "productName": "Arroz", "category": "arroz", "style": "promocional", "format": "1:1",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertIn("/api/generations/", resp.data["imageUrl"])
        self.assertEqual(resp.data["generation"]["productName"], "Arroz")
        self.assertEqual(resp.data["generation"]["imageUrl"], resp.data["imageUrl"])
        gen = Generation.objects.get(user=self.user)
        self.assertTrue(gen.image.name.startswith("generated-images/"))
        endpoint = mock_post.call_args.args[0]
        self.assertTrue(endpoint.endswith("/generate/core"))

    @patch("apps.generations.services.requests.post")
    def test_image_to_image_uses_sd3(self, mock_post):
        mock_post.return_value = _stability_response()
        resp = self.client.post(GENERATIONS, {
            "prompt": "produto", "productImage": _png_data_url(),
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(mock_post.call_args.args[0].endswith("/generate/sd3"))
        self.assertIn("image", mock_post.call_args.kwargs["files"])

    def test_prompt_required(self):
        resp = self.client.post(GENERATIONS, {"prompt": "  "}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_invalid_image_rejected(self):
        resp = self.client.post(GENERATIONS, {
            "prompt": "x", "productImage": "data:image/png;base64,bm90YW5pbWFnZQ==",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    @patch("apps.generations.services.requests.post")
    def test_rate_limit_blocks_eleventh(self, mock_post):
        mock_post.return_value = _stability_response()
        for _ in range(10):
            self.assertEqual(self.client.post(GENERATIONS, {"prompt": "x"}, format="json").status_code, 201)
        self.assertEqual(self.client.post(GENERATIONS, {"prompt": "x"}, format="json").status_code, 429)

    @patch("apps.generations.services.requests.post")
    def test_stability_payment_required(self, mock_post):
        mock_post.return_value = _stability_response(status_code=402)
        self.assertEqual(self.client.post(GENERATIONS, {"prompt": "x"}, format="json").status_code, 402)

    @patch("apps.generations.services.requests.post")
    def test_stability_moderation_maps_to_422(self, mock_post):
        mock_post.return_value = _stability_response(status_code=403)
        self.assertEqual(self.client.post(GENERATIONS, {"prompt": "x"}, format="json").status_code, 422)

    @patch("apps.generations.services.requests.post")
    def test_content_filtered_header_maps_to_422(self, mock_post):
        mock_post.return_value = _stability_response(headers={"finish-reason": "CONTENT_FILTERED"})
        self.assertEqual(self.client.post(GENERATIONS, {"prompt": "x"}, format="json").status_code, 422)


@override_settings(MEDIA_ROOT=_MEDIA, STABILITY_KEY="sk-test", STABILITY_MODEL="core", STABILITY_SD3_MODEL="sd3.5-large")
class GenerationListDetailTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@example.com", password="pw")
        self.other = User.objects.create_user(username="u2", email="u2@example.com", password="pw")
        self.client.force_authenticate(self.user)

    def _make(self, user, **kwargs):
        gen = Generation.objects.create(user=user, prompt="p", **kwargs)
        gen.image.save("x.webp", io.BytesIO(_webp_bytes()), save=True)
        return gen

    def test_list_filters_by_user(self):
        self._make(self.user, product_name="Meu")
        self._make(self.other, product_name="Dele")
        resp = self.client.get(GENERATIONS)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([g["productName"] for g in resp.data], ["Meu"])

    def test_cursor_pagination(self):
        a = self._make(self.user, product_name="A")
        b = self._make(self.user, product_name="B")
        resp = self.client.get(GENERATIONS, {"cursor": b.created_at.isoformat()})
        ids = [g["id"] for g in resp.data]
        self.assertEqual(ids, [str(a.id)])

    def test_patch_favorite(self):
        gen = self._make(self.user)
        resp = self.client.patch(f"{GENERATIONS}{gen.id}/", {"favorite": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["favorite"])
        gen.refresh_from_db()
        self.assertTrue(gen.favorite)

    def test_delete_only_own(self):
        mine = self._make(self.user)
        theirs = self._make(self.other)
        self.assertEqual(self.client.delete(f"{GENERATIONS}{mine.id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"{GENERATIONS}{theirs.id}/").status_code, 404)

    def test_image_served_to_owner_only(self):
        gen = self._make(self.user)
        url = f"{GENERATIONS}{gen.id}/image/"
        owner_resp = self.client.get(url)
        self.assertEqual(owner_resp.status_code, 200)
        self.assertEqual(owner_resp["Content-Type"], "image/webp")
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)
