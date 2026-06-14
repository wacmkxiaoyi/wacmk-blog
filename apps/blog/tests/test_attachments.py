from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from apps.blog.forms import AttachmentUploadForm, SiteSettingForm
from apps.blog.models import Attachment, SiteSetting
from apps.blog.utils.attachments import build_attachment_placeholder, render_markdown_with_attachments
from apps.users.models import UserProfile


User = get_user_model()


class AttachmentUploadFormTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="author", password="pass12345")
        self.site_setting = SiteSetting.objects.create(attachment_max_size_mb=1)

    def test_rejects_attachment_larger_than_site_setting_limit(self):
        uploaded = SimpleUploadedFile("too-large.pdf", b"a" * (1024 * 1024 + 1), content_type="application/pdf")
        form = AttachmentUploadForm(
            data={
                "title": "Large file",
                "visibility": "public",
                "condition_rules": "[]",
                "access_scope": "unified",
                "vip_access_permission": "public",
                "vip_condition_rules": "[]",
            },
            files={"file": uploaded},
            user=self.user,
        )

        self.assertFalse(form.is_valid())
        self.assertIn("maximum size", str(form.errors["file"][0]).lower())

    def test_rejects_book_only_condition_for_attachment(self):
        uploaded = SimpleUploadedFile("demo.txt", b"hello", content_type="text/plain")
        form = AttachmentUploadForm(
            data={
                "title": "Restricted",
                "visibility": "conditional",
                "condition_rules": '[{"type":"book_only"}]',
                "access_scope": "unified",
                "vip_access_permission": "public",
                "vip_condition_rules": "[]",
            },
            files={"file": uploaded},
            user=self.user,
        )

        self.assertFalse(form.is_valid())
        self.assertIn("unknown condition type", str(form.errors["condition_rules"][0]).lower())


class AttachmentFlowTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="attachment-author", password="pass12345")
        self.reader = User.objects.create_user(username="attachment-reader", password="pass12345")
        self.vip_reader = User.objects.create_user(username="attachment-vip-reader", password="pass12345")
        self.admin = User.objects.create_superuser(username="attachment-admin", email="admin@example.com", password="pass12345")
        UserProfile.objects.get_or_create(user=self.reader)
        UserProfile.objects.get_or_create(user=self.vip_reader)
        self.site_setting = SiteSetting.objects.create(attachment_max_size_mb=1, vip_max_level=1, vip_level_names=["VIP 1"])
        self.vip_reader.groups.add(Group.objects.get_or_create(name="vip_1")[0])

    def upload_file(self, user, **overrides):
        self.client.force_login(user)
        payload = {
            "title": "Project brief",
            "visibility": "public",
            "condition_rules": "[]",
            "access_scope": "unified",
            "vip_access_permission": "public",
            "vip_condition_rules": "[]",
            "file": SimpleUploadedFile("brief.pdf", b"%PDF-demo", content_type="application/pdf"),
        }
        payload.update(overrides)
        return self.client.post(reverse("attachment-upload"), payload)

    def test_attachment_upload_returns_placeholder(self):
        response = self.upload_file(self.author)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["attachment"]["placeholder"].startswith("{{attachment:"))
        self.assertEqual(Attachment.objects.count(), 1)

    def test_attachment_upload_requires_login_for_ajax_requests(self):
        response = self.client.post(
            reverse("attachment-upload"),
            {
                "title": "Project brief",
                "visibility": "public",
                "condition_rules": "[]",
                "access_scope": "unified",
                "vip_access_permission": "public",
                "vip_condition_rules": "[]",
                "file": SimpleUploadedFile("brief.pdf", b"%PDF-demo", content_type="application/pdf"),
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertFalse(payload["ok"])
        self.assertIn("sign in", payload["message"].lower())

    def test_private_attachment_download_denied_for_other_user(self):
        upload_response = self.upload_file(self.author, visibility="private")
        attachment = Attachment.objects.get(pk=upload_response.json()["attachment"]["id"])

        self.client.force_login(self.reader)
        response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))

        self.assertEqual(response.status_code, 404)

    def test_private_attachment_download_allowed_for_admin(self):
        upload_response = self.upload_file(self.author, visibility="private")
        attachment = Attachment.objects.get(pk=upload_response.json()["attachment"]["id"])

        self.client.force_login(self.admin)
        response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))

        self.assertEqual(response.status_code, 200)

    def test_public_attachment_download_increments_download_count(self):
        upload_response = self.upload_file(self.author, visibility="public")
        attachment = Attachment.objects.get(pk=upload_response.json()["attachment"]["id"])

        response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))

        self.assertEqual(response.status_code, 200)
        attachment.refresh_from_db(fields=["download_count"])
        self.assertEqual(attachment.download_count, 1)

    def test_conditional_attachment_password_flow_unlocks_download(self):
        upload_response = self.upload_file(
            self.author,
            visibility="conditional",
            condition_rules='[{"type":"encrypted","value":"secret-pass"}]',
        )
        attachment = Attachment.objects.get(pk=upload_response.json()["attachment"]["id"])

        self.client.force_login(self.reader)
        unlock_response = self.client.post(
            reverse("attachment-access-check", kwargs={"pk": attachment.pk}),
            {"action": "password", "password": "secret-pass"},
        )

        self.assertEqual(unlock_response.status_code, 200)
        self.assertTrue(unlock_response.json()["ok"])

        download_response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))
        self.assertEqual(download_response.status_code, 200)

    def test_attachment_markdown_hides_private_attachment_for_other_user(self):
        attachment = Attachment.objects.create(
            title="Hidden file",
            original_filename="hidden.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PRIVATE,
            uploaded_by=self.author,
            file=SimpleUploadedFile("hidden.pdf", b"%PDF-hidden", content_type="application/pdf"),
        )

        html = render_markdown_with_attachments(build_attachment_placeholder(attachment.pk), self.reader)

        self.assertNotIn("attachment-card", html)
        self.assertNotIn("Download", html)

    def test_attachment_markdown_renders_download_entry_for_conditional_attachment(self):
        attachment = Attachment.objects.create(
            title="Locked file",
            original_filename="locked.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            download_count=12,
            visibility=Attachment.VISIBILITY_CONDITIONAL,
            condition_rules=[{"type": "encrypted", "value": "hashed-demo"}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("locked.pdf", b"%PDF-locked", content_type="application/pdf"),
        )

        html = render_markdown_with_attachments(build_attachment_placeholder(attachment.pk), self.reader)

        self.assertIn("attachment-card", html)
        self.assertIn("Download", html)
        self.assertNotIn("Unlock", html)
        self.assertIn("js-access-gate-link", html)
        self.assertNotIn("is-restricted", html)
        self.assertNotIn("Complete the access requirements to download it.", html)
        self.assertIn("累计下载 12 次", html)

    def test_attachment_markdown_hides_vip_private_standalone_attachment_for_vip_user(self):
        attachment = Attachment.objects.create(
            title="VIP hidden file",
            original_filename="vip-hidden.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            access_scope=Attachment.ACCESS_SCOPE_STANDALONE,
            vip_access_permission=Attachment.VISIBILITY_PRIVATE,
            uploaded_by=self.author,
            file=SimpleUploadedFile("vip-hidden.pdf", b"%PDF-vip-hidden", content_type="application/pdf"),
        )

        html = render_markdown_with_attachments(build_attachment_placeholder(attachment.pk), self.vip_reader)

        self.assertNotIn("attachment-card", html)
        self.assertNotIn("Download", html)

    def test_attachment_markdown_renders_vip_conditional_standalone_attachment_for_vip_user(self):
        attachment = Attachment.objects.create(
            title="VIP locked file",
            original_filename="vip-locked.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PRIVATE,
            access_scope=Attachment.ACCESS_SCOPE_STANDALONE,
            vip_access_permission=Attachment.VISIBILITY_CONDITIONAL,
            vip_condition_rules=[{"type": "encrypted", "value": "hashed-demo"}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("vip-locked.pdf", b"%PDF-vip-locked", content_type="application/pdf"),
        )

        html = render_markdown_with_attachments(build_attachment_placeholder(attachment.pk), self.vip_reader)

        self.assertIn("attachment-card", html)
        self.assertIn("Download", html)
        self.assertNotIn("Unlock", html)
        self.assertIn("js-access-gate-link", html)
        self.assertNotIn("is-restricted", html)
        self.assertNotIn("Complete the access requirements to download it.", html)

    def test_share_view_hides_conditional_attachment(self):
        attachment = Attachment.objects.create(
            title="Shared conditional file",
            original_filename="shared-conditional.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_CONDITIONAL,
            condition_rules=[{"type": "encrypted", "value": "hashed-demo"}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("shared-conditional.pdf", b"%PDF-shared-conditional", content_type="application/pdf"),
        )

        html = render_markdown_with_attachments(build_attachment_placeholder(attachment.pk), self.reader, is_share_view=True)

        self.assertNotIn("attachment-card", html)
        self.assertNotIn("Download", html)

    def test_share_view_renders_public_attachment_without_gate_link(self):
        attachment = Attachment.objects.create(
            title="Shared public file",
            original_filename="shared-public.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("shared-public.pdf", b"%PDF-shared-public", content_type="application/pdf"),
        )

        html = render_markdown_with_attachments(build_attachment_placeholder(attachment.pk), self.reader, is_share_view=True)

        self.assertIn("attachment-card", html)
        self.assertIn("Download", html)
        self.assertNotIn("js-access-gate-link", html)

    def test_anonymous_user_can_download_public_attachment(self):
        attachment = Attachment.objects.create(
            title="Anonymous public file",
            original_filename="anonymous-public.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("anonymous-public.pdf", b"%PDF-anonymous-public", content_type="application/pdf"),
        )

        response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))

        self.assertEqual(response.status_code, 200)

    def test_anonymous_user_cannot_download_conditional_attachment(self):
        attachment = Attachment.objects.create(
            title="Anonymous conditional file",
            original_filename="anonymous-conditional.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_CONDITIONAL,
            condition_rules=[{"type": "encrypted", "value": "hashed-demo"}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("anonymous-conditional.pdf", b"%PDF-anonymous-conditional", content_type="application/pdf"),
        )

        response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))

        self.assertEqual(response.status_code, 404)

    def test_manage_attachment_list_available_for_staff(self):
        attachment = Attachment.objects.create(
            title="Managed file",
            original_filename="managed.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("managed.pdf", b"%PDF-managed", content_type="application/pdf"),
        )

        self.client.force_login(self.admin)
        response = self.client.get(reverse("manage-attachments"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, attachment.title)
        self.assertContains(response, self.author.username)

    def test_manage_attachment_list_uses_conditional_edit_initial_values(self):
        attachment = Attachment.objects.create(
            title="Conditional file",
            original_filename="conditional.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            condition_rules=[{"type": "encrypted", "value": "hashed-demo"}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("conditional.pdf", b"%PDF-conditional", content_type="application/pdf"),
        )

        self.client.force_login(self.admin)
        response = self.client.get(reverse("manage-attachments"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-attachment-visibility="conditional"', html=False)
        self.assertContains(response, 'data-attachment-condition-initial=', html=False)
        self.assertNotContains(response, '>File<', html=False)

    def test_manage_attachment_list_preserves_non_money_condition_type_in_edit_initial(self):
        Attachment.objects.create(
            title="Points file",
            original_filename="points.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_CONDITIONAL,
            condition_rules=[{"type": "points", "value": 8}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("points.pdf", b"%PDF-points", content_type="application/pdf"),
        )

        self.client.force_login(self.admin)
        response = self.client.get(reverse("manage-attachments"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-attachment-condition-initial=', html=False)
        self.assertContains(response, '&quot;points&quot;', html=False)

    def test_profile_attachment_list_shows_only_current_users_attachments(self):
        own_attachment = Attachment.objects.create(
            title="Own file",
            original_filename="own.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("own.pdf", b"%PDF-own", content_type="application/pdf"),
        )
        Attachment.objects.create(
            title="Other file",
            original_filename="other.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.reader,
            file=SimpleUploadedFile("other.pdf", b"%PDF-other", content_type="application/pdf"),
        )

        self.client.force_login(self.author)
        response = self.client.get(reverse("profile-attachments"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, own_attachment.title)
        self.assertNotContains(response, "Other file")
        self.assertNotContains(response, "Uploader")

    def test_attachment_update_can_change_metadata_without_reupload(self):
        attachment = Attachment.objects.create(
            title="Old title",
            original_filename="old.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("old.pdf", b"%PDF-old", content_type="application/pdf"),
        )

        self.client.force_login(self.author)
        response = self.client.post(
            reverse("profile-attachment-update", kwargs={"pk": attachment.pk}),
            {
                "title": "New title",
                "visibility": "private",
                "condition_rules": "[]",
                "access_scope": "unified",
                "vip_access_permission": "public",
                "vip_condition_rules": "[]",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        attachment.refresh_from_db()
        self.assertEqual(attachment.title, "New title")
        self.assertEqual(attachment.visibility, Attachment.VISIBILITY_PRIVATE)
        self.assertTrue(attachment.original_filename.endswith(".pdf"))

    def test_attachment_update_can_replace_file(self):
        attachment = Attachment.objects.create(
            title="Replace file",
            original_filename="old.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("old.pdf", b"%PDF-old", content_type="application/pdf"),
        )

        self.client.force_login(self.author)
        response = self.client.post(
            reverse("profile-attachment-update", kwargs={"pk": attachment.pk}),
            {
                "title": "Replace file",
                "visibility": "public",
                "condition_rules": "[]",
                "access_scope": "unified",
                "vip_access_permission": "public",
                "vip_condition_rules": "[]",
                "file": SimpleUploadedFile("new.txt", b"hello-new", content_type="text/plain"),
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        attachment.refresh_from_db()
        self.assertEqual(attachment.original_filename, "new.txt")
        self.assertEqual(attachment.file_ext, "txt")
        self.assertEqual(attachment.mime_type, "text/plain")
        self.assertEqual(attachment.file_size, len(b"hello-new"))

    def test_attachment_update_forbidden_for_non_owner(self):
        attachment = Attachment.objects.create(
            title="Protected file",
            original_filename="protected.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("protected.pdf", b"%PDF-protected", content_type="application/pdf"),
        )

        self.client.force_login(self.reader)
        response = self.client.post(
            reverse("profile-attachment-update", kwargs={"pk": attachment.pk}),
            {
                "title": "Nope",
                "visibility": "public",
                "condition_rules": "[]",
                "access_scope": "unified",
                "vip_access_permission": "public",
                "vip_condition_rules": "[]",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 403)
        attachment.refresh_from_db()
        self.assertEqual(attachment.title, "Protected file")

    def test_attachment_delete_removes_record(self):
        attachment = Attachment.objects.create(
            title="Delete me",
            original_filename="delete.pdf",
            mime_type="application/pdf",
            file_size=200,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("delete.pdf", b"%PDF-delete", content_type="application/pdf"),
        )

        self.client.force_login(self.author)
        response = self.client.post(
            reverse("profile-attachment-delete", kwargs={"pk": attachment.pk}),
            {"next": reverse("profile-attachments")},
        )

        self.assertEqual(response.status_code, 302)
        self.assertFalse(Attachment.objects.filter(pk=attachment.pk).exists())


class SiteSettingAttachmentFieldTests(TestCase):
    def test_attachment_size_field_is_saved(self):
        site_setting = SiteSetting.objects.create()
        form = SiteSettingForm(
            data={
                "site_title": "",
                "code_expire_seconds": 600,
                "code_resend_seconds": 60,
                "post_editor_autosave_enabled": "on",
                "post_editor_autosave_interval_minutes": 5,
                "audit_log_cleanup_enabled": "on",
                "audit_log_retention_days": 30,
                "vip_max_level": 0,
                "dashboard_visit_trend_days": SiteSetting.DASHBOARD_VISIT_TREND_DAYS_7,
                "non_admin_max_post_count": 10,
                "non_admin_max_book_count": 3,
                "attachment_max_size_mb": 8,
            },
            instance=site_setting,
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved = form.save()
        self.assertEqual(saved.attachment_max_size_mb, 8)
