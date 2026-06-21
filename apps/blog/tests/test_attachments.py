from tempfile import TemporaryDirectory
from pathlib import Path
from unittest.mock import patch
from urllib.parse import quote

from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.blog.constants import get_default_business_group_name
from apps.blog.forms import AttachmentUploadForm, CommentForm, PostForm, SiteSettingForm
from apps.blog.models import Attachment, Book, Comment, MediaCleanupJob, Post, PostDraft
from apps.blog.utils import DASHBOARD_VISIT_TREND_DAYS_7, build_media_url, resolve_media_path, set_settings
from apps.blog.utils.attachments import build_attachment_placeholder, render_markdown_with_attachments
from apps.users.models import UserProfile


User = get_user_model()


class AttachmentUploadFormTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="author", password="pass12345")
        set_settings({"attachment_max_size_mb": 1})

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
        set_settings({
            "attachment_max_size_mb": 1,
            "vip_max_level": 1,
            "vip_configs": [{"display_name": "VIP 1", "money_discount": 0.10, "points_discount": 0.05}],
            "allow_user_upload_attachment": True,
            "vip_only_upload_attachment": False,
        })
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
            "context": "post",
        }
        payload.update(overrides)
        return self.client.post(reverse("attachment-upload"), payload)

    def test_attachment_upload_returns_placeholder(self):
        set_settings({"allow_user_upload_attachment": True})
        response = self.upload_file(self.author)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["attachment"]["placeholder"].startswith("{{attachment:"))
        self.assertEqual(Attachment.objects.count(), 1)
        attachment = Attachment.objects.get()
        self.assertIn(f"users/{self.author.pk}/", attachment.file.name)
        self.assertIn("/attachment/", attachment.file.name)

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
                "context": "post",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertFalse(payload["ok"])
        self.assertIn("sign in", payload["message"].lower())

    def test_attachment_upload_forbidden_when_user_upload_disabled(self):
        set_settings({"allow_user_upload_attachment": False, "vip_only_upload_attachment": False})
        self.client.force_login(self.author)
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
                "context": "post",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("permission", response.json()["message"].lower())

    def test_attachment_upload_allowed_for_vip_when_vip_only_enabled(self):
        set_settings({"allow_user_upload_attachment": True, "vip_only_upload_attachment": True})
        response = self.upload_file(self.vip_reader)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

    def test_attachment_upload_forbidden_for_non_vip_when_vip_only_enabled(self):
        set_settings({"allow_user_upload_attachment": True, "vip_only_upload_attachment": True})
        response = self.upload_file(self.reader)

        self.assertEqual(response.status_code, 403)
        self.assertIn("permission", response.json()["message"].lower())

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

    def test_attachment_mine_requires_login_for_ajax_requests(self):
        response = self.client.get(reverse("attachment-mine"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertFalse(payload["ok"])
        self.assertIn("sign in", payload["message"].lower())

    def test_attachment_mine_returns_only_current_users_attachments(self):
        set_settings({"allow_user_upload_attachment": True})
        own_attachment = Attachment.objects.create(
            title="Own library",
            original_filename="own-library.pdf",
            mime_type="application/pdf",
            file_size=4096,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("own-library.pdf", b"%PDF-own-library", content_type="application/pdf"),
        )
        Attachment.objects.create(
            title="Reader library",
            original_filename="reader-library.pdf",
            mime_type="application/pdf",
            file_size=2048,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.reader,
            file=SimpleUploadedFile("reader-library.pdf", b"%PDF-reader-library", content_type="application/pdf"),
        )

        self.client.force_login(self.author)
        response = self.client.get(reverse("attachment-mine"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["attachments"]), 1)
        self.assertEqual(payload["attachments"][0]["id"], own_attachment.pk)
        self.assertEqual(payload["attachments"][0]["placeholder"], build_attachment_placeholder(own_attachment.pk))
        self.assertEqual(payload["attachments"][0]["fileSizeLabel"], "4.0 KB")
        self.assertIn("visibilityPresentation", payload["attachments"][0])
        self.assertIn("conditionSummaryItems", payload["attachments"][0])
        self.assertIn("showVipBadge", payload["attachments"][0])

    def test_attachment_mine_filters_by_title_and_file_name(self):
        set_settings({"allow_user_upload_attachment": True})
        Attachment.objects.create(
            title="Design notes",
            original_filename="roadmap.pdf",
            mime_type="application/pdf",
            file_size=500,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("roadmap.pdf", b"%PDF-roadmap", content_type="application/pdf"),
        )
        target_attachment = Attachment.objects.create(
            title="Meeting archive",
            original_filename="sprint-plan.txt",
            mime_type="text/plain",
            file_size=120,
            file_ext="txt",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("sprint-plan.txt", b"plan", content_type="text/plain"),
        )

        self.client.force_login(self.author)
        response = self.client.get(reverse("attachment-mine"), {"q": "sprint"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["attachments"]), 1)
        self.assertEqual(payload["attachments"][0]["id"], target_attachment.pk)

    def test_attachment_mine_forbidden_when_user_upload_disabled(self):
        set_settings({"allow_user_upload_attachment": False, "vip_only_upload_attachment": False})
        self.client.force_login(self.author)
        response = self.client.get(reverse("attachment-mine"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

        self.assertEqual(response.status_code, 403)
        self.assertIn("permission", response.json()["message"].lower())

    def test_attachment_mine_allowed_for_admin_even_when_user_upload_disabled(self):
        self.client.force_login(self.admin)
        response = self.client.get(reverse("attachment-mine"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])


class EditorAttachmentBrowserMetadataTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="editor-attachment-author", password="pass12345")
        self.reader = User.objects.create_user(username="editor-attachment-reader", password="pass12345")
        self.vip_reader = User.objects.create_user(username="editor-attachment-vip", password="pass12345")
        Group.objects.get_or_create(name=get_default_business_group_name())
        self.vip_reader.groups.add(Group.objects.get_or_create(name="vip_1")[0])
        set_settings({
            "vip_max_level": 1,
            "vip_configs": [{"display_name": "VIP 1", "money_discount": 0.10, "points_discount": 0.05}],
            "allow_user_upload_attachment": False,
            "vip_only_upload_attachment": False,
        })

    def test_comment_form_exposes_uploaded_attachment_browser_metadata(self):
        set_settings({"allow_user_upload_attachment": True, "allow_user_comment": True})
        form = CommentForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))
        attrs = form.fields["content"].widget.attrs

        self.assertEqual(attrs["data-attachment-browser-url"], reverse("attachment-mine") + "?context=comment")
        self.assertEqual(str(attrs["data-attachment-insert-uploaded-label"]), "My attachments")
        self.assertEqual(str(attrs["data-attachment-browser-title"]), "My attachments")
        self.assertEqual(str(attrs["data-attachment-browser-kicker"]), "My attachments")

    def test_post_form_exposes_uploaded_attachment_browser_metadata(self):
        set_settings({"allow_user_upload_attachment": True})
        form = PostForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))
        attrs = form.fields["content"].widget.attrs

        self.assertEqual(attrs["data-attachment-browser-url"], reverse("attachment-mine") + "?context=post")
        self.assertEqual(str(attrs["data-attachment-browser-empty-label"]), "No attachments found.")
        self.assertEqual(str(attrs["data-attachment-browser-insert-label"]), "插入")
        self.assertEqual(str(attrs["data-attachment-browser-title-column-label"]), "标题")
        self.assertEqual(str(attrs["data-attachment-browser-access-column-label"]), "访问权限")
        self.assertEqual(str(attrs["data-attachment-browser-updated-column-label"]), "更新时间")
        self.assertEqual(str(attrs["data-attachment-browser-actions-column-label"]), "操作")
        self.assertTrue(str(attrs["data-browser-page-label"]))

    def test_comment_form_hides_attachment_metadata_when_upload_disabled(self):
        form = CommentForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))
        attrs = form.fields["content"].widget.attrs

        self.assertNotIn("data-attachment-upload-url", attrs)
        self.assertNotIn("data-attachment-browser-url", attrs)

    def test_post_form_hides_attachment_metadata_for_non_vip_when_vip_only_enabled(self):
        set_settings({"allow_user_upload_attachment": True, "vip_only_upload_attachment": True})
        form = PostForm(user=self.reader, image_upload_url=reverse("frontend-upload-image"))
        attrs = form.fields["content"].widget.attrs

        self.assertNotIn("data-attachment-upload-url", attrs)
        self.assertNotIn("data-attachment-browser-url", attrs)

    def test_post_form_exposes_attachment_metadata_for_vip_when_vip_only_enabled(self):
        set_settings({"allow_user_upload_attachment": True, "vip_only_upload_attachment": True})
        form = PostForm(user=self.vip_reader, image_upload_url=reverse("frontend-upload-image"))
        attrs = form.fields["content"].widget.attrs

        self.assertEqual(attrs["data-attachment-browser-url"], reverse("attachment-mine") + "?context=post")

    def test_comment_form_uses_frontend_image_upload_url(self):
        set_settings({"allow_user_comment": True})
        form = CommentForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))

        self.assertEqual(form.fields["content"].widget.attrs["data-upload-url"], reverse("frontend-upload-image"))

    def test_comment_form_exposes_image_upload_context_metadata(self):
        set_settings({"allow_user_comment": True})
        form = CommentForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))

        self.assertEqual(form.fields["content"].widget.attrs["data-media-upload-context"], "comment")

    def test_post_form_exposes_image_upload_context_metadata(self):
        form = PostForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))

        self.assertEqual(form.fields["content"].widget.attrs["data-media-upload-context"], "post")

    def test_comment_form_hides_image_upload_url_without_comment_permission(self):
        set_settings({"allow_user_comment": False})
        form = CommentForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))

        self.assertNotIn("data-upload-url", form.fields["content"].widget.attrs)

    def test_post_form_exposes_video_upload_metadata_when_enabled(self):
        set_settings({"allow_user_upload_video": True})
        form = PostForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))
        attrs = form.fields["content"].widget.attrs

        self.assertEqual(attrs["data-video-upload-url"], reverse("frontend-upload-video") + "?context=post")

    def test_comment_form_hides_video_upload_metadata_without_comment_permission(self):
        set_settings({"allow_user_comment": False, "allow_user_upload_video": True})
        form = CommentForm(user=self.author, image_upload_url=reverse("frontend-upload-image"))

        self.assertNotIn("data-video-upload-url", form.fields["content"].widget.attrs)


class FrontendMediaUploadTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="media-author", password="pass12345")
        self.reader = User.objects.create_user(username="media-reader", password="pass12345")
        self.post = Post.objects.create(title="Post", slug="post", content="hello", author=self.author, status=Post.STATUS_PUBLISHED)
        set_settings({"allow_user_comment": True, "allow_user_upload_video": True, "vip_only_upload_video": False})

    def test_frontend_image_upload_succeeds_for_comment_context(self):
        self.client.force_login(self.author)
        response = self.client.post(
            reverse("frontend-upload-image"),
            {
                "context": "comment",
                "image": SimpleUploadedFile("demo.png", b"png-demo", content_type="image/png"),
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], 1)
        self.assertIn(f"/media/users/{self.author.pk}/", response.json()["file"]["url"])
        self.assertIn("/image/", response.json()["file"]["url"])

    def test_frontend_image_upload_forbidden_without_comment_permission(self):
        set_settings({"allow_user_comment": False})
        self.client.force_login(self.author)
        response = self.client.post(
            reverse("frontend-upload-image"),
            {
                "context": "comment",
                "image": SimpleUploadedFile("demo.png", b"png-demo", content_type="image/png"),
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 403)

    def test_frontend_video_upload_succeeds_when_enabled(self):
        self.client.force_login(self.author)
        response = self.client.post(
            reverse("frontend-upload-video"),
            {
                "context": "post",
                "video": SimpleUploadedFile("demo.mp4", b"video-demo", content_type="video/mp4"),
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertIn(f"/media/users/{self.author.pk}/", response.json()["file"]["url"])
        self.assertIn("/video/", response.json()["file"]["url"])

    def test_frontend_video_upload_forbidden_when_disabled(self):
        set_settings({"allow_user_upload_video": False})
        self.client.force_login(self.author)
        response = self.client.post(
            reverse("frontend-upload-video"),
            {
                "context": "post",
                "video": SimpleUploadedFile("demo.mp4", b"video-demo", content_type="video/mp4"),
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 403)

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
                "dashboard_visit_trend_days": DASHBOARD_VISIT_TREND_DAYS_7,
                "non_admin_max_post_count": 10,
                "non_admin_max_book_count": 3,
                "attachment_max_size_mb": 8,
                "video_max_size_mb": 120,
                "allow_user_upload_attachment": "on",
                "vip_only_upload_attachment": "on",
                "allow_user_upload_video": "on",
                "vip_only_upload_video": "on",
                "allow_user_comment": "on",
                "comment_first_reward_money": "1",
                "comment_first_reward_points": "1",
                "article_author_reward_money_ratio": "0.8",
                "article_author_reward_points_ratio": "0",
                "book_author_reward_money_ratio": "0.8",
                "book_author_reward_points_ratio": "0",
                "attachment_author_reward_money_ratio": "0.8",
                "attachment_author_reward_points_ratio": "0",
            },
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved = form.save()
        self.assertEqual(saved["attachment_max_size_mb"], 8)
        self.assertEqual(saved["video_max_size_mb"], 120)
        self.assertTrue(saved["allow_user_upload_attachment"])
        self.assertTrue(saved["vip_only_upload_attachment"])
        self.assertTrue(saved["allow_user_upload_video"])
        self.assertTrue(saved["vip_only_upload_video"])


class UserMediaMigrationCommandTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="administrator", email="admin@example.com", password="pass12345")
        self.author = User.objects.create_user(username="legacy-author", password="pass12345")
        self.other = User.objects.create_user(username="legacy-other", password="pass12345")
        self.profile = UserProfile.objects.get_or_create(user=self.author)[0]

    def test_command_migrates_legacy_media_into_new_structure(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                self.profile.avatar = SimpleUploadedFile("avatar.jpg", b"avatar-bytes", content_type="image/jpeg")
                self.profile.save(update_fields=["avatar"])

                post = Post.objects.create(
                    title="Legacy post",
                    slug="legacy-post",
                    content=f'<img src="{build_media_url("blog/uploads/legacy-post.png")}">',
                    author=self.author,
                    status=Post.STATUS_PUBLISHED,
                )
                post.cover_image = SimpleUploadedFile("cover.png", b"cover-bytes", content_type="image/png")
                post.save(update_fields=["cover_image"])

                draft = PostDraft.objects.create(
                    title="Legacy draft",
                    slug="legacy-draft",
                    content=f'<video src="{build_media_url("blog/videos/legacy-draft.mp4")}"></video>',
                    author=self.author,
                )
                draft.cover_image = SimpleUploadedFile("draft-cover.png", b"draft-cover", content_type="image/png")
                draft.save(update_fields=["cover_image"])

                book = Book.objects.create(name="Legacy book", slug="legacy-book", created_by=self.author)
                book.cover_image = SimpleUploadedFile("book-cover.png", b"book-cover", content_type="image/png")
                book.save(update_fields=["cover_image"])

                attachment = Attachment.objects.create(
                    title="Legacy attachment",
                    uploaded_by=self.other,
                    file=SimpleUploadedFile("legacy.pdf", b"legacy-attachment", content_type="application/pdf"),
                )

                comment = Comment.objects.create(
                    post=post,
                    author=self.author,
                    content=f'<img src="{build_media_url("blog/uploads/comment-image.png")}">',
                )

                for relative_path, payload in {
                    "blog/uploads/legacy-post.png": b"legacy-post-image",
                    "blog/uploads/comment-image.png": b"comment-image",
                    "blog/uploads/unclaimed.png": b"unclaimed-image",
                    "blog/videos/legacy-draft.mp4": b"legacy-video",
                    "blog/videos/unclaimed.mp4": b"unclaimed-video",
                }.items():
                    target_path = resolve_media_path(relative_path)
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    target_path.write_bytes(payload)

                call_command("migrate_user_media")

                self.profile.refresh_from_db()
                post.refresh_from_db()
                draft.refresh_from_db()
                book.refresh_from_db()
                attachment.refresh_from_db()
                comment.refresh_from_db()

                self.assertIn(f"users/{self.author.pk}/avatar/", self.profile.avatar.name)
                self.assertIn(f"users/{self.author.pk}/post-cover/", post.cover_image.name)
                self.assertIn(f"users/{self.author.pk}/post-cover/", draft.cover_image.name)
                self.assertIn(f"users/{self.author.pk}/book-cover/", book.cover_image.name)
                self.assertIn("users/1/attachment/", attachment.file.name)
                self.assertIn("users/1/image/", post.content)
                self.assertIn("users/1/image/", comment.content)
                self.assertIn("users/1/video/", draft.content)
                self.assertFalse(resolve_media_path("blog/uploads/legacy-post.png").exists())
                self.assertFalse(resolve_media_path("blog/videos/legacy-draft.mp4").exists())
                self.assertFalse(resolve_media_path("blog/uploads/unclaimed.png").exists())
                self.assertFalse(resolve_media_path("blog/videos/unclaimed.mp4").exists())


class ManageAttachmentCleanupTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="cleanup-admin", email="cleanup-admin@example.com", password="pass12345")
        self.user = User.objects.create_user(username="cleanup-user", password="pass12345")

    @patch("apps.blog.views.manage.attachments.subprocess.Popen")
    def test_staff_can_start_media_cleanup_job(self, popen_mock):
        self.client.force_login(self.admin)

        response = self.client.post(reverse("manage-attachment-cleanup-start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(MediaCleanupJob.objects.count(), 1)
        job = MediaCleanupJob.objects.get()
        self.assertEqual(job.status, MediaCleanupJob.STATUS_PENDING)
        popen_mock.assert_called_once()
        args = popen_mock.call_args.args[0]
        self.assertIn("cleanup_unused_media", args)
        self.assertIn(str(job.pk), args)

    @patch("apps.blog.views.manage.attachments.subprocess.Popen")
    def test_start_media_cleanup_rejects_when_job_running(self, popen_mock):
        MediaCleanupJob.objects.create(requested_by=self.admin, status=MediaCleanupJob.STATUS_RUNNING)
        self.client.force_login(self.admin)

        response = self.client.post(reverse("manage-attachment-cleanup-start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

        self.assertEqual(response.status_code, 409)
        payload = response.json()
        self.assertFalse(payload["ok"])
        self.assertEqual(MediaCleanupJob.objects.count(), 1)
        popen_mock.assert_not_called()

    def test_cleanup_status_returns_job_payload(self):
        job = MediaCleanupJob.objects.create(
            requested_by=self.admin,
            status=MediaCleanupJob.STATUS_SUCCEEDED,
            scanned_file_count=10,
            kept_file_count=7,
            deleted_file_count=3,
            deleted_directory_count=2,
            referenced_path_count=5,
            result_summary="Scanned 10 files.",
        )
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-attachment-cleanup-status", kwargs={"pk": job.pk}), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["job"]["id"], job.pk)
        self.assertEqual(payload["job"]["deletedFileCount"], 3)
        self.assertTrue(payload["job"]["isFinished"])

    def test_non_staff_cannot_start_media_cleanup(self):
        self.client.force_login(self.user)

        response = self.client.post(reverse("manage-attachment-cleanup-start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

        self.assertEqual(response.status_code, 403)


class CleanupUnusedMediaCommandTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="cleanup-command-admin", email="cleanup-command-admin@example.com", password="pass12345")
        self.author = User.objects.create_user(username="cleanup-command-author", password="pass12345")
        self.profile = UserProfile.objects.get_or_create(user=self.author)[0]

    def test_command_deletes_only_unreferenced_media_files(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root), MEDIA_URL="/media/"):
                attachment = Attachment.objects.create(
                    title="Command attachment",
                    uploaded_by=self.author,
                    file=SimpleUploadedFile("command.pdf", b"attachment", content_type="application/pdf"),
                )
                post = Post.objects.create(
                    title="Cleanup post",
                    slug="cleanup-post",
                    summary=f'<img src="{build_media_url("users/9/image/summary-keep.png")}">',
                    content=f'{build_attachment_placeholder(attachment.pk)} <img src="{build_media_url("users/9/image/content-keep.png")}">',
                    author=self.author,
                    status=Post.STATUS_PUBLISHED,
                )
                post.cover_image = SimpleUploadedFile("cover-keep.png", b"cover", content_type="image/png")
                post.save(update_fields=["cover_image"])
                book = Book.objects.create(
                    name="Cleanup book",
                    slug="cleanup-book",
                    summary=f'<img src="{build_media_url("users/9/image/book-summary-keep.png")}">',
                    created_by=self.author,
                )
                book.cover_image = SimpleUploadedFile("book-cover-keep.png", b"book-cover", content_type="image/png")
                book.save(update_fields=["cover_image"])
                self.profile.avatar = SimpleUploadedFile("avatar-keep.png", b"avatar", content_type="image/png")
                self.profile.save(update_fields=["avatar"])
                Comment.objects.create(
                    post=post,
                    author=self.author,
                    content=f'<video src="{build_media_url("users/9/video/comment-keep.mp4")}"></video>',
                )

                keep_paths = {
                    "users/9/image/summary-keep.png": b"summary",
                    "users/9/image/content-keep.png": b"content",
                    "users/9/image/book-summary-keep.png": b"book-summary",
                    "users/9/video/comment-keep.mp4": b"comment-video",
                }
                delete_paths = {
                    "users/9/image/unused.png": b"unused",
                    "users/9/video/unused.mp4": b"unused-video",
                }
                for relative_path, payload in {**keep_paths, **delete_paths}.items():
                    target_path = resolve_media_path(relative_path)
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    target_path.write_bytes(payload)

                job = MediaCleanupJob.objects.create(requested_by=self.admin)

                call_command("cleanup_unused_media", "--job-id", str(job.pk))

                job.refresh_from_db()
                self.assertEqual(job.status, MediaCleanupJob.STATUS_SUCCEEDED)
                self.assertEqual(job.deleted_file_count, len(delete_paths))
                self.assertGreaterEqual(job.kept_file_count, len(keep_paths))
                for relative_path in keep_paths:
                    self.assertTrue(resolve_media_path(relative_path).exists(), relative_path)
                for relative_path in delete_paths:
                    self.assertFalse(resolve_media_path(relative_path).exists(), relative_path)
                self.assertTrue(resolve_media_path(attachment.file.name).exists())
                self.assertTrue(resolve_media_path(post.cover_image.name).exists())
                self.assertTrue(resolve_media_path(book.cover_image.name).exists())
                self.assertTrue(resolve_media_path(self.profile.avatar.name).exists())

    def test_command_dry_run_keeps_unreferenced_files(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root), MEDIA_URL="/media/"):
                unused_path = resolve_media_path("users/3/image/dry-run-unused.png")
                unused_path.parent.mkdir(parents=True, exist_ok=True)
                unused_path.write_bytes(b"unused")
                job = MediaCleanupJob.objects.create(requested_by=self.admin)

                call_command("cleanup_unused_media", "--job-id", str(job.pk), "--dry-run")

                job.refresh_from_db()
                self.assertEqual(job.status, MediaCleanupJob.STATUS_SUCCEEDED)
                self.assertTrue(unused_path.exists())
                self.assertEqual(job.deleted_file_count, 1)
                self.assertIn("Dry run", job.result_summary)

    def test_command_keeps_files_referenced_by_encoded_media_urls(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root), MEDIA_URL="/media/"):
                image_relative_path = "users/1/image/2025-12-18-04h10m49s_seed52254536_Realistic Photography Style, full-body shot. One A.jpg"
                video_relative_path = "users/2/video/2025-11-08-22h46m15s_seed87557498_可爱的猫猫，手和耳朵悠闲地动.mp4"
                encoded_image_url = "/media/" + quote(image_relative_path, safe="/")
                encoded_video_url = "/media/" + quote(video_relative_path, safe="/")

                post = Post.objects.create(
                    title="Encoded media post",
                    slug="encoded-media-post",
                    content=f'<p><img src="{encoded_image_url}"></p>',
                    author=self.author,
                    status=Post.STATUS_PUBLISHED,
                )
                Comment.objects.create(
                    post=post,
                    author=self.author,
                    content=f'<video src="{encoded_video_url}"></video>',
                )

                image_path = resolve_media_path(image_relative_path)
                image_path.parent.mkdir(parents=True, exist_ok=True)
                image_path.write_bytes(b"encoded-image")
                video_path = resolve_media_path(video_relative_path)
                video_path.parent.mkdir(parents=True, exist_ok=True)
                video_path.write_bytes(b"encoded-video")
                unused_path = resolve_media_path("users/2/video/unused-encoded-check.mp4")
                unused_path.parent.mkdir(parents=True, exist_ok=True)
                unused_path.write_bytes(b"unused-video")

                job = MediaCleanupJob.objects.create(requested_by=self.admin)

                call_command("cleanup_unused_media", "--job-id", str(job.pk))

                job.refresh_from_db()
                self.assertEqual(job.status, MediaCleanupJob.STATUS_SUCCEEDED)
                self.assertTrue(image_path.exists())
                self.assertTrue(video_path.exists())
                self.assertFalse(unused_path.exists())
