from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from .models import EmailVerificationCode


User = get_user_model()


REGISTER_SETTINGS = {
    "APP_NAME": "WACMK",
    "ENABLE_REGISTER": True,
    "EMAIL_HOST": "smtp.example.com",
    "EMAIL_HOST_USER": "noreply@example.com",
    "EMAIL_HOST_PASSWORD": "secret",
    "DEFAULT_FROM_EMAIL": "noreply@example.com",
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    "EMAIL_DELIVERY_READY": True,
    "REGISTER_EMAIL_SETTINGS_READY": True,
    "REGISTER_AVAILABLE": True,
    "REGISTER_DEFAULT_GROUP_NAME": "normal_user",
    "REGISTER_CODE_EXPIRE_SECONDS": 600,
    "REGISTER_CODE_RESEND_SECONDS": 60,
}


class RegistrationTests(TestCase):
    def setUp(self):
        self.client = Client()

    @override_settings(REGISTER_AVAILABLE=False)
    def test_login_page_hides_register_link_when_register_disabled(self):
        response = self.client.get(reverse("login"))

        self.assertNotContains(response, "No account? Sign up")

    @override_settings(**REGISTER_SETTINGS)
    def test_login_page_shows_register_link_when_register_enabled(self):
        response = self.client.get(reverse("login"))

        self.assertContains(response, reverse("register"))
        self.assertContains(response, "No account? Sign up")

    @override_settings(**REGISTER_SETTINGS)
    def test_send_register_code_successfully(self):
        response = self.client.post(
            reverse("register-send-code"),
            {"email": "new@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(EmailVerificationCode.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("new@example.com", mail.outbox[0].to)
        self.assertEqual(mail.outbox[0].subject, "[WACMK] Your verification code")
        self.assertIn("Verification Code", mail.outbox[0].body)
        self.assertEqual(len(mail.outbox[0].alternatives), 1)
        self.assertIn("text/html", mail.outbox[0].alternatives[0].mime_type)
        self.assertIn("WACMK", mail.outbox[0].alternatives[0].content)

    @override_settings(EMAIL_DELIVERY_READY=False)
    def test_login_page_hides_forgot_password_when_email_unavailable(self):
        response = self.client.get(reverse("login"))

        self.assertNotContains(response, "Forgot password")

    @override_settings(**REGISTER_SETTINGS)
    def test_login_page_shows_forgot_password_when_email_available(self):
        response = self.client.get(reverse("login"))

        self.assertContains(response, reverse("forgot-password"))
        self.assertContains(response, "Forgot password")

    @override_settings(**REGISTER_SETTINGS)
    def test_forgot_password_returns_success_for_unknown_user(self):
        response = self.client.post(
            reverse("forgot-password"),
            {"username": "missing-user"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            response.content,
            {"ok": True, "message": "Password reset successful. Please check your email."},
        )
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(**REGISTER_SETTINGS)
    def test_forgot_password_returns_no_success_for_empty_username(self):
        response = self.client.post(
            reverse("forgot-password"),
            {"username": ""},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 400)
        self.assertJSONEqual(response.content, {"ok": False, "message": ""})
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(**REGISTER_SETTINGS)
    def test_forgot_password_resets_existing_user_and_sends_email(self):
        user = User.objects.create_user(username="tester", email="tester@example.com", password="OldPass123!")

        response = self.client.post(
            reverse("forgot-password"),
            {"username": "tester"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            response.content,
            {"ok": True, "message": "Password reset successful. Please check your email."},
        )
        self.assertEqual(len(mail.outbox), 1)
        user.refresh_from_db()
        self.assertFalse(user.check_password("OldPass123!"))
        self.assertEqual(mail.outbox[0].subject, "[WACMK] Your temporary password")
        self.assertIn("Temporary Password", mail.outbox[0].body)
        self.assertEqual(len(mail.outbox[0].alternatives), 1)
        self.assertIn("tester@example.com", mail.outbox[0].to)

    @override_settings(**REGISTER_SETTINGS)
    def test_forgot_password_returns_success_without_email(self):
        User.objects.create_user(username="tester", email="", password="OldPass123!")

        response = self.client.post(
            reverse("forgot-password"),
            {"username": "tester"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            response.content,
            {"ok": True, "message": "Password reset successful. Please check your email."},
        )
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(EMAIL_DELIVERY_READY=False)
    def test_forgot_password_returns_error_when_email_unavailable(self):
        response = self.client.post(
            reverse("forgot-password"),
            {"username": "tester"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 503)
        self.assertJSONEqual(
            response.content,
            {"ok": False, "message": "Password reset is currently unavailable."},
        )

    @override_settings(**REGISTER_SETTINGS)
    def test_send_register_code_rejects_registered_email(self):
        User.objects.create_user(username="tester", email="used@example.com", password="StrongPass123")

        response = self.client.post(
            reverse("register-send-code"),
            {"email": "used@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(EmailVerificationCode.objects.count(), 0)

    @override_settings(**REGISTER_SETTINGS)
    def test_send_register_code_enforces_resend_interval(self):
        EmailVerificationCode.objects.create(
            email="wait@example.com",
            code="123456",
            purpose=EmailVerificationCode.PURPOSE_REGISTER,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        response = self.client.post(
            reverse("register-send-code"),
            {"email": "wait@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(EmailVerificationCode.objects.count(), 1)

    @override_settings(**REGISTER_SETTINGS)
    def test_register_rejects_invalid_code(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newbie",
                "email": "newbie@example.com",
                "verification_code": "654321",
                "password1": "StrongPass123",
                "password2": "StrongPass123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "The verification code is invalid or expired.")
        self.assertFalse(User.objects.filter(username="newbie").exists())

    @override_settings(**REGISTER_SETTINGS)
    def test_register_creates_normal_user_group_member(self):
        verification = EmailVerificationCode.objects.create(
            email="newbie@example.com",
            code="123456",
            purpose=EmailVerificationCode.PURPOSE_REGISTER,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        response = self.client.post(
            reverse("register"),
            {
                "username": "newbie",
                "email": "newbie@example.com",
                "verification_code": "123456",
                "password1": "StrongPass123",
                "password2": "StrongPass123",
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("login"))
        user = User.objects.get(username="newbie")
        self.assertEqual(user.email, "newbie@example.com")
        self.assertTrue(user.groups.filter(name="normal_user").exists())
        verification.refresh_from_db()
        self.assertIsNotNone(verification.consumed_at)

    @override_settings(REGISTER_AVAILABLE=False)
    def test_register_view_redirects_when_unavailable(self):
        response = self.client.get(reverse("register"))

        self.assertRedirects(response, reverse("login"))

    @override_settings(REGISTER_AVAILABLE=False)
    def test_send_code_returns_404_when_unavailable(self):
        response = self.client.post(
            reverse("register-send-code"),
            {"email": "new@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 404)

    @override_settings(**REGISTER_SETTINGS)
    def test_send_profile_email_change_code_successfully(self):
        user = User.objects.create_user(username="tester", email="tester@example.com", password="StrongPass123")
        self.client.force_login(user)

        response = self.client.post(
            reverse("profile-email-send-code"),
            {"email": "new@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(EmailVerificationCode.objects.count(), 1)
        self.assertEqual(EmailVerificationCode.objects.first().purpose, EmailVerificationCode.PURPOSE_EMAIL_CHANGE)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "[WACMK] Your email verification code")
        self.assertIn("new@example.com", mail.outbox[0].to)
        self.assertIn("confirm your new email address", mail.outbox[0].body)

    @override_settings(**REGISTER_SETTINGS)
    def test_send_profile_email_change_code_rejects_same_email(self):
        user = User.objects.create_user(username="tester", email="tester@example.com", password="StrongPass123")
        self.client.force_login(user)

        response = self.client.post(
            reverse("profile-email-send-code"),
            {"email": "tester@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(EmailVerificationCode.objects.count(), 0)

    @override_settings(**REGISTER_SETTINGS)
    def test_send_profile_email_change_code_rejects_registered_email(self):
        user = User.objects.create_user(username="tester", email="tester@example.com", password="StrongPass123")
        User.objects.create_user(username="other", email="used@example.com", password="StrongPass123")
        self.client.force_login(user)

        response = self.client.post(
            reverse("profile-email-send-code"),
            {"email": "used@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(EmailVerificationCode.objects.count(), 0)

    @override_settings(**REGISTER_SETTINGS)
    def test_send_profile_email_change_code_enforces_resend_interval(self):
        user = User.objects.create_user(username="tester", email="tester@example.com", password="StrongPass123")
        self.client.force_login(user)
        EmailVerificationCode.objects.create(
            email="wait@example.com",
            code="123456",
            purpose=EmailVerificationCode.PURPOSE_EMAIL_CHANGE,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        response = self.client.post(
            reverse("profile-email-send-code"),
            {"email": "wait@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(EmailVerificationCode.objects.count(), 1)

    @override_settings(EMAIL_DELIVERY_READY=False)
    def test_send_profile_email_change_code_returns_404_when_unavailable(self):
        user = User.objects.create_user(username="tester", email="tester@example.com", password="StrongPass123")
        self.client.force_login(user)

        response = self.client.post(
            reverse("profile-email-send-code"),
            {"email": "new@example.com"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 404)
