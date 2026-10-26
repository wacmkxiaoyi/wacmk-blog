from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.site_settings.models import AuditLog
from apps.resources.models import Article, MediaAsset
from apps.users.models import User, UserMoneyChangeLog, UserPointsChangeLog


@override_settings(MEDIA_ROOT="/tmp/wacmk-user-management-tests")
class UserManagementApiTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser("root", "root@example.com", "secret123")
        self.staff = User.objects.create_user("staff", "staff@example.com", "secret123", is_staff=True)
        self.member = User.objects.create_user("member", "member@example.com", "secret123")
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_staff_can_list_and_update_a_regular_member(self):
        self.authenticate(self.staff)
        listed = self.client.get("/api/manage/users/", {"query": "member"})
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["total"], 1)

        updated = self.client.patch(f"/api/manage/users/{self.member.pk}/", {"first_name": "Member"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.first_name, "Member")

    def test_staff_can_remove_a_regular_member_avatar(self):
        self.member.avatar = SimpleUploadedFile("avatar.png", b"not-an-image", content_type="image/png")
        self.member.save()
        self.authenticate(self.staff)
        response = self.client.patch(
            f"/api/manage/users/{self.member.pk}/",
            {"remove_avatar": True},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertFalse(self.member.avatar)
        self.assertEqual(response.data["avatar_url"], "")

    def test_staff_cannot_manage_administrator_or_sensitive_fields(self):
        self.authenticate(self.staff)
        self.assertEqual(self.client.get(f"/api/manage/users/{self.superuser.pk}/").status_code, 403)
        self.assertEqual(self.client.post(f"/api/manage/users/{self.member.pk}/balances/", {"money_delta": 1}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/manage/users/{self.member.pk}/role/", {"is_staff": True, "is_superuser": False}, format="json").status_code, 403)

    def test_superuser_can_change_vip_and_balances_with_audit_trail(self):
        self.authenticate(self.superuser)
        role = self.client.patch(f"/api/manage/users/{self.member.pk}/role/", {"is_staff": False, "is_superuser": False, "vip_level": 2}, format="json")
        self.assertEqual(role.status_code, 200)
        self.assertTrue(self.member.groups.filter(name="vip_2").exists())

        balances = self.client.post(f"/api/manage/users/{self.member.pk}/balances/", {"money_balance": 50, "points_balance": 12, "reason": "reward"}, format="json")
        self.assertEqual(balances.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.money_balance, 50)
        self.assertEqual(self.member.points_balance, 12)
        self.assertTrue(AuditLog.objects.filter(action="user.balance_adjusted", actor=self.superuser).exists())
        money_entry = UserMoneyChangeLog.objects.get(user=self.member)
        points_entry = UserPointsChangeLog.objects.get(user=self.member)
        self.assertEqual((money_entry.change_amount, money_entry.balance_after, money_entry.reason_text), (50, 50, "reward"))
        self.assertEqual((points_entry.change_amount, points_entry.balance_after, points_entry.reason_text), (12, 12, "reward"))

        balances = self.client.post(f"/api/manage/users/{self.member.pk}/balances/", {"money_balance": 10, "points_balance": 8}, format="json")
        self.assertEqual(balances.status_code, 200)
        audit = AuditLog.objects.filter(action="user.balance_adjusted").latest("id")
        self.assertEqual(audit.metadata["money_delta"], -40)
        self.assertEqual(audit.metadata["points_delta"], -4)
        self.assertEqual(UserMoneyChangeLog.objects.filter(user=self.member).latest("id").change_amount, -40)
        self.assertEqual(UserPointsChangeLog.objects.filter(user=self.member).latest("id").change_amount, -4)

    def test_vip_level_cannot_exceed_the_active_site_configuration(self):
        self.authenticate(self.superuser)
        response = self.client.patch(
            f"/api/manage/users/{self.member.pk}/role/",
            {"is_staff": False, "is_superuser": False, "vip_level": 4},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("vip_level", response.data)

    def test_last_superuser_cannot_be_demoted_or_deleted(self):
        self.authenticate(self.superuser)
        role = self.client.patch(f"/api/manage/users/{self.superuser.pk}/role/", {"is_staff": False, "is_superuser": False}, format="json")
        self.assertEqual(role.status_code, 400)

    def test_superuser_deletion_removes_member_media_files(self):
        article = Article.objects.create(author=self.member, title="Member article", slug="member-article")
        article.cover_image = SimpleUploadedFile("cover.png", b"cover", content_type="image/png")
        article.save()
        asset = MediaAsset.objects.create(
            kind=MediaAsset.KIND_ATTACHMENT,
            file=SimpleUploadedFile("notes.txt", b"notes", content_type="text/plain"),
            original_filename="notes.txt",
            uploaded_by=self.member,
        )
        self.member.avatar = SimpleUploadedFile("avatar.png", b"avatar", content_type="image/png")
        self.member.save()
        names = (article.cover_image.name, asset.file.name, self.member.avatar.name)
        self.assertTrue(all(default_storage.exists(name) for name in names))

        self.authenticate(self.superuser)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/manage/users/{self.member.pk}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.member.pk).exists())
        self.assertTrue(all(not default_storage.exists(name) for name in names))

    def test_superuser_can_reset_a_member_password(self):
        self.authenticate(self.superuser)
        response = self.client.post(f"/api/manage/users/{self.member.pk}/password/", {"new_password": "Replacement9!"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("Replacement9!"))
        self.assertTrue(AuditLog.objects.filter(action="user.password_reset", actor=self.superuser).exists())

    def test_namecard_hides_private_email_and_balances_from_regular_viewer(self):
        self.authenticate(self.staff)
        response = self.client.get(f"/api/users/{self.member.pk}/namecard/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "")
        self.assertTrue(response.data["show_balances"])

        viewer = User.objects.create_user("viewer", "viewer@example.com", "secret123")
        self.authenticate(viewer)
        response = self.client.get(f"/api/users/{self.member.pk}/namecard/")
        self.assertFalse(response.data["show_balances"])
        self.assertNotIn("money_balance", response.data)
