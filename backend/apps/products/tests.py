import io
import tempfile
from unittest.mock import MagicMock, patch

import requests

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from .models import Product
from .services import infer_category, search_off

User = get_user_model()
PRODUCTS = "/api/products/"
UPLOAD = "/api/products/upload-image/"
SEARCH_OFF = "/api/products/search-off/"

_MEDIA = tempfile.mkdtemp()


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, format="PNG")
    return buf.getvalue()


@override_settings(MEDIA_ROOT=_MEDIA)
class ProductCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@example.com", password="pw")
        self.other = User.objects.create_user(username="u2", email="u2@example.com", password="pw")
        self.client.force_authenticate(self.user)

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(PRODUCTS).status_code, 401)

    def test_create_off_product_camelcase(self):
        resp = self.client.post(PRODUCTS, {
            "name": "Arroz Tio João",
            "category": "arroz",
            "offImageUrl": "https://img/off.jpg",
            "barcode": "789",
            "source": "openfoodfacts",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["offImageUrl"], "https://img/off.jpg")
        self.assertEqual(resp.data["displayUrl"], "https://img/off.jpg")
        self.assertEqual(resp.data["source"], "openfoodfacts")

    def test_duplicate_name_returns_existing(self):
        self.client.post(PRODUCTS, {"name": "Café", "category": "cafe", "source": "user"}, format="json")
        resp = self.client.post(PRODUCTS, {"name": "café", "category": "cafe", "source": "user"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Product.objects.filter(user=self.user).count(), 1)

    def test_list_filters_by_user_and_query(self):
        Product.objects.create(user=self.user, name="Arroz", category="arroz")
        Product.objects.create(user=self.user, name="Feijão", category="feijao")
        Product.objects.create(user=self.other, name="Arroz Alheio", category="arroz")
        resp = self.client.get(PRODUCTS + "?q=arroz")
        self.assertEqual(resp.status_code, 200)
        names = [p["name"] for p in resp.data]
        self.assertEqual(names, ["Arroz"])

    def test_delete_only_own(self):
        mine = Product.objects.create(user=self.user, name="Meu", category="outros")
        theirs = Product.objects.create(user=self.other, name="Dele", category="outros")
        self.assertEqual(self.client.delete(f"{PRODUCTS}{mine.id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"{PRODUCTS}{theirs.id}/").status_code, 404)

    def test_upload_image(self):
        file = SimpleUploadedFile("p.png", _png_bytes(), content_type="image/png")
        resp = self.client.post(UPLOAD, {"file": file, "name": "Upload", "category": "outros"}, format="multipart")
        self.assertEqual(resp.status_code, 201)
        self.assertIn("id", resp.data)
        self.assertTrue(resp.data["displayUrl"])
        p = Product.objects.get(id=resp.data["id"])
        self.assertTrue(p.image.name.startswith("product-images/"))

    def test_upload_rejects_non_image(self):
        file = SimpleUploadedFile("p.png", b"not an image", content_type="image/png")
        resp = self.client.post(UPLOAD, {"file": file}, format="multipart")
        self.assertEqual(resp.status_code, 400)


class SearchOFFTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@example.com", password="pw")
        self.client.force_authenticate(self.user)

    def test_infer_category(self):
        self.assertEqual(infer_category("Arroz branco", []), "arroz")
        self.assertEqual(infer_category("Xyz", []), "outros")

    @patch("apps.products.services.requests.get")
    def test_search_off_maps_and_infers(self, mock_get):
        mock_get.return_value = MagicMock(ok=True, json=lambda: {"products": [
            {"code": "789", "product_name": "Arroz Tio João", "brands": "Tio João",
             "categories_tags": ["en:rice"], "image_front_small_url": "https://img/a.jpg"},
            {"code": "0", "product_name": "  ", "brands": ""},
        ]})
        resp = self.client.get(SEARCH_OFF + "?q=arroz")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["category"], "arroz")
        self.assertEqual(resp.data[0]["imageUrl"], "https://img/a.jpg")

    def test_short_query_returns_empty(self):
        self.assertEqual(search_off("a"), [])

    @patch("apps.products.services.requests.get", side_effect=requests.ConnectionError("boom"))
    def test_off_failure_returns_empty(self, _mock):
        self.assertEqual(search_off("arroz"), [])
