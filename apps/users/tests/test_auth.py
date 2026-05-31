from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils.translation import gettext as _


User = get_user_model()
PASSWORD_RESET_SUCCESS_MESSAGE = _("Password reset successful. Please check your email.")
USERNAME_OR_EMAIL_LABEL = _("Username or email")
USERNAME_OR_EMAIL_PLACEHOLDER = _("Enter your username or email")
INVALID_LOGIN_MESSAGE = _("Username/email or password is incorrect.")


class LoginViewTests(TestCase):
    def test_login_page_uses_username_or_email_label(self):
        response = self.client.get(reverse("login"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, USERNAME_OR_EMAIL_LABEL)
        self.assertContains(response, USERNAME_OR_EMAIL_PLACEHOLDER)

    def test_user_can_login_with_username(self):
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="pass12345",
        )

        response = self.client.post(
            reverse("login"),
            {"username": user.username, "password": "pass12345"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(int(self.client.session.get("_auth_user_id")), user.pk)

    def test_user_can_login_with_email(self):
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="pass12345",
        )

        response = self.client.post(
            reverse("login"),
            {"username": user.email, "password": "pass12345"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(int(self.client.session.get("_auth_user_id")), user.pk)

    def test_duplicate_email_cannot_be_used_to_login(self):
        User.objects.create_user(
            username="member-a",
            email="shared@example.com",
            password="pass12345",
        )
        User.objects.create_user(
            username="member-b",
            email="shared@example.com",
            password="pass12345",
        )

        response = self.client.post(
            reverse("login"),
            {"username": "shared@example.com", "password": "pass12345"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, INVALID_LOGIN_MESSAGE)
        self.assertNotIn("_auth_user_id", self.client.session)


@override_settings(
    EMAIL_DELIVERY_READY=True,
    DEFAULT_FROM_EMAIL="noreply@example.com",
)
class ForgotPasswordViewTests(TestCase):
    def test_forgot_password_accepts_username(self):
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="old-pass-123",
        )

        response = self.client.post(reverse("forgot-password"), {"identifier": user.username})

        user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], PASSWORD_RESET_SUCCESS_MESSAGE)
        self.assertEqual(len(mail.outbox), 1)
        self.assertFalse(user.check_password("old-pass-123"))

    def test_forgot_password_accepts_email(self):
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="old-pass-123",
        )

        response = self.client.post(reverse("forgot-password"), {"identifier": user.email})

        user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], PASSWORD_RESET_SUCCESS_MESSAGE)
        self.assertEqual(len(mail.outbox), 1)
        self.assertFalse(user.check_password("old-pass-123"))

    def test_forgot_password_unknown_identifier_returns_generic_success(self):
        response = self.client.post(reverse("forgot-password"), {"identifier": "missing@example.com"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], PASSWORD_RESET_SUCCESS_MESSAGE)
        self.assertEqual(len(mail.outbox), 0)

    def test_forgot_password_with_duplicate_email_returns_generic_success(self):
        old_password = "old-pass-123"
        user_a = User.objects.create_user(
            username="member-a",
            email="shared@example.com",
            password=old_password,
        )
        user_b = User.objects.create_user(
            username="member-b",
            email="shared@example.com",
            password=old_password,
        )

        response = self.client.post(reverse("forgot-password"), {"identifier": "shared@example.com"})

        user_a.refresh_from_db()
        user_b.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], PASSWORD_RESET_SUCCESS_MESSAGE)
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(user_a.check_password(old_password))
        self.assertTrue(user_b.check_password(old_password))
