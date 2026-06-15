from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.messages import get_messages
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from django.utils.translation import gettext as _

from apps.blog.models import UserMoneyHistory, UserPointsHistory
from apps.blog.utils import set_settings


User = get_user_model()
PASSWORD_RESET_SUCCESS_MESSAGE = _("Password reset successful. Please check your email.")
USERNAME_OR_EMAIL_LABEL = _("Username or email")
USERNAME_OR_EMAIL_PLACEHOLDER = _("Enter your username or email")
INVALID_LOGIN_MESSAGE = _("Username/email or password is incorrect.")
DAILY_LOGIN_REWARD_MESSAGE = _("Daily first login reward: %(rewards)s.")
DAILY_LOGIN_REWARD_MONEY_PART = _("+%(money)s money")
DAILY_LOGIN_REWARD_POINTS_PART = _("+%(points)s points")
VIP_LOGIN_BONUS_MESSAGE = _("%(vip_name)s bonus: %(rewards)s.")


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

    def test_first_login_grants_daily_reward_once(self):
        set_settings({"daily_login_reward_money": 10, "daily_login_reward_points": 10})
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
        user.refresh_from_db()
        self.assertEqual(user.profile.money, 10)
        self.assertEqual(user.profile.points, 10)
        self.assertEqual(user.profile.last_login_reward_date, timezone.localdate())
        record = UserMoneyHistory.objects.get(user=user)
        self.assertEqual(record.change_amount, 10)
        self.assertEqual(record.balance_after, 10)
        self.assertEqual(record.reason_type, UserMoneyHistory.REASON_DAILY_LOGIN_REWARD)
        points_record = UserPointsHistory.objects.get(user=user)
        self.assertEqual(points_record.change_amount, 10)
        self.assertEqual(points_record.balance_after, 10)
        self.assertEqual(points_record.reason_type, UserPointsHistory.REASON_DAILY_LOGIN_REWARD)

    def test_second_login_same_day_does_not_grant_reward_twice(self):
        set_settings({"daily_login_reward_money": 10, "daily_login_reward_points": 10})
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="pass12345",
        )

        self.client.post(reverse("login"), {"username": user.username, "password": "pass12345"})
        self.client.logout()
        response = self.client.post(reverse("login"), {"username": user.username, "password": "pass12345"})

        self.assertEqual(response.status_code, 302)
        user.refresh_from_db()
        self.assertEqual(user.profile.money, 10)
        self.assertEqual(user.profile.points, 10)

    def test_login_reward_can_be_granted_again_next_day(self):
        set_settings({"daily_login_reward_money": 10, "daily_login_reward_points": 10})
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="pass12345",
        )

        self.client.post(reverse("login"), {"username": user.username, "password": "pass12345"})
        profile = user.profile
        profile.last_login_reward_date = timezone.localdate() - timedelta(days=1)
        profile.save(update_fields=["last_login_reward_date"])
        self.client.logout()

        response = self.client.post(reverse("login"), {"username": user.username, "password": "pass12345"})

        self.assertEqual(response.status_code, 302)
        user.refresh_from_db()
        self.assertEqual(user.profile.money, 20)
        self.assertEqual(user.profile.points, 20)
        self.assertEqual(user.profile.last_login_reward_date, timezone.localdate())

    def test_zero_daily_login_reward_does_not_grant_or_mark_date(self):
        set_settings({"daily_login_reward_money": 0, "daily_login_reward_points": 0})
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="pass12345",
        )

        response = self.client.post(reverse("login"), {"username": user.username, "password": "pass12345"})

        self.assertEqual(response.status_code, 302)
        user.refresh_from_db()
        self.assertEqual(user.profile.money, 0)
        self.assertEqual(user.profile.points, 0)
        self.assertIsNone(user.profile.last_login_reward_date)

    def test_vip_login_receives_global_and_vip_daily_reward(self):
        set_settings(
            {
                "daily_login_reward_money": 10,
                "daily_login_reward_points": 10,
                "vip_max_level": 2,
                "vip_configs": [
                    {
                        "display_name": "VIP 1",
                        "money_discount": "0.10",
                        "points_discount": "0.05",
                        "daily_login_bonus_money": 5,
                        "daily_login_bonus_points": 5,
                    },
                    {
                        "display_name": "VIP 2",
                        "money_discount": "0.20",
                        "points_discount": "0.10",
                        "daily_login_bonus_money": 10,
                        "daily_login_bonus_points": 10,
                    },
                ],
            }
        )
        user = User.objects.create_user(
            username="vip-member",
            email="vip-member@example.com",
            password="pass12345",
        )
        user.groups.add(Group.objects.get_or_create(name="vip_2")[0])

        response = self.client.post(
            reverse("login"),
            {"username": user.username, "password": "pass12345"},
        )

        self.assertEqual(response.status_code, 302)
        user.refresh_from_db()
        self.assertEqual(user.profile.money, 20)
        self.assertEqual(user.profile.points, 20)
        self.assertEqual(user.profile.last_login_reward_date, timezone.localdate())

    def test_vip_daily_bonus_can_grant_reward_when_global_reward_is_zero(self):
        set_settings(
            {
                "daily_login_reward_money": 0,
                "daily_login_reward_points": 0,
                "vip_max_level": 1,
                "vip_configs": [
                    {
                        "display_name": "VIP 1",
                        "money_discount": "0.10",
                        "points_discount": "0.05",
                        "daily_login_bonus_money": 5,
                        "daily_login_bonus_points": 5,
                    }
                ],
            }
        )
        user = User.objects.create_user(
            username="vip-only-bonus",
            email="vip-only-bonus@example.com",
            password="pass12345",
        )
        user.groups.add(Group.objects.get_or_create(name="vip_1")[0])

        response = self.client.post(reverse("login"), {"username": user.username, "password": "pass12345"})

        self.assertEqual(response.status_code, 302)
        user.refresh_from_db()
        self.assertEqual(user.profile.money, 5)
        self.assertEqual(user.profile.points, 5)
        self.assertEqual(user.profile.last_login_reward_date, timezone.localdate())

    def test_successful_login_adds_reward_message(self):
        set_settings({"daily_login_reward_money": 10, "daily_login_reward_points": 5})
        user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="pass12345",
        )

        response = self.client.post(
            reverse("login"),
            {"username": user.username, "password": "pass12345"},
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        expected_message = DAILY_LOGIN_REWARD_MESSAGE % {
            "rewards": ", ".join(
                [
                    DAILY_LOGIN_REWARD_MONEY_PART % {"money": 10},
                    DAILY_LOGIN_REWARD_POINTS_PART % {"points": 5},
                ]
            )
        }
        self.assertIn(expected_message, [message.message for message in get_messages(response.wsgi_request)])

    def test_successful_vip_login_message_includes_vip_name_bonus(self):
        set_settings(
            {
                "daily_login_reward_money": 10,
                "daily_login_reward_points": 5,
                "vip_max_level": 1,
                "vip_configs": [
                    {
                        "display_name": "Gold",
                        "money_discount": "0.10",
                        "points_discount": "0.05",
                        "daily_login_bonus_money": 5,
                        "daily_login_bonus_points": 3,
                    }
                ],
            }
        )
        user = User.objects.create_user(
            username="vip-message-user",
            email="vip-message-user@example.com",
            password="pass12345",
        )
        user.groups.add(Group.objects.get_or_create(name="vip_1")[0])

        response = self.client.post(
            reverse("login"),
            {"username": user.username, "password": "pass12345"},
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        expected_message = " ".join(
            [
                DAILY_LOGIN_REWARD_MESSAGE
                % {
                    "rewards": ", ".join(
                        [
                            DAILY_LOGIN_REWARD_MONEY_PART % {"money": 10},
                            DAILY_LOGIN_REWARD_POINTS_PART % {"points": 5},
                        ]
                    )
                },
                VIP_LOGIN_BONUS_MESSAGE
                % {
                    "vip_name": "Gold",
                    "rewards": ", ".join(
                        [
                            DAILY_LOGIN_REWARD_MONEY_PART % {"money": 5},
                            DAILY_LOGIN_REWARD_POINTS_PART % {"points": 3},
                        ]
                    ),
                },
            ]
        )
        self.assertIn(expected_message, [message.message for message in get_messages(response.wsgi_request)])


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
from django.contrib.auth.models import Group
