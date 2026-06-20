from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()
BRAND = "/api/brand/"


class BrandTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@example.com", password="pw")
        self.client.force_authenticate(self.user)

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(BRAND).status_code, 401)

    def test_get_autocreates_brand(self):
        resp = self.client.get(BRAND)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["name"], "PJ Mídia")
        self.assertIn("defaultPhrase", resp.data)
        self.assertIsNone(resp.data["logoUrl"])

    def test_update_brand_camelcase(self):
        resp = self.client.put(BRAND, {
            "name": "Mercado X",
            "colors": ["#E63946", "#000000"],
            "defaultPhrase": "Aproveite!",
            "buttonText": "Compre já",
            "signature": "@mercadox",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["name"], "Mercado X")
        self.assertEqual(resp.data["defaultPhrase"], "Aproveite!")
        self.assertEqual(resp.data["colors"], ["#E63946", "#000000"])
        self.user.brand.refresh_from_db()
        self.assertEqual(self.user.brand.default_phrase, "Aproveite!")
