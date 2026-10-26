from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from apps.site_settings.models import AuditLog, SiteSetting


@override_settings(MEDIA_ROOT="/tmp/wacmk-site-settings-tests")
class BasicSettingsApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.manager = get_user_model().objects.create_user(
            username="manager", email="manager@example.com", password="safe-password", is_staff=True
        )
        self.member = get_user_model().objects.create_user(
            username="member", email="member@example.com", password="safe-password"
        )
        self.url = "/api/manage/site-settings/basic/"

    def test_manager_can_read_and_persist_basic_settings(self):
        self.client.force_authenticate(self.manager)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["values"]["basic.site"]["dashboard_visit_trend_days"], 7)
        self.assertEqual(response.data["values"]["upload.video"], {"allow_user_upload": True, "vip_only": True, "max_size_mb": 200})
        self.assertEqual(response.data["values"]["system.audit_cleanup"], {"enabled": True, "retention_days": 7})

        response = self.client.patch(
            self.url,
            {"values": {"basic.site": {"title": "Example", "dashboard_visit_trend_days": 30}}},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        setting = SiteSetting.objects.get(key="basic.site")
        self.assertEqual(setting.value["title"], "Example")
        self.assertEqual(setting.updated_by, self.manager)
        audit_log = AuditLog.objects.get(action="site_settings.updated")
        self.assertEqual(audit_log.metadata["changed_keys"], ["basic.site"])

    def test_non_manager_cannot_access_settings(self):
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.patch(self.url, {"values": {}}, format="json").status_code, 403)

    def test_site_image_uses_a_fixed_top_level_filename(self):
        self.client.force_authenticate(self.manager)
        image = SimpleUploadedFile(
            "custom-name.png",
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82",
            content_type="image/png",
        )
        response = self.client.post(f"{self.url}assets/site_icon/", {"file": image}, format="multipart")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["assets"]["site_icon"], "/api/resources/public-media/site-assets/site_icon/")
        self.assertTrue(default_storage.exists("site-settings/site_icon.png"))
        self.client.force_authenticate(None)
        delivered = self.client.get(response.data["assets"]["site_icon"])
        self.assertEqual(delivered.status_code, 200)
        delivered.close()

    def test_saving_display_urls_keeps_the_asset_storage_name(self):
        self.client.force_authenticate(self.manager)
        image = SimpleUploadedFile(
            "background.png",
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82",
            content_type="image/png",
        )
        self.client.post(f"{self.url}assets/app_background/", {"file": image}, format="multipart")
        values = self.client.get(self.url).data["values"]
        self.client.patch(self.url, {"values": values}, format="json")

        stored = SiteSetting.objects.get(key="basic.assets").value["app_background"]
        self.assertEqual(stored, "site-settings/app_background.png")
        delivered = self.client.get("/api/resources/public-media/site-assets/app_background/")
        self.assertEqual(delivered.status_code, 200)
        delivered.close()

    def test_invalid_setting_is_rejected(self):
        self.client.force_authenticate(self.manager)
        response = self.client.patch(
            self.url,
            {"values": {"registration": {"enable_register": True, "code_expire_seconds": 1, "code_resend_seconds": 60}}},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(SiteSetting.objects.filter(key="registration").exists())

    def test_reset_removes_database_overrides(self):
        SiteSetting.objects.create(key="basic.site", value={"title": "Custom", "dashboard_visit_trend_days": 7})
        self.client.force_authenticate(self.manager)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(SiteSetting.objects.filter(key="basic.site").exists())
        self.assertEqual(response.data["values"]["basic.site"]["dashboard_visit_trend_days"], 7)
        self.assertTrue(AuditLog.objects.filter(action="site_settings.reset").exists())

    def test_manager_can_list_and_clear_audit_logs(self):
        AuditLog.objects.create(actor=self.manager, action="site_settings.updated", summary="Settings updated")
        self.client.force_authenticate(self.manager)

        listed = self.client.get("/api/manage/site-settings/audit-logs/", {"query": "updated", "ordering": "action"})
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["total"], 1)
        self.assertEqual(listed.data["items"][0]["action"], "site_settings.updated")
        self.assertEqual(listed.data["items"][0]["summary"], "Settings updated")

        cleared = self.client.post("/api/manage/site-settings/audit-logs/clear/", format="json")
        self.assertEqual(cleared.status_code, 200)
        self.assertEqual(cleared.data["deleted_count"], 1)
        self.assertTrue(AuditLog.objects.filter(action="audit_logs.cleared").exists())

    def test_audit_logs_require_manager_permission(self):
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get("/api/manage/site-settings/audit-logs/").status_code, 403)

    def test_cleanup_command_respects_policy_and_retention(self):
        expired = AuditLog.objects.create(action="site_settings.updated", summary="Expired")
        recent = AuditLog.objects.create(action="site_settings.updated", summary="Recent")
        AuditLog.objects.filter(pk=expired.pk).update(created_at=timezone.now() - timedelta(days=31))
        SiteSetting.objects.create(key="system.audit_cleanup", value={"enabled": True, "retention_days": 30})

        call_command("cleanup_audit_logs")

        self.assertFalse(AuditLog.objects.filter(pk=expired.pk).exists())
        self.assertTrue(AuditLog.objects.filter(pk=recent.pk).exists())
        self.assertTrue(AuditLog.objects.filter(action="audit_retention.completed").exists())

    def test_public_runtime_config_is_versioned_and_includes_storage_capacities(self):
        response = self.client.get("/api/site/config/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("version", response.data)
        self.assertIn("values", response.data)
        self.assertTrue(response.data["values"]["registration"]["enable_register"])
        self.assertEqual(response.data["values"]["vip"]["levels"][0]["level"], 1)
        self.assertEqual(response.data["values"]["vip"]["levels"][0]["display_name"], "VIP 1")
        self.assertEqual(response.data["values"]["vip"]["levels"][0]["storage_capacity_mb"], 1024)
        self.assertEqual(response.data["values"]["user"]["storage_capacity_mb"], 10)

        unchanged = self.client.get("/api/site/config/", {"version": response.data["version"]})
        self.assertEqual(unchanged.status_code, 204)

    def test_public_runtime_config_version_changes_after_update(self):
        first = self.client.get("/api/site/config/").data
        self.client.force_authenticate(self.manager)
        self.client.patch(
            self.url,
            {"values": {"basic.site": {"title": "Changed", "dashboard_visit_trend_days": 7}}},
            format="json",
        )
        changed = self.client.get("/api/site/config/").data
        self.assertNotEqual(first["version"], changed["version"])
