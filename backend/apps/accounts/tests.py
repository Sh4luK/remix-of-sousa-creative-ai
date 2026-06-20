from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()

REGISTER = "/api/auth/registration/"
LOGIN = "/api/auth/login/"
USER = "/api/auth/user/"
REFRESH = "/api/auth/token/refresh/"


def _register(client, email="user@example.com", password="Str0ng!Pass"):
    with patch("apps.accounts.serializers.verify_turnstile", return_value=True):
        return client.post(REGISTER, {
            "email": email,
            "password1": password,
            "password2": password,
            "turnstileToken": "test",
        })


class RegistrationTests(APITestCase):
    def test_returns_jwt(self):
        resp = _register(self.client)
        self.assertEqual(resp.status_code, 201)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_creates_user(self):
        _register(self.client, email="new@example.com")
        self.assertTrue(User.objects.filter(email="new@example.com").exists())

    def test_duplicate_email_fails(self):
        _register(self.client, email="dup@example.com")
        resp = _register(self.client, email="dup@example.com")
        self.assertEqual(resp.status_code, 400)

    def test_turnstile_failure_blocks_registration(self):
        with patch("apps.accounts.serializers.verify_turnstile", return_value=False):
            resp = self.client.post(REGISTER, {
                "email": "bad@example.com",
                "password1": "Str0ng!Pass",
                "password2": "Str0ng!Pass",
                "turnstileToken": "bad",
            })
        self.assertEqual(resp.status_code, 400)

    def test_password_mismatch_fails(self):
        with patch("apps.accounts.services.verify_turnstile", return_value=True):
            resp = self.client.post(REGISTER, {
                "email": "mismatch@example.com",
                "password1": "Str0ng!Pass",
                "password2": "Different!Pass",
                "turnstileToken": "test",
            })
        self.assertEqual(resp.status_code, 400)


class LoginTests(APITestCase):
    def setUp(self):
        _register(self.client, email="login@example.com", password="Str0ng!Pass")

    def test_returns_jwt_and_user(self):
        resp = self.client.post(LOGIN, {"email": "login@example.com", "password": "Str0ng!Pass"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertIn("user", resp.data)

    def test_wrong_password_fails(self):
        resp = self.client.post(LOGIN, {"email": "login@example.com", "password": "wrong"})
        self.assertEqual(resp.status_code, 400)

    def test_token_refresh(self):
        resp = self.client.post(LOGIN, {"email": "login@example.com", "password": "Str0ng!Pass"})
        refresh = resp.data["refresh"]
        resp2 = self.client.post(REFRESH, {"refresh": refresh})
        self.assertEqual(resp2.status_code, 200)
        self.assertIn("access", resp2.data)


class UserEndpointTests(APITestCase):
    def test_requires_auth(self):
        resp = self.client.get(USER)
        self.assertEqual(resp.status_code, 401)

    def test_returns_id_and_email(self):
        resp_reg = _register(self.client, email="me@example.com")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp_reg.data['access']}")
        resp = self.client.get(USER)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("id", resp.data)
        self.assertIn("email", resp.data)
        self.assertEqual(resp.data["email"], "me@example.com")
