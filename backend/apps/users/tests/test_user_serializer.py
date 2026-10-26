from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User, UserMoneyChangeLog, UserPointsChangeLog
from apps.users.serializers import UserSerializer


class UserSerializerTests(TestCase):
    def test_returns_identity_values_without_exposing_groups(self):
        user = User.objects.create_user(
            username="vip", email="vip@example.com", password="secret123",
            money_balance=120, points_balance=45,
        )
        group, _ = Group.objects.get_or_create(name="vip_2")
        user.groups.add(group)

        data = UserSerializer(user).data

        self.assertEqual(data["vip_level"], 2)
        self.assertEqual(data["money_balance"], 120)
        self.assertEqual(data["points_balance"], 45)
        self.assertNotIn("group_names", data)
        self.assertNotIn("identity_label", data)


class ProfileApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="profile", email="profile@example.com", password="secret123",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_user_can_read_and_update_their_profile(self):
        response = self.client.patch(
            "/api/profile/",
            {
                "first_name": "Profile user",
                "description": "A short introduction.",
                "gender": "other",
                "age": 24,
                "github": "https://github.com/example",
                "show_email_on_namecard": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Profile user")
        self.assertEqual(self.user.description, "A short introduction.")
        self.assertEqual(self.user.age, 24)
        self.assertTrue(self.user.show_email_on_namecard)
        self.assertEqual(response.data["vip_level"], 0)
        self.assertEqual(response.data["email"], "profile@example.com")

    def test_user_can_remove_an_existing_avatar(self):
        self.user.avatar = SimpleUploadedFile("avatar.png", b"not-an-image", content_type="image/png")
        self.user.save()

        response = self.client.patch("/api/profile/", {"remove_avatar": True}, format="json")

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)

    def test_avatar_uses_a_public_delivery_url_without_exposing_its_storage_path(self):
        self.user.avatar = SimpleUploadedFile("avatar.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        self.user.save()

        response = self.client.get("/api/profile/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["avatar_url"], f"/api/resources/public-media/avatars/{self.user.pk}/")
        self.client.force_authenticate(None)
        delivered = self.client.get(response.data["avatar_url"])
        self.assertEqual(delivered.status_code, 200)
        delivered.close()

    def test_user_can_change_password_without_reauthenticating(self):
        response = self.client.post(
            "/api/profile/password/",
            {
                "old_password": "secret123",
                "new_password": "Replacement9!",
                "new_password_confirm": "Replacement9!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Replacement9!"))

    def test_password_change_rejects_incorrect_current_password(self):
        response = self.client.post(
            "/api/profile/password/",
            {
                "old_password": "incorrect",
                "new_password": "Replacement9!",
                "new_password_confirm": "Replacement9!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("old_password", response.data)


class LoginRewardAndHistoryApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rewards", email="rewards@example.com", password="secret123")
        self.client = APIClient()

    def test_login_awards_once_and_creates_money_and_points_entries(self):
        first = self.client.post("/api/auth/login/", {"username": "rewards", "password": "secret123"}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["login_reward"], {
            "awarded": True,
            "money": 10,
            "points": 10,
            "base_money": 10,
            "base_points": 10,
            "vip_money": 0,
            "vip_points": 0,
            "vip_level": 0,
        })
        self.user.refresh_from_db()
        self.assertEqual((self.user.money_balance, self.user.points_balance), (10, 10))
        self.assertEqual(UserMoneyChangeLog.objects.get(user=self.user).change_amount, 10)
        self.assertEqual(UserPointsChangeLog.objects.get(user=self.user).change_amount, 10)

        second = self.client.post("/api/auth/login/", {"username": "rewards", "password": "secret123"}, format="json")

        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data["login_reward"], {
            "awarded": False,
            "money": 0,
            "points": 0,
            "base_money": 0,
            "base_points": 0,
            "vip_money": 0,
            "vip_points": 0,
            "vip_level": 0,
        })
        self.assertEqual(UserMoneyChangeLog.objects.filter(user=self.user).count(), 1)
        self.assertEqual(UserPointsChangeLog.objects.filter(user=self.user).count(), 1)

    def test_history_is_private_and_paginated(self):
        UserMoneyChangeLog.objects.create(user=self.user, change_amount=5, balance_after=5, reason_type="admin_adjustment")
        UserMoneyChangeLog.objects.create(user=self.user, change_amount=7, balance_after=12, reason_type="daily_login_reward")
        other = User.objects.create_user(username="other", email="other@example.com", password="secret123")
        UserMoneyChangeLog.objects.create(user=other, change_amount=8, balance_after=8, reason_type="daily_login_reward")
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/profile/money-history/", {"page": 1, "page_size": 1})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["change_amount"], 7)
