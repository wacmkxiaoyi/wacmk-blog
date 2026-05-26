import json
from datetime import datetime, time, timedelta
from io import StringIO

from django.http import QueryDict

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core import mail
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image
import io
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import override

from apps.users.models import EmailVerificationCode

from .forms import BookForm
from .models import AuditLog, Book, BookShareLink, Comment, CommentFeedback, ContentViewLog, Post, PostDraft, PostFeedback, PostShareLink, SiteSetting, Tag
from .utils.markdown import render_markdown


User = get_user_model()

MAIL_SETTINGS = {
    "APP_NAME": "WACMK",
    "EMAIL_HOST": "smtp.example.com",
    "EMAIL_HOST_USER": "noreply@example.com",
    "EMAIL_HOST_PASSWORD": "secret",
    "DEFAULT_FROM_EMAIL": "noreply@example.com",
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    "EMAIL_DELIVERY_READY": True,
}


def build_test_image_file(name="test.png", size=(10, 10), color="blue"):
    buffer = io.BytesIO()
    image = Image.new("RGB", size, color)
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class ManageUserViewTests(TestCase):
    def setUp(self):
        self.normal_group = Group.objects.create(name="normal_user")
        self.vip_group = Group.objects.create(name="vip")
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.user = User.objects.create_user(username="member", email="member@example.com", password="OldPass123!")
        self.user.groups.add(self.normal_group)
        self.client.force_login(self.admin)

    def test_manage_user_form_hides_delete_for_current_user(self):
        response = self.client.get(reverse("manage-user-update", args=[self.admin.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, reverse("manage-user-delete", args=[self.admin.pk]))

    def test_manage_user_form_renders_delete_confirmation_attributes(self):
        response = self.client.get(reverse("manage-user-update", args=[self.user.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-unsaved-guard', html=False)
        self.assertContains(response, 'data-delete-confirm-trigger')
        self.assertContains(response, 'data-delete-confirm-title="删除用户"', html=False)
        self.assertContains(response, 'data-delete-confirm-button="删除"', html=False)

    def test_manage_user_form_renders_soft_avatar_remove_controls_without_delete_confirm(self):
        profile = self.user.profile
        profile.avatar.save("avatar.jpg", ContentFile(b"avatar-file"), save=True)

        response = self.client.get(reverse("manage-user-update", args=[self.user.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="remove_avatar"', html=False)
        self.assertContains(response, 'data-manage-user-avatar-remove', html=False)
        self.assertContains(response, 'data-manage-user-avatar-undo', html=False)
        self.assertNotContains(response, '/avatar/delete/', html=False)
        self.assertContains(response, 'data-delete-confirm-trigger', count=1, html=False)

    def test_manage_user_form_keeps_avatar_undo_hidden_without_existing_avatar(self):
        response = self.client.get(reverse("manage-user-update", args=[self.user.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'class="secondary-button post-cover-undo-button is-hidden" data-manage-user-avatar-undo',
            html=False,
        )

    def test_manage_user_avatar_delete_only_applies_when_user_is_saved(self):
        profile = self.user.profile
        profile.avatar.save("avatar.jpg", ContentFile(b"avatar-file"), save=True)

        response = self.client.post(
            reverse("manage-user-update", args=[self.user.pk]),
            {
                "username": self.user.username,
                "first_name": "Member",
                "email": self.user.email,
                "role_type": "member",
                "is_active": "on",
                "groups": [str(self.normal_group.pk)],
                "remove_avatar": "1",
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-users"))
        profile.refresh_from_db()
        self.assertFalse(profile.avatar)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_USER_UPDATE).exists())

    def test_manage_user_avatar_remains_until_save(self):
        profile = self.user.profile
        profile.avatar.save("avatar.jpg", ContentFile(b"avatar-file"), save=True)

        response = self.client.get(reverse("manage-user-update", args=[self.user.pk]))

        self.assertEqual(response.status_code, 200)
        profile.refresh_from_db()
        self.assertTrue(profile.avatar)

    def test_manage_user_update_does_not_change_username(self):
        response = self.client.post(
            reverse("manage-user-update", args=[self.user.pk]),
            {
                "username": "renamed",
                "first_name": "Member",
                "email": "member@example.com",
                "role_type": "member",
                "is_active": "on",
                "groups": [str(self.normal_group.pk)],
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-users"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "member")

    @override_settings(**MAIL_SETTINGS)
    def test_manage_user_update_sends_email_when_address_changes(self):
        response = self.client.post(
            reverse("manage-user-update", args=[self.user.pk]),
            {
                "username": self.user.username,
                "first_name": "Member",
                "email": "new@example.com",
                "role_type": "member",
                "is_active": "on",
                "groups": [str(self.normal_group.pk)],
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-users"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "new@example.com")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "【WACMK】邮箱地址已更新")
        self.assertIn("new@example.com", mail.outbox[0].to)
        self.assertEqual(len(mail.outbox[0].alternatives), 1)

    def test_manage_user_delete_rejects_current_user(self):
        response = self.client.post(reverse("manage-user-delete", args=[self.admin.pk]), follow=True)

        self.assertRedirects(response, reverse("manage-user-update", args=[self.admin.pk]))
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_manage_user_delete_handles_related_data(self):
        protected_user = User.objects.create_user(username="writer", email="writer@example.com", password="Pass123!Aa")
        Post.objects.create(title="Protected", slug="protected", content="Body", author=protected_user)

        response = self.client.post(reverse("manage-user-delete", args=[protected_user.pk]), follow=True)

        self.assertRedirects(response, reverse("manage-user-update", args=[protected_user.pk]))
        self.assertTrue(User.objects.filter(pk=protected_user.pk).exists())

    def test_manage_user_delete_removes_user(self):
        response = self.client.post(reverse("manage-user-delete", args=[self.user.pk]), follow=True)

        self.assertRedirects(response, reverse("manage-users"))
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())


class ManageSiteSettingViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_login(self.admin)

    def test_manage_site_settings_page_renders(self):
        response = self.client.get(reverse("manage-site-settings"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "基础设置")
        self.assertContains(response, 'href="%s"' % reverse("manage-site-settings"), html=False)
        self.assertContains(response, 'data-unsaved-guard', html=False)
        self.assertContains(response, 'name="site_title"', html=False)
        self.assertContains(response, 'name="site_icon"', html=False)
        self.assertContains(response, 'name="auth_background"', html=False)
        self.assertContains(response, 'name="app_background"', html=False)
        self.assertContains(response, 'name="post_editor_autosave_enabled"', html=False)
        self.assertContains(response, 'name="post_editor_autosave_interval_minutes"', html=False)
        self.assertContains(response, 'name="dashboard_visit_trend_days"', html=False)
        self.assertContains(response, "文章编辑器")
        self.assertContains(response, "Dashboard")

    def test_manage_home_defaults_to_basic_settings(self):
        response = self.client.get(reverse("manage-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "基础设置")
        self.assertContains(response, 'href="%s"' % reverse("manage-site-settings"), html=False)

    def test_manage_site_settings_can_save_empty_values(self):
        response = self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "",
                "post_editor_autosave_enabled": "on",
                "post_editor_autosave_interval_minutes": "5",
                "audit_log_cleanup_enabled": "on",
                "audit_log_retention_days": "30",
                "dashboard_visit_trend_days": str(SiteSetting.DASHBOARD_VISIT_TREND_DAYS_7),
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-site-settings"))
        site_setting = SiteSetting.objects.get()
        self.assertEqual(site_setting.site_title, "")
        self.assertFalse(site_setting.site_icon)
        self.assertFalse(site_setting.auth_background)
        self.assertFalse(site_setting.app_background)
        self.assertTrue(site_setting.post_editor_autosave_enabled)
        self.assertEqual(site_setting.post_editor_autosave_interval_minutes, 5)
        self.assertEqual(site_setting.dashboard_visit_trend_days, SiteSetting.DASHBOARD_VISIT_TREND_DAYS_7)

    def test_manage_site_settings_keeps_undo_buttons_hidden_without_existing_assets(self):
        response = self.client.get(reverse("manage-site-settings"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'class="secondary-button site-settings-undo-button is-hidden" data-site-setting-undo="site_icon"',
            html=False,
        )
        self.assertContains(
            response,
            'class="secondary-button site-settings-undo-button is-hidden" data-site-setting-undo="auth_background"',
            html=False,
        )
        self.assertContains(
            response,
            'class="secondary-button site-settings-undo-button is-hidden" data-site-setting-undo="app_background"',
            html=False,
        )

    def test_manage_site_settings_can_update_title(self):
        response = self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "Acme Portal",
                "post_editor_autosave_interval_minutes": "10",
                "audit_log_retention_days": "45",
                "dashboard_visit_trend_days": str(SiteSetting.DASHBOARD_VISIT_TREND_DAYS_14),
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-site-settings"))
        site_setting = SiteSetting.objects.get()
        self.assertEqual(site_setting.site_title, "Acme Portal")
        self.assertFalse(site_setting.post_editor_autosave_enabled)
        self.assertEqual(site_setting.post_editor_autosave_interval_minutes, 10)
        self.assertEqual(site_setting.dashboard_visit_trend_days, SiteSetting.DASHBOARD_VISIT_TREND_DAYS_14)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_POST_UPDATE).exists())

    def test_manage_site_settings_autosave_defaults_are_created(self):
        self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "Portal",
                "post_editor_autosave_enabled": "on",
                "post_editor_autosave_interval_minutes": "5",
                "audit_log_cleanup_enabled": "on",
                "audit_log_retention_days": "30",
                "dashboard_visit_trend_days": str(SiteSetting.DASHBOARD_VISIT_TREND_DAYS_30),
            },
        )

        site_setting = SiteSetting.objects.get()
        self.assertTrue(site_setting.post_editor_autosave_enabled)
        self.assertEqual(site_setting.post_editor_autosave_interval_minutes, 5)
        self.assertEqual(site_setting.dashboard_visit_trend_days, SiteSetting.DASHBOARD_VISIT_TREND_DAYS_30)

    def test_manage_site_settings_rejects_invalid_autosave_interval(self):
        response = self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "Portal",
                "post_editor_autosave_enabled": "on",
                "post_editor_autosave_interval_minutes": "0",
                "audit_log_cleanup_enabled": "on",
                "audit_log_retention_days": "30",
                "dashboard_visit_trend_days": str(SiteSetting.DASHBOARD_VISIT_TREND_DAYS_7),
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "确保该值大于或等于1。")

    def test_manage_site_settings_can_remove_uploaded_assets(self):
        site_setting = SiteSetting.objects.create(site_title="Acme")
        site_setting.site_icon.save("icon.png", ContentFile(b"icon-file", name="icon.png"), save=True)
        site_setting.auth_background.save("auth.jpg", ContentFile(b"auth-file", name="auth.jpg"), save=True)
        site_setting.app_background.save("app.jpg", ContentFile(b"app-file", name="app.jpg"), save=True)

        icon_response = self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "Acme",
                "remove_site_icon": "1",
                "post_editor_autosave_interval_minutes": "5",
                "audit_log_retention_days": "30",
                "dashboard_visit_trend_days": "7",
            },
            follow=True,
        )
        auth_response = self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "Acme",
                "remove_auth_background": "1",
                "post_editor_autosave_interval_minutes": "5",
                "audit_log_retention_days": "30",
                "dashboard_visit_trend_days": "7",
            },
            follow=True,
        )
        app_response = self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "Acme",
                "remove_app_background": "1",
                "post_editor_autosave_interval_minutes": "5",
                "audit_log_retention_days": "30",
                "dashboard_visit_trend_days": "7",
            },
            follow=True,
        )

        self.assertRedirects(icon_response, reverse("manage-site-settings"))
        self.assertRedirects(auth_response, reverse("manage-site-settings"))
        self.assertRedirects(app_response, reverse("manage-site-settings"))
        site_setting.refresh_from_db()
        self.assertFalse(site_setting.site_icon)
        self.assertFalse(site_setting.auth_background)
        self.assertFalse(site_setting.app_background)

    def test_manage_site_settings_does_not_remove_asset_until_save(self):
        site_setting = SiteSetting.objects.create(site_title="Acme")
        site_setting.site_icon.save("icon.png", ContentFile(b"icon-file", name="icon.png"), save=True)

        response = self.client.get(reverse("manage-site-settings"))

        self.assertEqual(response.status_code, 200)
        site_setting.refresh_from_db()
        self.assertTrue(site_setting.site_icon)

    def test_manage_site_settings_uploaded_file_overrides_pending_remove(self):
        site_setting = SiteSetting.objects.create(site_title="Acme")
        site_setting.site_icon.save("icon.png", ContentFile(b"icon-file", name="icon.png"), save=True)

        response = self.client.post(
            reverse("manage-site-settings"),
            {
                "site_title": "Acme",
                "remove_site_icon": "1",
                "site_icon": build_test_image_file("new-icon.png"),
                "post_editor_autosave_interval_minutes": "5",
                "audit_log_retention_days": "30",
                "dashboard_visit_trend_days": "7",
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-site-settings"))
        site_setting.refresh_from_db()
        self.assertTrue(site_setting.site_icon)
        self.assertIn("new-icon", site_setting.site_icon.name)

    def test_manage_site_settings_uses_default_title_when_empty(self):
        SiteSetting.objects.create(site_title="")
        response = self.client.get(reverse("manage-site-settings"))

        self.assertContains(response, "<title>基础设置 - WACMK</title>", html=True)

    @override_settings(REGISTER_AVAILABLE=True)
    def test_auth_pages_use_custom_auth_background_and_icon(self):
        site_setting = SiteSetting.objects.create(site_title="Portal")
        site_setting.site_icon.save("icon.png", ContentFile(b"icon-file", name="icon.png"), save=True)
        site_setting.auth_background.save("auth.jpg", ContentFile(b"auth-file", name="auth.jpg"), save=True)

        self.client.logout()
        login_response = self.client.get(reverse("login"))
        register_response = self.client.get(reverse("register"))

        self.assertContains(login_response, site_setting.site_icon.url)
        self.assertContains(login_response, site_setting.auth_background.url)
        self.assertContains(register_response, site_setting.auth_background.url)

    def test_authenticated_pages_use_custom_app_background(self):
        site_setting = SiteSetting.objects.create(site_title="Portal")
        site_setting.app_background.save("app.jpg", ContentFile(b"app-file", name="app.jpg"), save=True)

        response = self.client.get(reverse("blog-home"))

        self.assertContains(response, site_setting.app_background.url)


class ManagePostViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="editor",
            email="editor@example.com",
            password="EditorPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.book_a = Book.objects.create(name="Announcements", slug="announcements", created_by=self.admin)
        self.book_b = Book.objects.create(name="Internal", slug="internal", created_by=self.admin)
        self.author = User.objects.create_user(username="post-author", email="post-author@example.com", password="Pass123!Aa", first_name="Author")
        self.post = Post.objects.create(
            title="Shareable Post",
            slug="shareable-post",
            summary="Summary",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
            published_at=timezone.now(),
        )
        self.client.force_login(self.admin)

    def test_manage_post_update_renders_draft_and_publish_buttons(self):
        post = Post.objects.create(
            title="Draftable",
            slug="draftable",
            summary="Summary",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            author=self.admin,
        )

        response = self.client.get(reverse("manage-post-update", args=[post.pk]))

        self.assertContains(response, "Save revision")
        self.assertContains(response, "Publish post")
        self.assertNotContains(response, 'id="id_status"')

    def test_manage_post_create_page_renders_successfully(self):
        response = self.client.get(reverse("manage-post-create"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-post-id="draft-new"', html=False)
        self.assertContains(response, 'data-unsaved-guard', html=False)
        self.assertContains(response, 'data-autosave-enabled="true"', html=False)
        self.assertContains(response, 'data-autosave-interval-ms="500000"', html=False)

    def test_manage_post_create_keeps_cover_undo_hidden_without_existing_cover(self):
        response = self.client.get(reverse("manage-post-create"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'class="secondary-button post-cover-undo-button is-hidden" data-post-cover-undo',
            html=False,
        )

    def test_manage_post_create_page_uses_site_setting_autosave_values(self):
        SiteSetting.objects.create(post_editor_autosave_enabled=False, post_editor_autosave_interval_minutes=9)

        response = self.client.get(reverse("manage-post-create"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-autosave-enabled="false"', html=False)
        self.assertContains(response, 'data-autosave-interval-ms="900000"', html=False)

    def test_manage_post_create_preserves_next_url_in_form(self):
        response = self.client.get(reverse("manage-post-create"), {"next": "/manage/posts/?tab=drafts&q=release&sort=title&dir=asc&page=2"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="next" value="/manage/posts/?tab=drafts&amp;q=release&amp;sort=title&amp;dir=asc&amp;page=2"', html=False)

    def test_manage_post_create_generates_slug_from_title_when_blank(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Fresh Title",
                "slug": "",
                "summary": "Summary",
                "content": "Body",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_PRIVATE,
                "tag_names": "Django, Update",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        post = PostDraft.objects.get(title="Fresh Title")
        self.assertEqual(post.slug, "fresh-title")
        self.assertEqual(post.visibility, Post.VISIBILITY_PRIVATE)
        self.assertEqual(list(post.tags.order_by("name").values_list("name", flat=True)), ["Django", "Update"])
        self.assertEqual(post.books.count(), 0)

    def test_manage_post_create_requires_password_for_encrypted_visibility(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Encrypted Draft",
                "slug": "",
                "summary": "Summary",
                "content": "Body",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_ENCRYPTED,
                "tag_names": "Secret",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Password cannot be empty for encrypted posts.")
        self.assertFalse(PostDraft.objects.filter(title="Encrypted Draft").exists())

    def test_manage_post_create_saves_encrypted_password(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Encrypted Draft",
                "slug": "",
                "summary": "Summary",
                "content": "Body",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_ENCRYPTED,
                "access_password": "Secret123!",
                "tag_names": "Secret",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        draft = PostDraft.objects.get(title="Encrypted Draft")
        self.assertEqual(draft.visibility, Post.VISIBILITY_ENCRYPTED)
        self.assertNotEqual(draft.access_password, "Secret123!")
        self.assertTrue(draft.check_access_password("Secret123!"))

    def test_manage_post_create_publishs_and_deletes_draft_data(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Launch Title",
                "slug": "",
                "summary": "Summary",
                "content": "Body",
                "status": Post.STATUS_PUBLISHED,
                "visibility": Post.VISIBILITY_PUBLIC,
                "tag_names": "Release",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Post.objects.filter(title="Launch Title", status=Post.STATUS_PUBLISHED).exists())
        self.assertFalse(PostDraft.objects.filter(title="Launch Title").exists())

    def test_manage_post_create_draft_redirects_to_drafts_tab_by_default(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Queued Draft",
                "slug": "",
                "summary": "Summary",
                "content": "Body",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_PUBLIC,
            },
            follow=False,
        )

        self.assertRedirects(response, f"{reverse('manage-posts')}?tab=drafts", fetch_redirect_response=False)

    def test_manage_post_create_publish_redirects_to_next_url(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Launch Title Next",
                "slug": "",
                "summary": "Summary",
                "content": "Body",
                "status": Post.STATUS_PUBLISHED,
                "visibility": Post.VISIBILITY_PUBLIC,
                "next": "/manage/posts/?tab=published&q=launch&sort=updated_at&dir=desc&page=3",
            },
            follow=False,
        )

        self.assertRedirects(response, "/manage/posts/?tab=published&q=launch&sort=updated_at&dir=desc&page=3", fetch_redirect_response=False)

    def test_manage_post_cover_delete_removes_cover_and_redirects(self):
        post = Post.objects.create(
            title="Has Cover",
            slug="has-cover",
            content="Body",
            author=self.admin,
            cover_image=SimpleUploadedFile("cover.jpg", b"filecontent", content_type="image/jpeg"),
        )

        response = self.client.post(reverse("manage-post-cover-delete", args=[post.pk]), follow=True)

        self.assertRedirects(response, reverse("manage-post-update", args=[post.pk]))
        post.refresh_from_db()
        self.assertFalse(bool(post.cover_image))
        messages = list(response.context["messages"])
        self.assertTrue(any(str(message) == "Cover image removed successfully." for message in messages))

    def test_manage_post_form_uses_plain_file_input_for_cover(self):
        post = Post.objects.create(
            title="Has Cover Plain Input",
            slug="has-cover-plain-input",
            content="Body",
            author=self.admin,
            cover_image=build_test_image_file("post-cover-plain.png"),
        )

        response = self.client.get(reverse("manage-post-update", args=[post.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="cover_image"', html=False)
        self.assertNotContains(response, 'name="cover_image-clear"', html=False)
        self.assertNotContains(response, "目前:")
        self.assertNotContains(response, "修改:")

    def test_manage_post_form_renders_soft_remove_controls_without_delete_confirm(self):
        post = Post.objects.create(
            title="Has Cover Soft Remove",
            slug="has-cover-soft-remove",
            content="Body",
            author=self.admin,
            cover_image=build_test_image_file("post-cover-soft-remove.png"),
        )

        response = self.client.get(reverse("manage-post-update", args=[post.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-post-cover-remove', html=False)
        self.assertContains(response, 'data-post-cover-undo', html=False)
        self.assertNotContains(response, 'data-delete-confirm-trigger', html=False)

    def test_manage_post_list_renders_delete_confirmation_attributes(self):
        post = Post.objects.create(title="Delete Me", slug="delete-me", content="Body", author=self.admin)

        response = self.client.get(reverse("manage-posts"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("manage-post-delete", args=[post.pk]))
        self.assertContains(response, 'data-delete-confirm-form')
        self.assertContains(response, 'data-delete-confirm-title="Delete post"', html=False)

    def test_manage_post_list_published_tab_shows_browse_button_without_revision_column(self):
        post = Post.objects.create(
            title="Published Browse",
            slug="published-browse",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            published_at=timezone.now(),
            author=self.admin,
        )

        response = self.client.get(reverse("manage-posts"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("blog-detail", args=[post.slug]))
        self.assertContains(response, ">Browse<", html=False)
        self.assertNotContains(response, ">Revision<", html=False)
        self.assertNotContains(response, "Has revision")
        self.assertNotContains(response, "No revision")

    def test_manage_post_list_supports_drafts_tab(self):
        draft = PostDraft.objects.create(title="Draft Entry", slug="draft-entry", content="Body", author=self.admin)

        response = self.client.get(reverse("manage-posts"), {"tab": "drafts"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Drafts / Revisions")
        self.assertContains(response, draft.title)
        self.assertContains(response, reverse("manage-post-draft-update", args=[draft.pk]))

    def test_manage_post_list_drafts_tab_shows_browse_button_for_draft_preview(self):
        draft = PostDraft.objects.create(title="Draft Preview", slug="draft-preview", content="Body", author=self.admin)

        response = self.client.get(reverse("manage-posts"), {"tab": "drafts"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("manage-post-draft-preview", args=[draft.pk]))
        self.assertContains(response, ">Browse<", html=False)

    def test_manage_post_draft_preview_renders_updated_timestamp(self):
        draft = PostDraft.objects.create(
            title="Draft Preview",
            slug="draft-preview-detail",
            summary="Draft summary",
            content="**Draft body**",
            author=self.admin,
        )

        response = self.client.get(reverse("manage-post-draft-preview", args=[draft.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, draft.title)
        self.assertContains(response, "Updated:")
        self.assertContains(response, "Draft summary")
        self.assertNotContains(response, "Generate share link")
        self.assertNotContains(response, "Post comment")

    def test_manage_post_revision_preview_renders_revision_content(self):
        post = Post.objects.create(
            title="Published Source",
            slug="published-source",
            content="Published body",
            status=Post.STATUS_PUBLISHED,
            published_at=timezone.now(),
            author=self.admin,
        )
        draft = PostDraft.objects.create(
            source_post=post,
            title="Revision Preview",
            slug="published-source",
            content="Revision body",
            author=self.admin,
        )

        response = self.client.get(reverse("manage-post-draft-preview", args=[draft.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Revision Preview")
        self.assertContains(response, "Revision body")

    def test_manage_post_draft_preview_requires_staff(self):
        member = User.objects.create_user(username="member-preview", email="member-preview@example.com", password="Pass123!Aa")
        draft = PostDraft.objects.create(title="Private Draft", slug="private-draft", content="Body", author=self.admin)
        self.client.force_login(member)

        response = self.client.get(reverse("manage-post-draft-preview", args=[draft.pk]))

        self.assertEqual(response.status_code, 403)

    def test_manage_post_list_supports_external_links_tab(self):
        post = Post.objects.create(
            title="Public Entry",
            slug="public-entry",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.admin,
        )
        share_link = PostShareLink.objects.create(
            post=post,
            created_by=self.admin,
            token="managesharetoken123",
            expires_at=timezone.now() + timedelta(days=7),
        )

        response = self.client.get(reverse("manage-posts"), {"tab": "external-links"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '?tab=external-links', html=False)
        self.assertContains(response, post.title)
        self.assertContains(response, 'data-share-trigger', html=False)
        self.assertContains(response, reverse("manage-share-link-update", args=[share_link.pk]))
        self.assertContains(response, reverse("manage-share-link-delete", args=[share_link.pk]))
        self.assertNotContains(response, '<th>Author</th>', html=False)
        self.assertNotContains(response, 'target="_blank"', html=False)
        self.assertContains(response, 'data-share-current-url="http://testserver%s"' % reverse("blog-share-detail", args=[share_link.token]), html=False)
        self.assertNotContains(response, 'data-auto-submit-select', html=False)
        self.assertNotIn('>Updated<', response.content.decode('utf-8'))

    def test_manage_share_link_update_changes_expiry(self):
        post = Post.objects.create(
            title="Update Share Link",
            slug="update-share-link",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.admin,
        )
        share_link = PostShareLink.objects.create(
            post=post,
            created_by=self.admin,
            token="updatesharetoken123",
            expires_at=timezone.now() + timedelta(days=1),
        )
        before = timezone.now()

        response = self.client.post(reverse("manage-share-link-update", args=[share_link.pk]), {"expiry": "30d"}, follow=True)

        self.assertRedirects(response, f"{reverse('manage-posts')}?tab=external-links")
        share_link.refresh_from_db()
        self.assertGreaterEqual(share_link.expires_at, before + timedelta(days=29, hours=23))
        messages = list(response.context["messages"])
        self.assertTrue(any("updated successfully" in str(message).lower() or "更新成功" in str(message) for message in messages))

    def test_author_sees_existing_share_link_on_detail_page(self):
        share_link = PostShareLink.objects.create(
            post=self.post,
            created_by=self.author,
            token="existingdetailtoken123",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-detail", args=[self.post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("blog-share-detail", args=[share_link.token]))
        self.assertContains(response, 'data-share-current-url="http://testserver%s"' % reverse("blog-share-detail", args=[share_link.token]), html=False)
        self.assertContains(response, 'data-share-current-expires=', html=False)

    def test_manage_share_link_delete_removes_link(self):
        post = Post.objects.create(
            title="Delete Share Link",
            slug="delete-share-link",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.admin,
        )
        share_link = PostShareLink.objects.create(
            post=post,
            created_by=self.admin,
            token="deletesharetoken123",
            expires_at=timezone.now() + timedelta(days=7),
        )

        response = self.client.post(reverse("manage-share-link-delete", args=[share_link.pk]), follow=True)

        self.assertRedirects(response, f"{reverse('manage-posts')}?tab=external-links")
        self.assertFalse(PostShareLink.objects.filter(pk=share_link.pk).exists())
        messages = list(response.context["messages"])
        self.assertTrue(any("deleted successfully" in str(message).lower() or "删除成功" in str(message) for message in messages))

    def test_manage_posts_default_sort_is_updated_desc(self):
        older = Post.objects.create(title="Older", slug="older", content="Body", author=self.admin)
        newer = Post.objects.create(title="Newer", slug="newer", content="Body", author=self.admin)
        Post.objects.filter(pk=older.pk).update(updated_at=timezone.now() - timedelta(days=1))
        Post.objects.filter(pk=newer.pk).update(updated_at=timezone.now())

        response = self.client.get(reverse("manage-posts"))

        self.assertEqual(response.status_code, 200)
        posts = list(response.context["items"])
        ordered_ids = [post.pk for post in posts if post.pk in {older.pk, newer.pk}]
        self.assertEqual(ordered_ids, [newer.pk, older.pk])
        self.assertEqual(response.context["current_sort"], "updated_at")
        self.assertEqual(response.context["current_sort_direction"], "desc")

    def test_manage_posts_sort_by_author_matches_rendered_value(self):
        author_with_first_name = User.objects.create_user(username="zzz", first_name="Amy", email="amy@example.com", password="Pass123!Aa")
        author_without_first_name = User.objects.create_user(username="bravo", email="bravo@example.com", password="Pass123!Aa")
        post_a = Post.objects.create(title="A", slug="a-post", content="Body", author=author_with_first_name)
        post_b = Post.objects.create(title="B", slug="b-post", content="Body", author=author_without_first_name)

        response = self.client.get(reverse("manage-posts"), {"sort": "author", "dir": "asc"})

        self.assertEqual(response.status_code, 200)
        posts = list(response.context["items"])
        ordered_ids = [post.pk for post in posts if post.pk in {post_a.pk, post_b.pk}]
        self.assertEqual(ordered_ids, [post_a.pk, post_b.pk])
        self.assertEqual(response.context["current_sort"], "author")
        self.assertEqual(response.context["current_sort_direction"], "asc")

    def test_saving_revision_keeps_published_post_unchanged(self):
        post = Post.objects.create(
            title="Published Entry",
            slug="published-entry",
            summary="Old summary",
            content="Old body",
            status=Post.STATUS_PUBLISHED,
            author=self.admin,
        )

        response = self.client.post(
            reverse("manage-post-update", args=[post.pk]),
            {
                "title": "Published Entry Updated",
                "slug": "published-entry",
                "summary": "New summary",
                "content": "New body",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_PUBLIC,
                "tag_names": "Revision",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.title, "Published Entry")
        draft = PostDraft.objects.get(source_post=post)
        self.assertEqual(draft.title, "Published Entry Updated")
        self.assertRedirects(response, f"{reverse('manage-posts')}?tab=drafts", fetch_redirect_response=False)

    def test_saving_revision_redirects_back_to_next_url(self):
        post = Post.objects.create(
            title="Published Entry Next",
            slug="published-entry-next",
            summary="Old summary",
            content="Old body",
            status=Post.STATUS_PUBLISHED,
            author=self.admin,
        )

        response = self.client.post(
            reverse("manage-post-update", args=[post.pk]),
            {
                "title": "Published Entry Updated",
                "slug": "published-entry-next",
                "summary": "New summary",
                "content": "New body",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_PUBLIC,
                "tag_names": "Revision",
                "next": "/manage/posts/?tab=published&q=entry&sort=title&dir=asc&page=2",
            },
            follow=False,
        )

        self.assertRedirects(response, "/manage/posts/?tab=published&q=entry&sort=title&dir=asc&page=2", fetch_redirect_response=False)

    def test_manage_post_import_page_renders_and_preserves_next_url(self):
        post = Post.objects.create(title="Importable", slug="importable", content="Body", status=Post.STATUS_PUBLISHED, author=self.admin)

        response = self.client.get(reverse("manage-post-import"), {"next": "/manage/posts/?tab=published&q=import"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, post.title)
        self.assertContains(response, 'name="next" value="/manage/posts/?tab=published&amp;q=import"', html=False)

    def test_manage_post_import_page_is_paginated(self):
        for index in range(13):
            Post.objects.create(
                title=f"Importable {index}",
                slug=f"importable-{index}",
                content="Body",
                status=Post.STATUS_PUBLISHED,
                author=self.admin,
                published_at=timezone.now() + timedelta(minutes=index),
            )

        response = self.client.get(reverse("manage-post-import"), {"page": 2})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["is_paginated"])
        self.assertEqual(response.context["page_obj"].number, 2)
        self.assertContains(response, "Page: 2 / 2")

    def test_manage_post_import_creates_draft_and_redirects_to_drafts_tab(self):
        post = Post.objects.create(
            title="Import Source",
            slug="import-source",
            summary="Summary",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.admin,
        )
        post.tags.add(Tag.objects.create(name="Imported", slug="imported"))
        post.books.add(self.book_a)

        response = self.client.post(reverse("manage-post-import"), {"source_post_id": post.pk}, follow=False)

        draft = PostDraft.objects.get(title="Import Source (Copy)")
        self.assertRedirects(response, reverse("manage-post-draft-update", args=[draft.pk]), fetch_redirect_response=False)
        self.assertEqual(draft.summary, post.summary)
        self.assertEqual(draft.content, post.content)
        self.assertEqual(list(draft.tags.values_list("name", flat=True)), ["Imported"])
        self.assertEqual(list(draft.books.values_list("name", flat=True)), [self.book_a.name])

    def test_manage_post_import_redirects_to_next_url_when_provided(self):
        post = Post.objects.create(title="Import Source Next", slug="import-source-next", content="Body", status=Post.STATUS_PUBLISHED, author=self.admin)

        response = self.client.post(
            reverse("manage-post-import"),
            {"source_post_id": post.pk, "next": "/manage/posts/?tab=drafts&q=import&sort=updated_at&dir=desc&page=4"},
            follow=False,
        )

        draft = PostDraft.objects.get(title="Import Source Next (Copy)")
        self.assertRedirects(response, f"{reverse('manage-post-draft-update', args=[draft.pk])}?next=%2Fmanage%2Fposts%2F%3Ftab%3Ddrafts%26q%3Dimport%26sort%3Dupdated_at%26dir%3Ddesc%26page%3D4", fetch_redirect_response=False)

    def test_manage_post_import_generates_unique_slug_when_published_copy_slug_exists(self):
        post = Post.objects.create(title="Import Source", slug="import-source", content="Body", status=Post.STATUS_PUBLISHED, author=self.admin)
        Post.objects.create(title="Import Source Copy", slug="import-source-copy", content="Body 2", status=Post.STATUS_PUBLISHED, author=self.admin)

        response = self.client.post(reverse("manage-post-import"), {"source_post_id": post.pk}, follow=False)

        draft = PostDraft.objects.get(title="Import Source (Copy)")
        self.assertRedirects(response, reverse("manage-post-draft-update", args=[draft.pk]), fetch_redirect_response=False)
        self.assertEqual(draft.slug, "import-source-copy-2")

    def test_manage_post_list_renders_import_entry_with_next_url(self):
        response = self.client.get(reverse("manage-posts"), {"tab": "published", "q": "alpha", "sort": "title", "dir": "asc", "page": 2})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("manage-post-import") + "?next=%2Fmanage%2Fposts%2F%3Ftab%3Dpublished%26q%3Dalpha%26sort%3Dtitle%26dir%3Dasc%26page%3D2", html=False)
        self.assertContains(response, reverse("manage-post-import-markdown") + "?next=%2Fmanage%2Fposts%2F%3Ftab%3Dpublished%26q%3Dalpha%26sort%3Dtitle%26dir%3Dasc%26page%3D2", html=False)

    def test_manage_post_markdown_import_page_renders_and_preserves_next_url(self):
        response = self.client.get(reverse("manage-post-import-markdown"), {"next": "/manage/posts/?tab=published&q=import-md"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="next" value="/manage/posts/?tab=published&amp;q=import-md"', html=False)
        self.assertContains(response, 'accept=".md,text/markdown,text/plain"', html=False)

    def test_manage_post_markdown_import_creates_draft_from_front_matter(self):
        markdown_file = SimpleUploadedFile(
            "guide.md",
            b"---\ntitle: Imported Guide\nsummary: Imported summary\nslug: imported-guide\ntags: [Django, Notes]\n---\n# Ignored Heading\n\nMarkdown body.",
            content_type="text/markdown",
        )

        response = self.client.post(reverse("manage-post-import-markdown"), {"markdown_file": markdown_file}, follow=False)

        draft = PostDraft.objects.get(title="Imported Guide")
        self.assertRedirects(response, reverse("manage-post-draft-update", args=[draft.pk]), fetch_redirect_response=False)
        self.assertEqual(draft.summary, "Imported summary")
        self.assertEqual(draft.slug, "imported-guide")
        self.assertEqual(draft.content, "# Ignored Heading\n\nMarkdown body.")
        self.assertEqual(list(draft.tags.values_list("name", flat=True)), ["Django", "Notes"])

    def test_manage_post_markdown_import_uses_heading_and_filename_fallbacks(self):
        heading_file = SimpleUploadedFile(
            "heading-only.md",
            b"# Heading Title\n\nThis is the first paragraph.",
            content_type="text/markdown",
        )

        response = self.client.post(reverse("manage-post-import-markdown"), {"markdown_file": heading_file}, follow=False)

        heading_draft = PostDraft.objects.get(title="Heading Title")
        self.assertRedirects(response, reverse("manage-post-draft-update", args=[heading_draft.pk]), fetch_redirect_response=False)
        self.assertEqual(heading_draft.summary, "This is the first paragraph.")
        self.assertEqual(heading_draft.slug, "heading-title")

        filename_file = SimpleUploadedFile(
            "release_notes.md",
            b"Plain paragraph without heading.",
            content_type="text/markdown",
        )

        filename_response = self.client.post(reverse("manage-post-import-markdown"), {"markdown_file": filename_file}, follow=False)

        filename_draft = PostDraft.objects.get(title="release notes")
        self.assertRedirects(filename_response, reverse("manage-post-draft-update", args=[filename_draft.pk]), fetch_redirect_response=False)
        self.assertEqual(filename_draft.summary, "Plain paragraph without heading.")
        self.assertEqual(filename_draft.slug, "release-notes")

    def test_manage_post_markdown_import_redirects_to_next_url_when_provided(self):
        markdown_file = SimpleUploadedFile(
            "redirect.md",
            b"# Redirect Title\n\nBody",
            content_type="text/markdown",
        )

        response = self.client.post(
            reverse("manage-post-import-markdown"),
            {"markdown_file": markdown_file, "next": "/manage/posts/?tab=drafts&q=import-md&sort=updated_at&dir=desc&page=4"},
            follow=False,
        )

        draft = PostDraft.objects.get(title="Redirect Title")
        self.assertRedirects(response, f"{reverse('manage-post-draft-update', args=[draft.pk])}?next=%2Fmanage%2Fposts%2F%3Ftab%3Ddrafts%26q%3Dimport-md%26sort%3Dupdated_at%26dir%3Ddesc%26page%3D4", fetch_redirect_response=False)

    def test_manage_post_markdown_import_generates_unique_slug(self):
        Post.objects.create(title="Existing", slug="shared-slug", content="Body", status=Post.STATUS_PUBLISHED, author=self.admin)
        markdown_file = SimpleUploadedFile(
            "duplicate.md",
            b"---\nslug: shared-slug\n---\n# New Title\n\nBody",
            content_type="text/markdown",
        )

        response = self.client.post(reverse("manage-post-import-markdown"), {"markdown_file": markdown_file}, follow=False)

        draft = PostDraft.objects.get(title="New Title")
        self.assertRedirects(response, reverse("manage-post-draft-update", args=[draft.pk]), fetch_redirect_response=False)
        self.assertEqual(draft.slug, "shared-slug-2")

    def test_manage_post_markdown_import_rejects_non_md_files(self):
        invalid_file = SimpleUploadedFile("notes.txt", b"# Invalid", content_type="text/plain")

        response = self.client.post(reverse("manage-post-import-markdown"), {"markdown_file": invalid_file}, follow=False)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Only .md files are supported.")
        self.assertEqual(PostDraft.objects.count(), 0)

    def test_manage_post_markdown_import_rejects_non_utf8_files(self):
        invalid_file = SimpleUploadedFile("broken.md", b"\xff\xfe\xfd", content_type="text/markdown")

        response = self.client.post(reverse("manage-post-import-markdown"), {"markdown_file": invalid_file}, follow=False)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "The uploaded file must be a UTF-8 encoded .md file.")
        self.assertEqual(PostDraft.objects.count(), 0)

    def test_publishing_revision_updates_post_and_deletes_draft(self):
        post = Post.objects.create(
            title="Published Entry",
            slug="published-entry-two",
            summary="Old summary",
            content="Old body",
            status=Post.STATUS_PUBLISHED,
            author=self.admin,
            published_at=timezone.now(),
        )
        draft = PostDraft.objects.create(
            source_post=post,
            title="Published Entry Updated",
            slug="published-entry-two",
            summary="New summary",
            content="New body",
            author=self.admin,
        )

        response = self.client.post(
            reverse("manage-post-draft-update", args=[draft.pk]),
            {
                "title": draft.title,
                "slug": draft.slug,
                "summary": draft.summary,
                "content": draft.content,
                "status": Post.STATUS_PUBLISHED,
                "visibility": Post.VISIBILITY_PUBLIC,
                "tag_names": "Revision",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.title, "Published Entry Updated")
        self.assertFalse(PostDraft.objects.filter(pk=draft.pk).exists())

    def test_revision_choice_attributes_render_for_published_post_with_existing_revision(self):
        post = Post.objects.create(
            title="Published Entry",
            slug="published-entry-three",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            author=self.admin,
        )
        draft = PostDraft.objects.create(
            source_post=post,
            title="Published Entry Revision",
            slug="published-entry-three",
            content="Updated body",
            author=self.admin,
        )

        response = self.client.get(reverse("manage-posts"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'js-revision-choice-trigger')
        self.assertContains(response, reverse("manage-post-draft-update", args=[draft.pk]))
        self.assertContains(response, reverse("manage-post-revision-start", args=[post.pk]))

    def test_manage_post_form_renders_visibility_without_books(self):
        response = self.client.get(reverse("manage-post-create"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="visibility"', html=False)
        self.assertContains(response, 'name="access_password"', html=False)
        self.assertContains(response, 'data-post-password-field', html=False)
        self.assertContains(response, 'data-post-visibility-field', html=False)
        self.assertNotContains(response, 'name="books"', html=False)
        self.assertNotContains(response, 'data-post-books-row', html=False)
        self.assertContains(response, "Access permission")
        self.assertContains(response, "Book only")
        self.assertContains(response, "Book-only articles stay hidden from the homepage and search, but become visible inside books.")
        self.assertContains(response, 'data-link-reference-label', html=False)
        self.assertContains(response, 'data-table-title', html=False)
        self.assertContains(response, 'data-image-upload-label', html=False)
        self.assertContains(response, 'data-table-size-title', html=False)
        self.assertContains(response, 'data-table-insert-row-below-label', html=False)
        self.assertContains(response, 'data-table-remove-column-label', html=False)


class ManageBookViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="bookadmin",
            email="bookadmin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.member = User.objects.create_user(username="member", email="member@example.com", password="Pass123!Aa")
        self.book = Book.objects.create(name="Releases", slug="releases", created_by=self.admin)
        self.post = Post.objects.create(
            title="Release Notes",
            slug="release-notes",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.admin,
        )
        self.post.books.add(self.book)

    def test_manage_books_requires_staff(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("manage-books"))

        self.assertEqual(response.status_code, 403)

    def test_manage_books_list_renders_book_actions(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-books"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Releases")
        self.assertContains(response, reverse("manage-book-update", args=[self.book.pk]))
        self.assertContains(response, reverse("manage-book-delete", args=[self.book.pk]))

    def test_manage_book_create_creates_book(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-create"),
            {"name": "Docs", "slug": "", "summary": "Docs summary", "visibility": Book.VISIBILITY_PUBLIC, "structure": "[]"},
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-books"))
        self.assertTrue(Book.objects.filter(name="Docs", slug="docs").exists())

    def test_manage_book_list_preserves_next_url_in_create_and_edit_links(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-books"), {"q": "rel", "sort": "name", "dir": "asc", "page": 1})

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            reverse("manage-book-create") + "?next=/manage/books/%3Fq%3Drel%26sort%3Dname%26dir%3Dasc%26page%3D1",
            html=False,
        )
        self.assertContains(
            response,
            reverse("manage-book-update", args=[self.book.pk]) + "?next=/manage/books/%3Fq%3Drel%26sort%3Dname%26dir%3Dasc%26page%3D1",
            html=False,
        )

    def test_manage_book_create_preserves_next_url_in_form(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-book-create"), {"next": "/manage/books/?q=release&sort=name&dir=asc&page=2"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="next" value="/manage/books/?q=release&amp;sort=name&amp;dir=asc&amp;page=2"', html=False)

    def test_manage_book_create_redirects_back_to_next_url(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-create"),
            {
                "name": "Docs",
                "slug": "",
                "summary": "Docs summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": "[]",
                "next": "/manage/books/?q=release&sort=name&dir=asc&page=2",
            },
            follow=False,
        )

        self.assertRedirects(response, "/manage/books/?q=release&sort=name&dir=asc&page=2", fetch_redirect_response=False)

    def test_manage_book_create_keeps_cover_undo_hidden_without_existing_cover(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-book-create"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'class="secondary-button post-cover-undo-button is-hidden" data-book-cover-undo',
            html=False,
        )

    def test_manage_book_update_lists_only_book_posts(self):
        other_book = Book.objects.create(name="Private", slug="private", created_by=self.admin)
        other_post = Post.objects.create(
            title="Private Notes",
            slug="private-notes",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PRIVATE,
            author=self.admin,
        )
        other_post.books.add(other_book)
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-book-update", args=[self.book.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Release Notes")
        self.assertNotContains(response, "Private Notes")

    def test_manage_book_update_preserves_next_url_in_form(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-book-update", args=[self.book.pk]), {"next": "/manage/books/?q=release&sort=updated_at&dir=desc&page=3"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="next" value="/manage/books/?q=release&amp;sort=updated_at&amp;dir=desc&amp;page=3"', html=False)

    def test_manage_book_update_redirects_back_to_next_url(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": "Updated summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps(self.book.structure),
                "post_selection": [str(self.post.pk)],
                "next": "/manage/books/?q=release&sort=updated_at&dir=desc&page=3",
            },
            follow=False,
        )

        self.assertRedirects(response, "/manage/books/?q=release&sort=updated_at&dir=desc&page=3", fetch_redirect_response=False)

    def test_manage_book_update_without_next_redirects_to_manage_books(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": "Updated summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps(self.book.structure),
                "post_selection": [str(self.post.pk)],
            },
            follow=False,
        )

        self.assertRedirects(response, reverse("manage-books"), fetch_redirect_response=False)

    def test_manage_book_delete_keeps_posts(self):
        self.client.force_login(self.admin)

        response = self.client.post(reverse("manage-book-delete", args=[self.book.pk]), follow=True)

        self.assertRedirects(response, reverse("manage-books"))
        self.assertFalse(Book.objects.filter(pk=self.book.pk).exists())
        self.assertTrue(Post.objects.filter(pk=self.post.pk).exists())

    def test_manage_book_form_uses_plain_file_input_for_cover(self):
        self.client.force_login(self.admin)
        self.book.cover_image = build_test_image_file("book-cover-plain.png")
        self.book.save(update_fields=["cover_image", "updated_at"])

        response = self.client.get(reverse("manage-book-update", args=[self.book.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="cover_image"', html=False)
        self.assertNotContains(response, 'name="cover_image-clear"', html=False)
        self.assertNotContains(response, "目前:")
        self.assertNotContains(response, "修改:")

    def test_manage_book_form_renders_chapter_workbench_without_legacy_sections(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-book-update", args=[self.book.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-book-chapter-workbench', html=False)
        self.assertContains(response, 'data-book-add-posts', html=False)
        self.assertContains(response, 'data-book-add-group', html=False)
        self.assertContains(response, 'data-chapter-title', html=False)
        self.assertContains(response, 'chapter-workbench-tool', html=False)
        self.assertNotContains(response, "Select articles")
        self.assertNotContains(response, "Book structure")
        self.assertNotContains(response, 'book-editor-section', html=False)

    def test_manage_book_form_renders_soft_remove_controls_without_delete_confirm(self):
        self.client.force_login(self.admin)
        self.book.cover_image = build_test_image_file("book-cover-soft-remove.png")
        self.book.save(update_fields=["cover_image", "updated_at"])

        response = self.client.get(reverse("manage-book-update", args=[self.book.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-book-cover-remove', html=False)
        self.assertContains(response, 'data-book-cover-undo', html=False)
        self.assertNotContains(response, 'data-delete-confirm-trigger', html=False)

    def test_manage_book_form_hides_creator_meta_and_renders_inline_share_controls(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-book-update", args=[self.book.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "<label>Creator</label>", html=False)
        self.assertContains(response, 'data-book-share-field', html=False)
        self.assertContains(response, 'data-share-can-generate="true"', html=False)

    def test_manage_book_create_renders_disabled_inline_share_controls_before_save(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("manage-book-create"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-book-share-field', html=False)
        self.assertContains(response, 'data-share-can-generate="false"', html=False)

    def test_manage_book_update_deletes_share_link_when_visibility_becomes_private(self):
        self.client.force_login(self.admin)
        BookShareLink.objects.create(book=self.book, created_by=self.admin, token="bookcleanupsharetoken", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.post(
            reverse("manage-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": self.book.summary,
                "visibility": Book.VISIBILITY_PRIVATE,
                "structure": json.dumps(self.book.structure),
                "post_selection": [str(self.post.pk)],
            },
            follow=False,
        )

        self.assertEqual(response.status_code, 302)
        self.assertFalse(BookShareLink.objects.filter(book=self.book).exists())


class BookViewTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="book-author", email="book-author@example.com", password="Pass123!Aa", first_name="Author")
        self.member = User.objects.create_user(username="book-member", email="book-member@example.com", password="Pass123!Aa", first_name="Member")
        self.admin = User.objects.create_user(
            username="book-admin",
            email="book-admin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.public_post = Post.objects.create(
            title="Book Public",
            slug="book-public",
            content="Public body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.author,
        )
        self.private_post = Post.objects.create(
            title="Book Private",
            slug="book-private",
            content="Private body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PRIVATE,
            published_at=timezone.now(),
            author=self.author,
        )
        self.encrypted_post = Post.objects.create(
            title="Book Encrypted",
            slug="book-encrypted",
            content="Encrypted body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_ENCRYPTED,
            access_password="Secret123!",
            published_at=timezone.now(),
            author=self.author,
        )
        self.book_only_post = Post.objects.create(
            title="Book Only",
            slug="book-only",
            content="Book-only body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_BOOK_ONLY,
            published_at=timezone.now(),
            author=self.author,
        )
        self.post = Post.objects.create(
            title="Book Extra",
            slug="book-extra",
            content="Extra body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.author,
        )
        self.book = Book.objects.create(
            name="Guide",
            slug="guide",
            summary="Guide summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.author,
            structure=[
                {"type": "post", "post_id": self.public_post.pk},
                {
                    "type": "group",
                    "title": "Secrets",
                    "children": [
                        {"type": "post", "post_id": self.book_only_post.pk},
                        {"type": "post", "post_id": self.private_post.pk},
                        {"type": "post", "post_id": self.encrypted_post.pk},
                    ],
                },
            ],
        )
        self.book.posts.set([self.public_post, self.book_only_post, self.private_post, self.encrypted_post])

    def test_header_renders_books_shortcut(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("book-list"))
        self.assertContains(response, 'fa-solid fa-book-open', html=False)

    def test_header_renders_articles_shortcut_between_home_and_books(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("article-list"))
        self.assertContains(response, 'fa-solid fa-file-lines', html=False)
        content = response.content.decode("utf-8")
        self.assertLess(content.index(reverse("blog-home")), content.index(reverse("article-list")))
        self.assertLess(content.index(reverse("article-list")), content.index(reverse("book-list")))

    def test_home_header_replaces_search_with_repo_link(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="nav-home-repo-link"', html=False)
        self.assertContains(response, "https://github.com/wacmkxiaoyi/wacmk-blog")
        self.assertContains(response, "wacmk-blog@wacmkxiaoyi")
        self.assertContains(response, 'fa-brands fa-github', html=False)
        self.assertNotContains(response, 'data-global-search-form', html=False)

    def test_article_pages_use_article_search_form(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("article-list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'action="{}"'.format(reverse("article-list")), html=False)
        self.assertContains(response, 'placeholder="Search articles..."', html=False)

    def test_book_pages_use_book_search_form(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'action="{}"'.format(reverse("book-list")), html=False)
        self.assertContains(response, 'placeholder="搜索图书..."', html=False)

    def test_tag_pages_use_tag_search_form(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-tags"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'action="{}"'.format(reverse("blog-tags")), html=False)
        self.assertContains(response, 'placeholder="Search tags..."', html=False)

    def test_article_list_renders_accessible_posts_for_member(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("article-list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Book Public")
        self.assertContains(response, "Book Encrypted")
        self.assertContains(response, reverse("blog-detail", args=[self.public_post.slug]))
        self.assertContains(response, 'data-encrypted-post-trigger', html=False)
        self.assertNotContains(response, "Book Only")
        self.assertNotContains(response, "Book Private")

    def test_article_list_paginates_visible_posts(self):
        self.client.force_login(self.member)
        base_time = timezone.now()
        for index in range(13):
            Post.objects.create(
                title=f"Paged Post {index}",
                slug=f"paged-post-{index}",
                content="Visible body",
                status=Post.STATUS_PUBLISHED,
                visibility=Post.VISIBILITY_PUBLIC,
                published_at=base_time + timedelta(minutes=index + 1),
                author=self.author,
            )

        response = self.client.get(reverse("article-list"), {"page": 2})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Page: 2 / 2")
        self.assertContains(response, "Paged Post 0")
        self.assertNotContains(response, "Paged Post 12")

    def test_book_list_renders_public_books(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Guide")
        self.assertContains(response, reverse("book-detail", args=[self.book.slug]))
        self.assertNotContains(response, 'class="book-list-card-link"', html=False)
        self.assertContains(response, 'class="book-list-divider"', html=False)
        self.assertContains(response, 'class="book-list-title-main"', html=False)
        self.assertContains(response, 'class="book-list-date"', html=False)
        self.assertContains(response, 'class="book-list-cover-shell"', html=False)
        self.assertNotContains(response, "Author")

    def test_book_detail_shows_public_post_for_member(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-detail", args=[self.book.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Guide")
        self.assertContains(response, "Book Public")
        self.assertContains(response, 'data-book-outline-nav', html=False)
        self.assertContains(response, 'data-post-outline-nav', html=False)
        self.assertContains(response, 'data-post-outline-scope', html=False)
        self.assertContains(response, 'data-post-outline-always-expanded', html=False)
        self.assertContains(response, "Book Only")
        self.assertNotContains(response, "Book Private")
        self.assertContains(response, "Book Encrypted")
        self.assertContains(response, 'data-post-outline-hide-narrow', html=False)
        self.assertNotContains(response, 'book-detail-sidebar', html=False)
        self.assertNotContains(response, "Generate share link")

    def test_book_detail_renders_clickable_colored_tags(self):
        shared_tag = Tag.objects.create(name="GuideTag", slug="guide-tag")
        self.public_post.tags.add(shared_tag)
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-detail", args=[self.book.slug]), {"post": self.public_post.slug})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="soft-tag soft-tag-directory soft-tag-directory-link post-detail-tag-link"', html=False)
        self.assertContains(response, reverse("blog-tag-detail", args=[shared_tag.slug]))
        self.assertContains(response, '--tag-rgb:', html=False)

    def test_book_detail_increments_book_view_count_once_per_cooldown_window(self):
        self.client.force_login(self.member)

        first_response = self.client.get(reverse("book-detail", args=[self.book.slug]))
        second_response = self.client.get(reverse("book-detail", args=[self.book.slug]))

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.book.refresh_from_db()
        self.public_post.refresh_from_db()
        self.assertEqual(self.book.view_count, 1)
        self.assertEqual(self.public_post.view_count, 0)
        self.assertEqual(
            ContentViewLog.objects.filter(content_type=ContentViewLog.CONTENT_TYPE_BOOK, object_id=self.book.pk).count(),
            1,
        )

    def test_book_detail_does_not_count_locked_encrypted_book_visit(self):
        self.book.visibility = Book.VISIBILITY_ENCRYPTED
        self.book.access_password = "BookSecret123!"
        self.book.save()
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-detail", args=[self.book.slug]))

        self.assertEqual(response.status_code, 200)
        self.book.refresh_from_db()
        self.assertEqual(self.book.view_count, 0)
        self.assertFalse(ContentViewLog.objects.filter(content_type=ContentViewLog.CONTENT_TYPE_BOOK, object_id=self.book.pk).exists())

    def test_book_share_detail_shows_book_only_posts(self):
        share_link = BookShareLink.objects.create(book=self.book, created_by=self.author, token="booksharebookonly123", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.get(reverse("book-share-detail", args=[share_link.token]), {"post": self.book_only_post.slug})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Book Only")
        self.assertContains(response, "Book-only body")
        self.assertContains(response, "fa-solid fa-book-open-reader", html=False)

    def test_book_detail_hides_private_and_encrypted_posts_for_share_visitors(self):
        share_link = BookShareLink.objects.create(book=self.book, created_by=self.author, token="booksharetoken123", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.get(reverse("book-share-detail", args=[share_link.token]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Book Public")
        self.assertContains(response, "Book Only")
        self.assertNotContains(response, "Book Private")
        self.assertNotContains(response, "Book Encrypted")
        self.assertNotContains(response, reverse("comment-create", args=[self.public_post.slug]))

    def test_book_share_detail_renders_non_clickable_colored_tags(self):
        shared_tag = Tag.objects.create(name="ShareTag", slug="share-tag")
        self.public_post.tags.add(shared_tag)
        share_link = BookShareLink.objects.create(book=self.book, created_by=self.author, token="booksharetagtoken123", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.get(reverse("book-share-detail", args=[share_link.token]), {"post": self.public_post.slug})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="soft-tag soft-tag-directory post-detail-tag-link"', html=False)
        self.assertContains(response, '--tag-rgb:', html=False)
        self.assertNotContains(response, reverse("blog-tag-detail", args=[shared_tag.slug]))

    def test_book_share_detail_rewrites_same_book_public_internal_links(self):
        linked_post = Post.objects.create(
            title="Linked Public",
            slug="linked-public",
            content="Target body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.author,
        )
        self.public_post.content = "Go [there](/blog/linked-public/)."
        self.public_post.save(update_fields=["content"])
        self.book.structure.append({"type": "post", "post_id": linked_post.pk})
        self.book.save(update_fields=["structure"])
        self.book.posts.add(linked_post)
        share_link = BookShareLink.objects.create(book=self.book, created_by=self.author, token="booksharepubliclink123", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.get(reverse("book-share-detail", args=[share_link.token]), {"post": self.public_post.slug})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'{reverse("book-share-detail", args=[share_link.token])}?post={linked_post.slug}', html=False)
        self.assertNotContains(response, 'href="/blog/linked-public/"', html=False)

    def test_book_share_detail_rewrites_same_book_book_only_internal_links(self):
        self.public_post.content = "Go [there](/blog/book-only/)."
        self.public_post.save(update_fields=["content"])
        share_link = BookShareLink.objects.create(book=self.book, created_by=self.author, token="booksharebookonlylink123", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.get(reverse("book-share-detail", args=[share_link.token]), {"post": self.public_post.slug})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'{reverse("book-share-detail", args=[share_link.token])}?post={self.book_only_post.slug}', html=False)
        self.assertNotContains(response, 'href="/blog/book-only/"', html=False)

    def test_book_share_detail_keeps_external_book_links_for_posts_outside_book(self):
        self.public_post.content = "Go [outside](/blog/book-extra/)."
        self.public_post.save(update_fields=["content"])
        share_link = BookShareLink.objects.create(book=self.book, created_by=self.author, token="bookshareoutside123", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.get(reverse("book-share-detail", args=[share_link.token]), {"post": self.public_post.slug})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'href="/blog/book-extra/"', html=False)

    def test_private_book_is_visible_to_creator(self):
        self.book.visibility = Book.VISIBILITY_PRIVATE
        self.book.save(update_fields=["visibility"])
        self.client.force_login(self.author)

        response = self.client.get(reverse("book-detail", args=[self.book.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Guide")

    def test_private_book_is_hidden_from_other_members(self):
        self.book.visibility = Book.VISIBILITY_PRIVATE
        self.book.save(update_fields=["visibility"])
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-detail", args=[self.book.slug]))

        self.assertEqual(response.status_code, 404)

    def test_encrypted_book_prompts_for_password(self):
        self.book.visibility = Book.VISIBILITY_ENCRYPTED
        self.book.access_password = "BookSecret123!"
        self.book.save()
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-detail", args=[self.book.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-encrypted-post-modal', html=False)
        self.assertNotContains(response, "Public body")

    def test_book_creator_can_generate_share_link(self):
        self.client.force_login(self.author)

        response = self.client.post(reverse("book-share-create", args=[self.book.slug]), {"expiry": "7d"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertIn(reverse("book-share-detail", args=[BookShareLink.objects.get().token]), payload["url"])

    def test_non_creator_cannot_generate_book_share_link(self):
        self.client.force_login(self.member)

        response = self.client.post(reverse("book-share-create", args=[self.book.slug]), {"expiry": "7d"})

        self.assertEqual(response.status_code, 403)
        self.assertFalse(BookShareLink.objects.exists())

    def test_manage_book_create_assigns_creator_and_structure(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-create"),
            {
                "name": "Docs",
                "slug": "",
                "summary": "Docs summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps([{"type": "post", "post_id": self.public_post.pk}]),
                "post_selection": [str(self.public_post.pk)],
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-books"))
        created_book = Book.objects.get(name="Docs")
        self.assertEqual(created_book.created_by, self.admin)
        self.assertEqual(created_book.posts.count(), 1)

    def test_manage_book_create_accepts_comma_separated_post_selection(self):
        self.client.force_login(self.admin)

        data = QueryDict("", mutable=True)
        data.update(
            {
                "name": "Reference",
                "slug": "",
                "summary": "Reference summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps([
                    {"type": "post", "post_id": self.public_post.pk},
                    {"type": "post", "post_id": self.post.pk},
                ]),
            }
        )
        data.setlist("post_selection", ["{},{}".format(self.public_post.pk, self.post.pk)])

        response = self.client.post(reverse("manage-book-create"), data, follow=True)

        self.assertRedirects(response, reverse("manage-books"))
        created_book = Book.objects.get(name="Reference")
        self.assertCountEqual(
            list(created_book.posts.values_list("pk", flat=True)),
            [self.public_post.pk, self.post.pk],
        )
        self.assertEqual(
            created_book.structure,
            [
                {"type": "post", "post_id": self.public_post.pk},
                {"type": "post", "post_id": self.post.pk},
            ],
        )

    def test_manage_book_create_accepts_multiple_post_selection_values(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-create"),
            {
                "name": "Structured Docs",
                "slug": "",
                "summary": "Structured summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps(
                    [
                        {"type": "post", "post_id": self.public_post.pk},
                        {
                            "type": "group",
                            "title": "Secrets",
                            "children": [
                                {"type": "post", "post_id": self.private_post.pk},
                                {"type": "post", "post_id": self.encrypted_post.pk},
                            ],
                        },
                    ]
                ),
                "post_selection": [str(self.public_post.pk), str(self.private_post.pk), str(self.encrypted_post.pk)],
            },
            follow=True,
        )

        self.assertRedirects(response, reverse("manage-books"))
        created_book = Book.objects.get(name="Structured Docs")
        self.assertCountEqual(
            list(created_book.posts.values_list("pk", flat=True)),
            [self.public_post.pk, self.private_post.pk, self.encrypted_post.pk],
        )
        self.assertEqual(
            created_book.structure,
            [
                {"type": "post", "post_id": self.public_post.pk},
                {
                    "type": "group",
                    "title": "Secrets",
                    "children": [
                        {"type": "post", "post_id": self.private_post.pk},
                        {"type": "post", "post_id": self.encrypted_post.pk},
                    ],
                },
            ],
        )

    def test_book_form_clean_matches_structure_against_post_primary_keys(self):
        data = QueryDict("", mutable=True)
        data.update(
            {
                "name": "Structured Docs",
                "slug": "structured-docs",
                "summary": "Structured summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps(
                    [
                        {"type": "post", "post_id": self.public_post.pk},
                        {
                            "type": "group",
                            "title": "Secrets",
                            "children": [
                                {"type": "post", "post_id": self.private_post.pk},
                                {"type": "post", "post_id": self.encrypted_post.pk},
                            ],
                        },
                    ]
                ),
            }
        )
        data.setlist("post_selection", [str(self.public_post.pk), str(self.private_post.pk), str(self.encrypted_post.pk)])
        form = BookForm(
            data=data
        )

        self.assertTrue(form.is_valid(), form.errors.as_json())

    def test_manage_book_update_saves_structure(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": "Updated summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps([{"type": "post", "post_id": self.public_post.pk}]),
                "post_selection": [str(self.public_post.pk)],
            },
            follow=False,
        )

        self.assertRedirects(response, reverse("manage-book-update", args=[self.book.pk]), fetch_redirect_response=False)
        self.book.refresh_from_db()
        self.assertEqual(self.book.summary, "Updated summary")
        self.assertEqual(self.book.structure, [{"type": "post", "post_id": self.public_post.pk}])

    def test_manage_book_update_editor_preserves_saved_empty_groups(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("manage-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": self.book.summary,
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps(
                    [
                        {"type": "post", "post_id": self.public_post.pk},
                        {"type": "group", "title": "Empty group", "children": []},
                    ]
                ),
                "post_selection": [str(self.public_post.pk)],
            },
            follow=False,
        )

        self.assertRedirects(response, reverse("manage-book-update", args=[self.book.pk]), fetch_redirect_response=False)
        self.book.refresh_from_db()
        self.assertEqual(
            self.book.structure,
            [
                {"type": "post", "post_id": self.public_post.pk},
                {"type": "group", "title": "Empty group", "children": []},
            ],
        )

        edit_response = self.client.get(reverse("manage-book-update", args=[self.book.pk]))

        self.assertEqual(edit_response.status_code, 200)
        self.assertContains(edit_response, 'value="[{&quot;type&quot;: &quot;post&quot;, &quot;post_id&quot;: ')
        self.assertContains(edit_response, '&quot;title&quot;: &quot;Empty group&quot;')
        self.assertContains(edit_response, 'id="book-structure-data"')
        self.assertContains(edit_response, 'type="application/json"')
        self.assertContains(edit_response, '\u0022title\u0022: \u0022Empty group\u0022')
        self.assertContains(edit_response, '\u0022children\u0022: []')
        self.assertContains(edit_response, 'Empty group')

    def test_manage_book_update_accepts_comma_separated_post_selection(self):
        self.client.force_login(self.admin)

        data = QueryDict("", mutable=True)
        data.update(
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": "Updated summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "structure": json.dumps([
                    {"type": "post", "post_id": self.public_post.pk},
                    {"type": "post", "post_id": self.post.pk},
                ]),
            }
        )
        data.setlist("post_selection", ["{},{}".format(self.public_post.pk, self.post.pk)])

        response = self.client.post(reverse("manage-book-update", args=[self.book.pk]), data, follow=False)

        self.assertRedirects(response, reverse("manage-book-update", args=[self.book.pk]), fetch_redirect_response=False)
        self.book.refresh_from_db()
        self.assertCountEqual(
            list(self.book.posts.values_list("pk", flat=True)),
            [self.public_post.pk, self.post.pk],
        )
        self.assertEqual(
            self.book.structure,
            [
                {"type": "post", "post_id": self.public_post.pk},
                {"type": "post", "post_id": self.post.pk},
            ],
        )


class PostVisibilityViewTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="author", email="author@example.com", password="Pass123!Aa")
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="AdminPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.member = User.objects.create_user(username="member", email="member@example.com", password="Pass123!Aa")
        self.public_post = Post.objects.create(
            title="Visible Post",
            slug="visible-post",
            content="Body",
            summary="Open summary",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.author,
        )
        self.private_post = Post.objects.create(
            title="Hidden Post",
            slug="hidden-post",
            content="Body",
            summary="Secret summary",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PRIVATE,
            published_at=timezone.now(),
            author=self.author,
        )
        self.encrypted_post = Post.objects.create(
            title="Encrypted Post",
            slug="encrypted-post",
            content="Encrypted body",
            summary="Encrypted summary",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_ENCRYPTED,
            access_password="Secret123!",
            published_at=timezone.now(),
            author=self.author,
        )
        self.book_only_post = Post.objects.create(
            title="Book Only Post",
            slug="book-only-post",
            content="Book-only content",
            summary="Book-only summary",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_BOOK_ONLY,
            published_at=timezone.now(),
            author=self.author,
        )
        self.shared_tag = Tag.objects.create(name="Updates", slug="updates")
        self.member_only_tag = Tag.objects.create(name="Internal", slug="internal")
        self.book_only_tag = Tag.objects.create(name="Handbook", slug="handbook")
        self.public_post.tags.add(self.shared_tag)
        self.private_post.tags.add(self.shared_tag, self.member_only_tag)
        self.encrypted_post.tags.add(self.shared_tag)
        self.book_only_post.tags.add(self.book_only_tag)

    def test_blog_detail_increments_post_view_count_once_per_cooldown_window(self):
        self.client.force_login(self.member)

        first_response = self.client.get(reverse("blog-detail", args=[self.public_post.slug]))
        second_response = self.client.get(reverse("blog-detail", args=[self.public_post.slug]))

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.public_post.refresh_from_db()
        self.assertEqual(self.public_post.view_count, 1)
        self.assertEqual(
            ContentViewLog.objects.filter(content_type=ContentViewLog.CONTENT_TYPE_POST, object_id=self.public_post.pk).count(),
            1,
        )

    def test_encrypted_post_does_not_count_until_unlocked(self):
        self.client.force_login(self.member)

        locked_response = self.client.get(reverse("blog-detail", args=[self.encrypted_post.slug]))

        self.assertEqual(locked_response.status_code, 200)
        self.encrypted_post.refresh_from_db()
        self.assertEqual(self.encrypted_post.view_count, 0)
        self.assertFalse(ContentViewLog.objects.filter(content_type=ContentViewLog.CONTENT_TYPE_POST, object_id=self.encrypted_post.pk).exists())

        self.client.post(
            reverse("blog-detail", args=[self.encrypted_post.slug]),
            {"password": "Secret123!"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        unlocked_response = self.client.get(reverse("blog-detail", args=[self.encrypted_post.slug]))

        self.assertEqual(unlocked_response.status_code, 200)
        self.encrypted_post.refresh_from_db()
        self.assertEqual(self.encrypted_post.view_count, 1)

    def test_home_dashboard_renders_visit_trend_and_last_week_visit_stats(self):
        self.client.force_login(self.member)
        SiteSetting.objects.create(dashboard_visit_trend_days=SiteSetting.DASHBOARD_VISIT_TREND_DAYS_7)
        ContentViewLog.objects.create(
            content_type=ContentViewLog.CONTENT_TYPE_POST,
            object_id=self.public_post.pk,
            user=self.member,
            session_key="dashboard-post",
            viewed_at=timezone.now() - timedelta(days=1),
        )
        ContentViewLog.objects.create(
            content_type=ContentViewLog.CONTENT_TYPE_BOOK,
            object_id=999,
            user=self.member,
            session_key="dashboard-book",
            viewed_at=timezone.now() - timedelta(days=2),
        )

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Article views in the last 7 days")
        self.assertContains(response, "Book views in the last 7 days")
        self.assertContains(response, "Visits in the last 7 days")
        self.assertContains(response, 'trend-bar trend-bar-article', html=False)
        self.assertContains(response, 'trend-bar trend-bar-book', html=False)
        self.assertContains(response, 'style="--trend-columns: 7;"', html=False)
        self.assertEqual(response.context["stats"]["article_views_last_7_days"], 1)
        self.assertEqual(response.context["stats"]["book_views_last_7_days"], 1)
        self.assertEqual(response.context["visit_trend_days"], 7)
        self.assertEqual(len(response.context["visit_trend"]), 7)

    def test_home_dashboard_uses_site_setting_trend_range(self):
        self.client.force_login(self.member)
        SiteSetting.objects.create(dashboard_visit_trend_days=SiteSetting.DASHBOARD_VISIT_TREND_DAYS_14)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Visits in the last 14 days")
        self.assertContains(response, 'style="--trend-columns: 14;"', html=False)
        self.assertEqual(response.context["visit_trend_days"], 14)
        self.assertEqual(len(response.context["visit_trend"]), 14)

    def test_member_home_hides_private_posts(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Visible Post")
        self.assertContains(response, "Encrypted Post")
        self.assertNotContains(response, "Hidden Post")
        self.assertNotContains(response, "Book Only Post")

    def test_member_detail_blocks_private_posts(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-detail", args=[self.private_post.slug]))

        self.assertEqual(response.status_code, 404)

    def test_member_detail_blocks_book_only_posts(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-detail", args=[self.book_only_post.slug]))

        self.assertEqual(response.status_code, 404)

    def test_admin_detail_can_view_private_posts(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("blog-detail", args=[self.private_post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Hidden Post")
        self.assertContains(response, "私密")

    def test_member_search_excludes_private_posts(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-search"), {"q": "Post"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Visible Post")
        self.assertContains(response, "Encrypted Post")
        self.assertNotContains(response, "Hidden Post")
        self.assertNotContains(response, "Book Only Post")

    def test_member_detail_prompts_for_encrypted_post_password(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-detail", args=[self.encrypted_post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-encrypted-post-modal', html=False)
        self.assertNotContains(response, "Encrypted body")

    def test_member_can_unlock_encrypted_post(self):
        self.client.force_login(self.member)

        response = self.client.post(
            reverse("blog-detail", args=[self.encrypted_post.slug]),
            {"password": "Secret123!"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ok"], True)
        self.assertEqual(response.json()["redirect_url"], self.encrypted_post.get_absolute_url())

        page_response = self.client.get(reverse("blog-detail", args=[self.encrypted_post.slug]))
        self.assertEqual(page_response.status_code, 200)
        self.assertContains(page_response, "Encrypted body")

    def test_member_unlock_with_wrong_password_shows_error(self):
        self.client.force_login(self.member)

        response = self.client.post(
            reverse("blog-detail", args=[self.encrypted_post.slug]),
            {"password": "Wrong123!"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["ok"], False)
        self.assertEqual(response.json()["message"], "Incorrect password.")

    def test_author_can_view_own_encrypted_post_without_password(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-detail", args=[self.encrypted_post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Encrypted body")

    def test_admin_can_view_encrypted_post_without_password(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("blog-detail", args=[self.encrypted_post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Encrypted body")
        self.assertContains(response, "加密")

    def test_author_home_does_not_render_encrypted_prompt_for_own_post(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, f'data-encrypted-post-url="{self.encrypted_post.get_absolute_url()}"', html=False)

    def test_admin_home_does_not_render_encrypted_prompt_for_post(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, f'data-encrypted-post-url="{self.encrypted_post.get_absolute_url()}"', html=False)

    def test_member_search_renders_encrypted_prompt_for_post(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-search"), {"q": "Encrypted"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'data-encrypted-post-url="{self.encrypted_post.get_absolute_url()}"', html=False)

    def test_member_home_renders_encrypted_post_modal_trigger(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-encrypted-post-trigger', html=False)
        self.assertContains(response, f'data-encrypted-post-url="{self.encrypted_post.get_absolute_url()}"', html=False)

    def test_home_header_renders_tags_shortcut(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("blog-tags"))
        self.assertContains(response, 'fa-solid fa-tags', html=False)

    def test_member_tags_page_hides_private_only_tags_and_counts_visible_posts(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-tags"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "#Updates")
        self.assertNotContains(response, "#Internal")
        self.assertNotContains(response, "#Handbook")
        self.assertContains(response, reverse("blog-tag-detail", args=[self.shared_tag.slug]))
        self.assertContains(response, "--tag-rgb:", html=False)
        self.assertNotContains(response, "View tag posts")

    def test_author_tags_page_includes_private_tags_on_own_posts(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-tags"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "#Updates")
        self.assertContains(response, "#Internal")
        self.assertContains(response, "#Handbook")

    def test_member_tag_detail_shows_only_visible_posts_for_tag(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-tag-detail", args=[self.shared_tag.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "#Updates")
        self.assertContains(response, "Visible Post")
        self.assertNotContains(response, "Hidden Post")
        self.assertContains(response, 'class="soft-tag soft-tag-directory soft-tag-directory-link post-card-tag-link"', html=False)
        self.assertContains(response, reverse("blog-tag-detail", args=[self.shared_tag.slug]))

    def test_home_post_card_links_tags_and_limits_overlay_to_content_panel(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="post-card-link-overlay', html=False)
        self.assertContains(response, 'class="soft-tag soft-tag-directory soft-tag-directory-link post-card-tag-link"', html=False)
        self.assertContains(response, '--tag-rgb:', html=False)
        self.assertContains(response, reverse("blog-tag-detail", args=[self.shared_tag.slug]))

    def test_detail_page_renders_clickable_colored_tags(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-detail", args=[self.public_post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="soft-tag soft-tag-directory soft-tag-directory-link post-detail-tag-link"', html=False)
        self.assertContains(response, reverse("blog-tag-detail", args=[self.shared_tag.slug]))
        self.assertContains(response, '--tag-rgb:', html=False)

    def test_member_tag_detail_blocks_private_only_tag(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-tag-detail", args=[self.member_only_tag.slug]))

        self.assertEqual(response.status_code, 404)

    def test_author_tag_detail_includes_own_private_post(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-tag-detail", args=[self.shared_tag.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Visible Post")
        self.assertContains(response, "Hidden Post")

    def test_member_search_matches_book_name(self):
        book = Book.objects.create(name="Operations", slug="operations", created_by=self.author)
        self.public_post.books.add(book)

        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-search"), {"q": "Operations"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Visible Post")
        self.assertNotContains(response, "Hidden Post")

    def test_article_list_search_filters_articles_without_author_match(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("article-list"), {"q": self.author.username})

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Visible Post")
        self.assertEqual(response.context["query"], self.author.username)

    def test_article_list_search_matches_article_content_and_keeps_pagination_query(self):
        self.client.force_login(self.member)
        base_time = timezone.now()
        for index in range(13):
            Post.objects.create(
                title=f"Guide Match {index}",
                slug=f"guide-match-{index}",
                content="Guide-specific body",
                status=Post.STATUS_PUBLISHED,
                visibility=Post.VISIBILITY_PUBLIC,
                published_at=base_time + timedelta(minutes=index + 1),
                author=self.author,
            )

        response = self.client.get(reverse("article-list"), {"q": "Guide", "page": 2})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Page: 2 / 2")
        self.assertContains(response, "?q=Guide&amp;page=1", html=False)
        self.assertEqual(response.context["pagination_query"], "q=Guide")

    def test_book_list_search_filters_books_on_current_page(self):
        Book.objects.create(name="Operations Manual", slug="operations-manual", summary="Runbooks", created_by=self.author)
        Book.objects.create(name="Reading Notes", slug="reading-notes", summary="Bookshelf", created_by=self.author)
        self.client.force_login(self.member)

        response = self.client.get(reverse("book-list"), {"q": "Operations"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Operations Manual")
        self.assertNotContains(response, "Reading Notes")
        self.assertEqual(response.context["pagination_query"], "q=Operations")

    def test_tag_list_search_filters_tags_on_current_page(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-tags"), {"q": "Hand"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "#Handbook")
        self.assertNotContains(response, "#Updates")
        self.assertNotContains(response, "#Internal")

    def test_author_can_view_own_private_post(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-detail", args=[self.private_post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Hidden Post")

    def test_author_home_includes_own_private_post(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Visible Post")
        self.assertContains(response, "Hidden Post")
        self.assertContains(response, "Encrypted Post")
        self.assertContains(response, "Book Only Post")


class ManageAuditViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="auditor",
            email="auditor@example.com",
            password="AuditPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_login(self.admin)

    def test_manage_audit_default_sort_is_time_desc(self):
        older = AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message="older", user=self.admin)
        newer = AuditLog.objects.create(action=AuditLog.ACTION_LOGOUT, message="newer", user=self.admin)
        AuditLog.objects.filter(pk=older.pk).update(created_at=timezone.now() - timedelta(days=1))
        AuditLog.objects.filter(pk=newer.pk).update(created_at=timezone.now())

        response = self.client.get(reverse("manage-audit"))

        self.assertEqual(response.status_code, 200)
        logs = list(response.context["logs"])
        ordered_ids = [log.pk for log in logs if log.pk in {older.pk, newer.pk}]
        self.assertEqual(ordered_ids, [newer.pk, older.pk])
        self.assertEqual(response.context["current_sort"], "time")
        self.assertEqual(response.context["current_sort_direction"], "desc")

    def test_manage_audit_sort_by_user_matches_rendered_value_and_handles_anonymous(self):
        named_user = User.objects.create_user(username="zulu", first_name="Alice", email="alice@example.com", password="Pass123!Aa")
        username_only_user = User.objects.create_user(username="bravo", email="bravo2@example.com", password="Pass123!Aa")
        named_log = AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message="named", user=named_user)
        username_log = AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message="username", user=username_only_user)
        anonymous_log = AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message="anonymous")

        response = self.client.get(reverse("manage-audit"), {"sort": "user", "dir": "asc"})

        self.assertEqual(response.status_code, 200)
        logs = list(response.context["logs"])
        ordered_ids = [log.pk for log in logs if log.pk in {named_log.pk, username_log.pk, anonymous_log.pk}]
        self.assertEqual(ordered_ids, [anonymous_log.pk, named_log.pk, username_log.pk])

    def test_manage_sort_preserves_query_and_sort_in_pagination(self):
        for index in range(31):
            AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message=f"entry {index}", user=self.admin)

        response = self.client.get(reverse("manage-audit"), {"q": "entry", "sort": "user", "dir": "asc"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "?q=entry&amp;sort=user&amp;dir=asc&amp;page=2", html=False)
        self.assertContains(response, "name=\"sort\" value=\"user\"", html=False)
        self.assertContains(response, "name=\"dir\" value=\"asc\"", html=False)

    def test_manage_audit_page_renders_clear_action_with_confirmation_copy(self):
        response = self.client.get(reverse("manage-audit"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("manage-audit-clear"))
        self.assertContains(response, 'data-delete-confirm-title="清理审计日志"', html=False)
        self.assertContains(
            response,
            'data-delete-confirm-message="确定要清理所有审计日志吗？此操作无法撤销。"',
            html=False,
        )
        self.assertContains(response, 'data-delete-confirm-button="清理"', html=False)

    def test_manage_audit_clear_removes_all_logs(self):
        AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message="one", user=self.admin)
        AuditLog.objects.create(action=AuditLog.ACTION_LOGOUT, message="two", user=self.admin)

        response = self.client.post(reverse("manage-audit-clear"), follow=True)

        self.assertRedirects(response, reverse("manage-audit"))
        self.assertEqual(AuditLog.objects.count(), 0)
        messages = [str(message) for message in response.context["messages"]]
        self.assertTrue(any("审计日志已清理。" in message for message in messages))

    def test_manage_audit_clear_requires_post(self):
        response = self.client.get(reverse("manage-audit-clear"))

        self.assertEqual(response.status_code, 405)


class AuditLogCleanupCommandTests(TestCase):
    def test_cleanup_command_deletes_only_expired_logs(self):
        SiteSetting.objects.create(audit_log_cleanup_enabled=True, audit_log_retention_days=30)
        expired_log = AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message="expired")
        kept_log = AuditLog.objects.create(action=AuditLog.ACTION_LOGOUT, message="kept")
        boundary_log = AuditLog.objects.create(action=AuditLog.ACTION_PROFILE_UPDATE, message="boundary")
        today = timezone.localdate()
        AuditLog.objects.filter(pk=expired_log.pk).update(created_at=timezone.make_aware(datetime.combine(today - timedelta(days=31), time.min)))
        AuditLog.objects.filter(pk=kept_log.pk).update(created_at=timezone.make_aware(datetime.combine(today - timedelta(days=29), time.min)))
        AuditLog.objects.filter(pk=boundary_log.pk).update(created_at=timezone.make_aware(datetime.combine(today - timedelta(days=30), time.min)))

        stdout = StringIO()
        call_command("cleanup_audit_logs", stdout=stdout)

        self.assertFalse(AuditLog.objects.filter(pk=expired_log.pk).exists())
        self.assertTrue(AuditLog.objects.filter(pk=kept_log.pk).exists())
        self.assertTrue(AuditLog.objects.filter(pk=boundary_log.pk).exists())
        self.assertIn("Deleted 1 expired audit log(s).", stdout.getvalue())

    def test_cleanup_command_skips_when_disabled(self):
        SiteSetting.objects.create(audit_log_cleanup_enabled=False, audit_log_retention_days=30)
        log = AuditLog.objects.create(action=AuditLog.ACTION_LOGIN, message="keep")
        AuditLog.objects.filter(pk=log.pk).update(created_at=timezone.now() - timedelta(days=60))

        stdout = StringIO()
        call_command("cleanup_audit_logs", stdout=stdout)

        self.assertTrue(AuditLog.objects.filter(pk=log.pk).exists())
        self.assertIn("Audit log cleanup is disabled.", stdout.getvalue())


class CommentViewTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="author", email="author@example.com", password="Pass123!Aa", first_name="Author")
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="AdminPass123!",
            first_name="Admin",
            is_staff=True,
            is_superuser=True,
        )
        self.member = User.objects.create_user(username="member", email="member@example.com", password="Pass123!Aa", first_name="Member")
        self.other_member = User.objects.create_user(username="other", email="other@example.com", password="Pass123!Aa")
        self.post = Post.objects.create(
            title="Published Post",
            slug="published-post",
            summary="Summary",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            published_at=timezone.now(),
            author=self.author,
        )

    def test_detail_page_renders_comment_section(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-detail", args=[self.post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="comments"', html=False)
        self.assertContains(response, reverse("comment-create", args=[self.post.slug]))
        self.assertContains(response, 'data-feedback-endpoint="%s"' % reverse("blog-feedback-toggle", args=[self.post.slug]), html=False)

    def test_member_can_post_comment(self):
        self.client.force_login(self.member)

        response = self.client.post(reverse("comment-create", args=[self.post.slug]), {"content": "**Hello**"}, follow=True)

        self.assertRedirects(response, f'{self.post.get_absolute_url()}#comment-{Comment.objects.get().pk}', fetch_redirect_response=False)
        comment = Comment.objects.get()
        self.assertEqual(comment.author, self.member)
        self.assertEqual(comment.post, self.post)
        self.assertIsNone(comment.parent)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_COMMENT_CREATE).exists())

    def test_comment_create_respects_next_url(self):
        self.client.force_login(self.member)

        response = self.client.post(
            f"{reverse('comment-create', args=[self.post.slug])}?next=/book/guide/?post=chapter-1",
            {"content": "Inside book"},
            follow=False,
        )

        comment = Comment.objects.get()
        self.assertRedirects(response, f"/book/guide/?post=chapter-1#comment-{comment.pk}", fetch_redirect_response=False)

    def test_member_can_reply_to_top_level_comment(self):
        parent = Comment.objects.create(post=self.post, author=self.author, content="Top level")
        self.client.force_login(self.member)

        response = self.client.post(
            reverse("comment-create", args=[self.post.slug]),
            {"parent_id": str(parent.pk), f"reply-{parent.pk}-content": "Reply body"},
            follow=True,
        )

        reply = Comment.objects.exclude(pk=parent.pk).get()
        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comment-{reply.pk}", fetch_redirect_response=False)
        self.assertEqual(reply.parent, parent)
        self.assertEqual(reply.reply_to, parent)

    def test_member_can_reply_to_second_level_comment_without_creating_third_level(self):
        parent = Comment.objects.create(post=self.post, author=self.author, content="Top level")
        reply = Comment.objects.create(post=self.post, author=self.member, content="Reply", parent=parent)
        self.client.force_login(self.other_member)

        response = self.client.post(
            reverse("comment-create", args=[self.post.slug]),
            {"parent_id": str(reply.pk), f"reply-{reply.pk}-content": "Nope"},
            follow=True,
        )

        nested_reply = Comment.objects.exclude(pk__in=[parent.pk, reply.pk]).get()
        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comment-{nested_reply.pk}", fetch_redirect_response=False)
        self.assertEqual(nested_reply.parent, parent)
        self.assertEqual(nested_reply.reply_to, reply)
        self.assertEqual(Comment.objects.count(), 3)

    @override_settings(COMMENT_RATE_LIMIT_PER_MINUTE=1)
    def test_comment_rate_limit_blocks_second_comment(self):
        self.client.force_login(self.member)
        Comment.objects.create(post=self.post, author=self.member, content="First")

        response = self.client.post(reverse("comment-create", args=[self.post.slug]), {"content": "Second"}, follow=True)

        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comments")
        self.assertEqual(Comment.objects.count(), 1)

    @override_settings(COMMENT_RATE_LIMIT_PER_MINUTE=0)
    def test_comment_rate_limit_zero_allows_multiple_comments(self):
        self.client.force_login(self.member)

        response_one = self.client.post(reverse("comment-create", args=[self.post.slug]), {"content": "First"})
        response_two = self.client.post(reverse("comment-create", args=[self.post.slug]), {"content": "Second"})

        self.assertEqual(response_one.status_code, 302)
        self.assertEqual(response_two.status_code, 302)
        self.assertEqual(Comment.objects.count(), 2)

    def test_comment_author_can_delete_own_comment(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Mine")
        self.client.force_login(self.member)

        response = self.client.post(reverse("comment-delete", args=[comment.pk]), follow=True)

        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comments")
        self.assertFalse(Comment.objects.filter(pk=comment.pk).exists())

    def test_comment_delete_respects_next_url(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Mine")
        self.client.force_login(self.member)

        response = self.client.post(
            f"{reverse('comment-delete', args=[comment.pk])}?next=/book/guide/?post=chapter-1",
            follow=False,
        )

        self.assertRedirects(response, "/book/guide/?post=chapter-1#comments", fetch_redirect_response=False)

    def test_comment_author_can_edit_own_comment(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Before")
        self.client.force_login(self.member)

        response = self.client.post(
            reverse("comment-update", args=[comment.pk]),
            {f"edit-{comment.pk}-content": "After"},
            follow=False,
        )

        comment.refresh_from_db()
        self.assertEqual(comment.content, "After")
        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comment-{comment.pk}", fetch_redirect_response=False)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_COMMENT_UPDATE).exists())

    def test_comment_update_respects_next_url(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Before")
        self.client.force_login(self.member)

        response = self.client.post(
            f"{reverse('comment-update', args=[comment.pk])}?next=/book/guide/?post=chapter-1",
            {f"edit-{comment.pk}-content": "After"},
            follow=False,
        )

        self.assertRedirects(response, f"/book/guide/?post=chapter-1#comment-{comment.pk}", fetch_redirect_response=False)

    def test_comment_create_validation_error_preserves_book_share_detail_view(self):
        share_author = User.objects.create_user(username="share-comment-author", email="share-comment-author@example.com", password="Pass123!Aa")
        share_member = User.objects.create_user(username="share-comment-member", email="share-comment-member@example.com", password="Pass123!Aa")
        share_post = Post.objects.create(
            title="Share comment source",
            slug="share-comment-source",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=share_author,
            published_at=timezone.now(),
        )
        share_book = Book.objects.create(
            name="Share comment book",
            slug="share-comment-book",
            summary="Summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=share_author,
            structure=[{"type": "post", "post_id": share_post.pk}],
        )
        share_book.posts.set([share_post])
        share_link = BookShareLink.objects.create(book=share_book, created_by=share_author, token="sharecommentbook123", expires_at=timezone.now() + timedelta(days=7))
        self.client.force_login(share_member)

        response = self.client.post(
            f"{reverse('comment-create', args=[share_post.slug])}?next={reverse('book-share-detail', args=[share_link.token])}%3Fpost%3D{share_post.slug}",
            {"content": "   "},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'data-book-outline-data', html=False)
        self.assertContains(response, share_post.title)
        self.assertContains(response, 'class="field-error"', html=False)

    def test_comment_update_validation_error_preserves_book_share_detail_view(self):
        share_author = User.objects.create_user(username="share-edit-author", email="share-edit-author@example.com", password="Pass123!Aa")
        share_member = User.objects.create_user(username="share-edit-member", email="share-edit-member@example.com", password="Pass123!Aa")
        share_post = Post.objects.create(
            title="Share edit source",
            slug="share-edit-source",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=share_author,
            published_at=timezone.now(),
        )
        share_book = Book.objects.create(
            name="Share edit book",
            slug="share-edit-book",
            summary="Summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=share_author,
            structure=[{"type": "post", "post_id": share_post.pk}],
        )
        share_book.posts.set([share_post])
        share_link = BookShareLink.objects.create(book=share_book, created_by=share_author, token="shareeditbook123", expires_at=timezone.now() + timedelta(days=7))
        comment = Comment.objects.create(post=share_post, author=share_member, content="Before")
        self.client.force_login(share_member)

        response = self.client.post(
            f"{reverse('comment-update', args=[comment.pk])}?next={reverse('book-share-detail', args=[share_link.token])}%3Fpost%3D{share_post.slug}",
            {f"edit-{comment.pk}-content": "   "},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-comment-edit-panel="%s"' % comment.pk, html=False)
        self.assertContains(response, 'data-comment-edit-toggle data-comment-id="%s" aria-expanded="true"' % comment.pk, html=False)
        self.assertContains(response, f'data-book-outline-data', html=False)

    def test_comment_update_validation_error_renders_edit_panel(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Before")
        self.client.force_login(self.member)

        response = self.client.post(
            reverse("comment-update", args=[comment.pk]),
            {f"edit-{comment.pk}-content": "   "},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-comment-edit-panel="%s"' % comment.pk, html=False)
        self.assertContains(response, 'data-comment-edit-toggle data-comment-id="%s" aria-expanded="true"' % comment.pk, html=False)
        self.assertContains(response, 'class="field-error"', html=False)

    def test_other_member_cannot_edit_comment(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Protected")
        self.client.force_login(self.other_member)

        response = self.client.post(
            reverse("comment-update", args=[comment.pk]),
            {f"edit-{comment.pk}-content": "Tampered"},
            follow=True,
        )

        comment.refresh_from_db()
        self.assertEqual(comment.content, "Protected")
        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comment-{comment.pk}", fetch_redirect_response=False)

    def test_comment_author_can_edit_reply(self):
        parent = Comment.objects.create(post=self.post, author=self.author, content="Parent")
        reply = Comment.objects.create(post=self.post, author=self.member, content="Reply", parent=parent, reply_to=parent)
        self.client.force_login(self.member)

        response = self.client.post(
            reverse("comment-update", args=[reply.pk]),
            {f"edit-{reply.pk}-content": "Updated reply"},
            follow=False,
        )

        reply.refresh_from_db()
        self.assertEqual(reply.content, "Updated reply")
        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comment-{reply.pk}", fetch_redirect_response=False)

    def test_detail_page_shows_edit_button_for_comment_author_only(self):
        own_comment = Comment.objects.create(post=self.post, author=self.member, content="Mine")
        other_comment = Comment.objects.create(post=self.post, author=self.author, content="Theirs")
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-detail", args=[self.post.slug]))

        self.assertContains(response, 'data-comment-edit-toggle data-comment-id="%s"' % own_comment.pk, html=False)
        self.assertNotContains(response, 'data-comment-edit-toggle data-comment-id="%s"' % other_comment.pk, html=False)

    def test_admin_can_delete_any_comment(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Remove me")
        self.client.force_login(self.admin)

        response = self.client.post(reverse("comment-delete", args=[comment.pk]), follow=True)

        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comments")
        self.assertFalse(Comment.objects.filter(pk=comment.pk).exists())

    def test_other_member_cannot_delete_comment(self):
        comment = Comment.objects.create(post=self.post, author=self.member, content="Protected")
        self.client.force_login(self.other_member)

        response = self.client.post(reverse("comment-delete", args=[comment.pk]), follow=True)

        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comments")
        self.assertTrue(Comment.objects.filter(pk=comment.pk).exists())

    def test_delete_top_level_comment_cascades_replies(self):
        parent = Comment.objects.create(post=self.post, author=self.member, content="Parent")
        Comment.objects.create(post=self.post, author=self.other_member, content="Child", parent=parent)
        self.client.force_login(self.member)

        response = self.client.post(reverse("comment-delete", args=[parent.pk]), follow=True)

        self.assertRedirects(response, f"{self.post.get_absolute_url()}#comments")
        self.assertEqual(Comment.objects.count(), 0)

    def test_detail_page_shows_author_and_admin_tags_together(self):
        privileged_author = User.objects.create_user(
            username="boss",
            email="boss@example.com",
            password="Pass123!Aa",
            first_name="Boss",
            is_staff=True,
            is_superuser=True,
        )
        privileged_post = Post.objects.create(
            title="Boss Post",
            slug="boss-post",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            published_at=timezone.now(),
            author=privileged_author,
        )
        Comment.objects.create(post=privileged_post, author=privileged_author, content="Owner comment")
        self.client.force_login(self.member)

        response = self.client.get(reverse("blog-detail", args=[privileged_post.slug]))

        self.assertContains(response, 'comment-role-tag-author', count=1)
        self.assertContains(response, 'comment-role-tag">', count=1)
        self.assertContains(response, 'id="comment-1"', html=False)

    def test_detail_page_shows_reply_to_child_comment_metadata_and_reply_button(self):
        parent = Comment.objects.create(post=self.post, author=self.author, content="Top level")
        child = Comment.objects.create(post=self.post, author=self.member, content="Child", parent=parent, reply_to=parent)
        Comment.objects.create(post=self.post, author=self.other_member, content="Nested reply", parent=parent, reply_to=child)
        self.client.force_login(self.admin)

        response = self.client.get(reverse("blog-detail", args=[self.post.slug]))

        self.assertContains(response, "回复")
        self.assertContains(response, 'data-reply-toggle data-comment-id="%s"' % child.pk, html=False)
        self.assertContains(response, 'data-reply-panel="%s"' % child.pk, html=False)
        self.assertContains(response, 'class="comment-thread"', count=1)
        self.assertContains(response, 'data-comment-card', count=3)
        self.assertContains(response, 'data-thread-toggle', count=1)
        self.assertContains(response, 'aria-expanded="false"', html=False)
        self.assertContains(response, '展开 2 条回复')
        self.assertContains(response, 'data-thread-replies hidden', html=False)

    def test_active_reply_thread_stays_expanded(self):
        parent = Comment.objects.create(post=self.post, author=self.author, content="Top level")
        child = Comment.objects.create(post=self.post, author=self.member, content="Child", parent=parent, reply_to=parent)
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("comment-create", args=[self.post.slug]),
            {"parent_id": str(child.pk), f"reply-{child.pk}-content": ""},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-thread-toggle', count=1)
        self.assertContains(response, 'aria-expanded="true"', html=False)
        self.assertContains(response, '收起回复')

    def test_member_can_toggle_post_feedback(self):
        self.client.force_login(self.member)

        response = self.client.post(reverse("blog-feedback-toggle", args=[self.post.slug]), {"value": "1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["active_value"], 1)
        self.assertEqual(PostFeedback.objects.get(post=self.post, user=self.member).value, 1)

        response = self.client.post(reverse("blog-feedback-toggle", args=[self.post.slug]), {"value": "1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["active_value"], 0)
        self.assertFalse(PostFeedback.objects.filter(post=self.post, user=self.member).exists())

    def test_member_can_comment_and_feedback_after_unlocking_encrypted_post(self):
        encrypted_post = Post.objects.create(
            title="Locked Comments",
            slug="locked-comments",
            summary="Summary",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_ENCRYPTED,
            access_password="Secret123!",
            published_at=timezone.now(),
            author=self.author,
        )
        self.client.force_login(self.member)
        self.client.post(reverse("blog-detail", args=[encrypted_post.slug]), {"password": "Secret123!"})

        comment_response = self.client.post(reverse("comment-create", args=[encrypted_post.slug]), {"content": "Unlocked comment"})
        feedback_response = self.client.post(reverse("blog-feedback-toggle", args=[encrypted_post.slug]), {"value": "1"})

        self.assertEqual(comment_response.status_code, 302)
        self.assertEqual(feedback_response.status_code, 200)
        self.assertTrue(Comment.objects.filter(post=encrypted_post, author=self.member, content="Unlocked comment").exists())
        self.assertEqual(feedback_response.json()["active_value"], 1)

    def test_member_can_switch_post_feedback_between_like_and_dislike(self):
        self.client.force_login(self.member)

        self.client.post(reverse("blog-feedback-toggle", args=[self.post.slug]), {"value": "1"})
        response = self.client.post(reverse("blog-feedback-toggle", args=[self.post.slug]), {"value": "-1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["active_value"], -1)
        self.assertEqual(PostFeedback.objects.get(post=self.post, user=self.member).value, -1)
        self.assertEqual(response.json()["up_count"], 0)
        self.assertEqual(response.json()["down_count"], 1)

    def test_member_can_toggle_comment_feedback(self):
        comment = Comment.objects.create(post=self.post, author=self.author, content="Feedback target")
        self.client.force_login(self.member)

        response = self.client.post(reverse("comment-feedback-toggle", args=[comment.pk]), {"value": "1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["active_value"], 1)
        self.assertEqual(CommentFeedback.objects.get(comment=comment, user=self.member).value, 1)

        response = self.client.post(reverse("comment-feedback-toggle", args=[comment.pk]), {"value": "-1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["active_value"], -1)
        self.assertEqual(CommentFeedback.objects.get(comment=comment, user=self.member).value, -1)

    def test_anonymous_feedback_endpoint_redirects_to_login(self):
        response = self.client.post(reverse("blog-feedback-toggle", args=[self.post.slug]), {"value": "1"})

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response["Location"])


class PostShareViewTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="author", email="author@example.com", password="Pass123!Aa", first_name="Author")
        self.member = User.objects.create_user(username="member", email="member@example.com", password="Pass123!Aa", first_name="Member")
        self.post = Post.objects.create(
            title="Shareable Post",
            slug="shareable-post",
            summary="Summary",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=self.author,
        )

    def test_author_does_not_see_share_button_on_public_published_post_detail(self):
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-detail", args=[self.post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "生成外链")
        self.assertNotContains(response, 'data-share-trigger', html=False)

    def test_non_author_cannot_generate_share_link(self):
        self.client.force_login(self.member)

        response = self.client.post(reverse("blog-share-create", args=[self.post.slug]), {"expiry": "7d"})

        self.assertEqual(response.status_code, 403)
        self.assertFalse(PostShareLink.objects.exists())

    def test_author_can_generate_share_link(self):
        self.client.force_login(self.author)

        response = self.client.post(reverse("blog-share-create", args=[self.post.slug]), {"expiry": "7d"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertIn(reverse("blog-share-detail", args=[PostShareLink.objects.get().token]), payload["url"])
        self.assertEqual(PostShareLink.objects.count(), 1)

    def test_author_does_not_see_existing_share_link_controls_on_detail_page(self):
        share_link = PostShareLink.objects.create(
            post=self.post,
            created_by=self.author,
            token="existingdetailtoken123",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.client.force_login(self.author)

        response = self.client.get(reverse("blog-detail", args=[self.post.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'data-share-trigger', html=False)
        self.assertNotContains(response, 'data-share-current-url=', html=False)
        self.assertNotContains(response, 'data-share-current-expires=', html=False)

    def test_generating_new_share_link_replaces_old_link(self):
        self.client.force_login(self.author)

        first_response = self.client.post(reverse("blog-share-create", args=[self.post.slug]), {"expiry": "7d"})
        first_token = PostShareLink.objects.get().token

        second_response = self.client.post(reverse("blog-share-create", args=[self.post.slug]), {"expiry": "30d"})
        second_token = PostShareLink.objects.get().token

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertNotEqual(first_token, second_token)
        self.assertEqual(PostShareLink.objects.filter(post=self.post).count(), 1)
        self.assertFalse(PostShareLink.objects.filter(token=first_token).exists())
        self.assertTrue(PostShareLink.objects.filter(token=second_token).exists())
        self.assertEqual(self.client.get(reverse("blog-share-detail", args=[first_token])).status_code, 404)
        self.assertEqual(self.client.get(reverse("blog-share-detail", args=[second_token])).status_code, 200)

    def test_private_or_draft_post_cannot_generate_share_link(self):
        private_post = Post.objects.create(
            title="Private",
            slug="private-share",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PRIVATE,
            published_at=timezone.now(),
            author=self.author,
        )
        self.client.force_login(self.author)

        response = self.client.post(reverse("blog-share-create", args=[private_post.slug]), {"expiry": "7d"})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(PostShareLink.objects.filter(post=private_post).exists())

    def test_anonymous_user_can_view_share_link_but_not_interact(self):
        parent = Comment.objects.create(post=self.post, author=self.author, content="Parent")
        reply = Comment.objects.create(post=self.post, author=self.member, content="Reply", parent=parent, reply_to=parent)
        PostFeedback.objects.create(post=self.post, user=self.author, value=1)
        CommentFeedback.objects.create(comment=parent, user=self.author, value=1)
        shared_tag = Tag.objects.create(name="External", slug="external")
        self.post.tags.add(shared_tag)
        share_link = PostShareLink.objects.create(post=self.post, created_by=self.author, token="sharetoken123", expires_at=timezone.now() + timedelta(days=7))

        response = self.client.get(reverse("blog-share-detail", args=[share_link.token]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="comments"', html=False)
        self.assertContains(response, 'data-feedback-count="up">1<', html=False)
        self.assertNotContains(response, reverse("comment-create", args=[self.post.slug]))
        self.assertNotContains(response, "Post comment")
        self.assertNotContains(response, "Delete")
        self.assertNotContains(response, "Related posts")
        self.assertNotContains(response, 'data-feedback-endpoint="%s"' % reverse("blog-feedback-toggle", args=[self.post.slug]), html=False)
        self.assertContains(response, 'disabled', count=6)
        self.assertContains(response, 'class="soft-tag soft-tag-directory post-detail-tag-link"', html=False)
        self.assertContains(response, '--tag-rgb:', html=False)
        self.assertNotContains(response, reverse("blog-tag-detail", args=[shared_tag.slug]))

    def test_expired_share_link_returns_404(self):
        share_link = PostShareLink.objects.create(post=self.post, created_by=self.author, token="expiredtoken123", expires_at=timezone.now() - timedelta(minutes=1))

        response = self.client.get(reverse("blog-share-detail", args=[share_link.token]))

        self.assertEqual(response.status_code, 404)

    def test_share_link_becomes_invalid_when_post_is_private(self):
        share_link = PostShareLink.objects.create(post=self.post, created_by=self.author, token="publictoken123", expires_at=timezone.now() + timedelta(days=7))
        self.post.visibility = Post.VISIBILITY_PRIVATE
        self.post.save(update_fields=["visibility"])

        response = self.client.get(reverse("blog-share-detail", args=[share_link.token]))

        self.assertEqual(response.status_code, 404)

    def test_top_level_comment_cannot_set_reply_target(self):
        comment = Comment(post=self.post, author=self.member, content="Top level", reply_to=Comment.objects.create(post=self.post, author=self.author, content="Parent"))

        with self.assertRaisesMessage(ValidationError, "Top-level comments cannot reply to another comment."):
            comment.full_clean()


class MarkdownRenderingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="markdowner", email="markdowner@example.com", password="Pass123!Aa")

    def test_render_markdown_keeps_non_list_blocks_around_lists(self):
        content = "\n".join([
            "# H1",
            "",
            "**bold**",
            "",
            "> something cite",
            "",
            "* item 1",
            "* item 2",
            "",
            "## H2",
            "",
            "1. first",
            "2. second",
        ])

        rendered = render_markdown(content)

        self.assertIn("<h1>H1</h1>", rendered)
        self.assertIn("<p><strong>bold</strong></p>", rendered)
        self.assertIn("<blockquote>", rendered)
        self.assertIn("<p>something cite</p>", rendered)
        self.assertIn("<ul><li>item 1</li><li>item 2</li></ul>", rendered)
        self.assertIn("<h2>H2</h2>", rendered)
        self.assertIn("<ol><li>first</li><li>second</li></ol>", rendered)

    def test_render_markdown_separates_unordered_and_ordered_lists(self):
        rendered = render_markdown("* item 1\n* item 2\n1. first\n2. second")

        self.assertIn("<ul><li>item 1</li><li>item 2</li></ul><ol><li>first</li><li>second</li></ol>", rendered)

    def test_detail_page_renders_headings_and_quotes_when_post_contains_lists(self):
        author = User.objects.create_user(username="writer", email="writer@example.com", password="Pass123!Aa")
        viewer = User.objects.create_user(username="reader", email="reader@example.com", password="Pass123!Aa")
        post = Post.objects.create(
            title="Markdown Post",
            slug="markdown-post",
            content="\n".join([
                "# H1",
                "",
                "**bold**",
                "",
                "> quote",
                "",
                "* item 1",
                "* item 2",
            ]),
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            published_at=timezone.now(),
            author=author,
        )
        self.client.force_login(viewer)

        response = self.client.get(reverse("blog-detail", args=[post.slug]))

        self.assertContains(response, "<h1>H1</h1>", html=False)
        self.assertContains(response, "<strong>bold</strong>", html=False)
        self.assertContains(response, "<blockquote>", html=False)
        self.assertContains(response, "<p>quote</p>", html=False)
        self.assertContains(response, "<ul><li>item 1</li><li>item 2</li></ul>", html=False)

    def test_render_markdown_supports_fenced_code_blocks(self):
        fence = "`" * 3
        rendered = render_markdown(f"{fence}py\n1231\n{fence}")

        self.assertIn('class="codehilite"', rendered)
        self.assertIn("<pre>", rendered)
        self.assertIn("<code>", rendered)
        self.assertIn("1231", rendered)
        self.assertIn("</code></pre>", rendered)

    def test_render_markdown_highlights_python_tokens(self):
        fence = "`" * 3
        rendered = render_markdown(f"{fence}py\ndef add(x):\n    return x + 1\n{fence}")

        self.assertRegex(rendered, r'<span class="[^"]+">def</span>')
        self.assertRegex(rendered, r'<span class="[^"]+">add</span>')
        self.assertRegex(rendered, r'<span class="[^"]+">1</span>')

    def test_render_markdown_closes_fenced_code_block_before_following_heading(self):
        fence = "`" * 3
        rendered = render_markdown("\n".join([
            f"{fence}",
            "SyncTaskPublisher (每1小时)",
            "    │",
            "    ▼",
            f"{fence}",
            "",
            "### 2.6 结论",
        ]))

        self.assertIn('class="codehilite"', rendered)
        self.assertIn("SyncTaskPublisher", rendered)
        self.assertIn("<h3>2.6 结论</h3>", rendered)

    def test_render_markdown_supports_inline_code(self):
        rendered = render_markdown("配置项 `auth_kwargs` 需要检查")

        self.assertIn("<code>auth_kwargs</code>", rendered)

    def test_render_markdown_supports_table_without_blank_line_before(self):
        rendered = render_markdown("\n".join([
            "OAuth 端点与 Scope（line 12-50）：",
            "| Provider | Auth URL | Token URL | Scopes |",
            "|----------|----------|-----------|--------|",
            "| Gmail | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` | `gmail.readonly`, `gmail.send`, `gmail.settings.basic` |",
            "| Microsoft | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` | `https://login.microsoftonline.com/common/oauth2/v2.0/token` | `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Mail.Read`, `Mail.Send` |",
        ]))

        self.assertIn("<p>OAuth 端点与 Scope（line 12-50）：</p>", rendered)
        self.assertIn("<table>", rendered)
        self.assertIn("<th>Provider</th>", rendered)
        self.assertIn("<td><code>https://oauth2.googleapis.com/token</code></td>", rendered)

    def test_render_markdown_supports_table_without_blank_line_after(self):
        rendered = render_markdown("\n".join([
            "| Provider | API 端点 | 提取字段 |",
            "|----------|----------|----------|",
            "| Gmail | `GET https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs` | 找 `isPrimary` 或 `isDefault`，取 `displayName` → `sender_name`, `sendAsEmail` → `sender_email` |",
            "| Microsoft | `GET https://graph.microsoft.com/v1.0/me` | `displayName` → `sender_name`, `mail` 或 `userPrincipalName` → `sender_email` |",
            "返回值都被写入 connection config：`{sender_name, sender_email, username}`，config 经 AES 加密后存入 MySQL `project_connection` 表。",
        ]))

        self.assertIn("<table>", rendered)
        self.assertIn("<td><code>GET https://graph.microsoft.com/v1.0/me</code></td>", rendered)
        self.assertIn("</table><p>返回值都被写入 connection config：<code>{sender_name, sender_email, username}</code>，config 经 AES 加密后存入 MySQL <code>project_connection</code> 表。</p>", rendered)
        self.assertNotIn("<td>返回值都被写入 connection config", rendered)

    def test_render_markdown_supports_tabs_without_blank_line_before(self):
        rendered = render_markdown("\n".join([
            "切换示例：",
            '=== "Python"',
            "    print('hello')",
            "说明文本",
        ]))

        self.assertIn("<p>切换示例：</p>", rendered)
        self.assertIn('class="markdown-tabs"', rendered)
        self.assertIn("<p>说明文本</p>", rendered)

    def test_render_markdown_supports_admonition_without_blank_line_before(self):
        rendered = render_markdown("\n".join([
            "注意：",
            "??? note",
            "    这里是提示内容",
            "补充说明",
        ]))

        self.assertIn("<p>注意：</p>", rendered)
        self.assertIn('class="markdown-admonition markdown-admonition-note"', rendered)
        self.assertIn("<p>补充说明</p>", rendered)

    def test_render_markdown_supports_callout_without_blank_lines_around_it(self):
        rendered = render_markdown("\n".join([
            "说明：",
            "> [!NOTE]",
            "> 这里是重点",
            "结尾文本",
        ]))

        self.assertIn("<p>说明：</p>", rendered)
        self.assertIn('class="markdown-callout markdown-callout-note"', rendered)
        self.assertIn("<p>这里是重点</p>", rendered)
        self.assertIn("<p>结尾文本</p>", rendered)

    def test_render_markdown_supports_color_attribute_list_syntax(self):
        rendered = render_markdown("[text]{.md-color-blue} and [accent]{.md-color-rose}")

        self.assertIn('<span class="md-color-blue">text</span>', rendered)
        self.assertIn('<span class="md-color-rose">accent</span>', rendered)

    def test_markdown_preview_endpoint_reuses_render_markdown(self):
        self.client.force_login(self.user)
        content = "\n".join([
            "# H1",
            "",
            "[text]{.md-color-blue}",
            "",
            "```py",
            "1231",
            "```",
        ])

        response = self.client.post(reverse("blog-markdown-preview"), {"content": content})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertIn("<h1>H1</h1>", payload["html"])
        self.assertIn('<span class="md-color-blue">text</span>', payload["html"])
        self.assertIn('class="codehilite"', payload["html"])
        self.assertIn("<pre>", payload["html"])
        self.assertIn("<code>", payload["html"])
        self.assertIn("1231", payload["html"])
        self.assertIn("</code></pre>", payload["html"])

    def test_reference_search_returns_visible_published_posts_only(self):
        self.user.is_staff = True
        self.user.is_superuser = True
        self.user.save(update_fields=["is_staff", "is_superuser"])
        self.client.force_login(self.user)
        visible_post = Post.objects.create(
            title="Visible reference",
            slug="visible-reference",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.user,
            published_at=timezone.now(),
        )
        book_only_post = Post.objects.create(
            title="Book only reference",
            slug="book-only-reference",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_BOOK_ONLY,
            author=self.user,
            published_at=timezone.now(),
        )
        Post.objects.create(
            title="Draft reference",
            slug="draft-reference",
            content="Body",
            status=Post.STATUS_DRAFT,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.user,
        )

        response = self.client.get(reverse("manage-post-reference-search"), {"q": "reference"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["items"]), 2)
        items_by_title = {item["title"]: item for item in payload["items"]}
        self.assertEqual(items_by_title[visible_post.title]["visibility"], Post.VISIBILITY_PUBLIC)
        self.assertIn('class="post-card compact-card reference-post-card"', items_by_title[visible_post.title]["html"])
        self.assertIn('data-post-card-select', items_by_title[visible_post.title]["html"])
        self.assertIn(visible_post.get_absolute_url(), items_by_title[visible_post.title]["html"])
        self.assertIn('class="post-card-content-panel', items_by_title[visible_post.title]["html"])
        self.assertEqual(items_by_title[book_only_post.title]["visibility"], Post.VISIBILITY_BOOK_ONLY)
        self.assertIn('fa-solid fa-book-open-reader', items_by_title[book_only_post.title]["html"])

    def test_reference_search_returns_pagination_metadata(self):
        self.user.is_staff = True
        self.user.is_superuser = True
        self.user.save(update_fields=["is_staff", "is_superuser"])
        self.client.force_login(self.user)
        for index in range(13):
            Post.objects.create(
                title=f"Reference page {index}",
                slug=f"reference-page-{index}",
                content="Body",
                status=Post.STATUS_PUBLISHED,
                visibility=Post.VISIBILITY_PUBLIC,
                author=self.user,
                published_at=timezone.now() + timedelta(minutes=index),
            )

        response = self.client.get(reverse("manage-post-reference-search"), {"q": "Reference page", "page": 2})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["pagination"]["page"], 2)
        self.assertEqual(payload["pagination"]["total_pages"], 2)
        self.assertTrue(payload["pagination"]["has_previous"])
        self.assertFalse(payload["pagination"]["has_next"])
        self.assertEqual(len(payload["items"]), 1)

    def test_post_link_preview_returns_card_html_for_visible_post(self):
        self.client.force_login(self.user)
        visible_post = Post.objects.create(
            title="Visible preview",
            slug="visible-preview",
            content="Body",
            summary="Tooltip summary",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.user,
            published_at=timezone.now(),
        )

        response = self.client.get(reverse("blog-post-preview"), {"path": visible_post.get_absolute_url()})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["title"], visible_post.title)
        self.assertEqual(payload["url"], visible_post.get_absolute_url())
        self.assertIn('class="post-card compact-card reference-post-card post-card-tooltip-preview"', payload["html"])
        self.assertIn(visible_post.summary, payload["html"])

    def test_post_link_preview_rejects_non_post_path(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("blog-post-preview"), {"path": reverse("blog-search")})

        self.assertEqual(response.status_code, 404)

    def test_post_link_preview_requires_unlocked_access_for_encrypted_post(self):
        author = User.objects.create_user(username="preview-author", email="preview-author@example.com", password="Pass123!Aa")
        encrypted_post = Post.objects.create(
            title="Encrypted preview",
            slug="encrypted-preview",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_ENCRYPTED,
            access_password="secret123",
            author=author,
            published_at=timezone.now(),
        )
        viewer = User.objects.create_user(username="preview-viewer", email="preview-viewer@example.com", password="Pass123!Aa")
        self.client.force_login(viewer)

        response = self.client.get(reverse("blog-post-preview"), {"path": encrypted_post.get_absolute_url()})

        self.assertEqual(response.status_code, 404)

    def test_post_link_preview_supports_book_share_paths(self):
        author = User.objects.create_user(username="preview-book-author", email="preview-book-author@example.com", password="Pass123!Aa")
        source_post = Post.objects.create(
            title="Preview source",
            slug="preview-source",
            content="Body",
            summary="Tooltip summary",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=author,
            published_at=timezone.now(),
        )
        linked_post = Post.objects.create(
            title="Preview linked",
            slug="preview-linked",
            content="Body",
            summary="Linked tooltip summary",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_BOOK_ONLY,
            author=author,
            published_at=timezone.now(),
        )
        book = Book.objects.create(
            name="Preview book",
            slug="preview-book",
            summary="Summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=author,
            structure=[
                {"type": "post", "post_id": source_post.pk},
                {"type": "post", "post_id": linked_post.pk},
            ],
        )
        book.posts.set([source_post, linked_post])
        share_link = BookShareLink.objects.create(book=book, created_by=author, token="previewbookshare123", expires_at=timezone.now() + timedelta(days=7))
        viewer = User.objects.create_user(username="preview-book-viewer", email="preview-book-viewer@example.com", password="Pass123!Aa")
        self.client.force_login(viewer)

        response = self.client.get(reverse("blog-post-preview"), {"path": f"{reverse('book-share-detail', args=[share_link.token])}?post={linked_post.slug}"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["title"], linked_post.title)
        self.assertIn(linked_post.summary, payload["html"])

    def test_post_link_preview_rejects_inaccessible_book_share_post(self):
        author = User.objects.create_user(username="preview-private-author", email="preview-private-author@example.com", password="Pass123!Aa")
        public_post = Post.objects.create(
            title="Visible source",
            slug="visible-source",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=author,
            published_at=timezone.now(),
        )
        private_post = Post.objects.create(
            title="Private target",
            slug="private-target",
            content="Body",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PRIVATE,
            author=author,
            published_at=timezone.now(),
        )
        book = Book.objects.create(
            name="Private preview book",
            slug="private-preview-book",
            summary="Summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=author,
            structure=[
                {"type": "post", "post_id": public_post.pk},
                {"type": "post", "post_id": private_post.pk},
            ],
        )
        book.posts.set([public_post, private_post])
        share_link = BookShareLink.objects.create(book=book, created_by=author, token="privatepreviewshare123", expires_at=timezone.now() + timedelta(days=7))
        viewer = User.objects.create_user(username="preview-private-viewer", email="preview-private-viewer@example.com", password="Pass123!Aa")
        self.client.force_login(viewer)

        response = self.client.get(reverse("blog-post-preview"), {"path": f"{reverse('book-share-detail', args=[share_link.token])}?post={private_post.slug}"})

        self.assertEqual(response.status_code, 404)



class ProfileViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="OldPass123!",
            first_name="Member",
        )
        self.client.force_login(self.user)

    def test_profile_page_renders_navigation_sections(self):
        response = self.client.get(reverse("profile"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "基本信息")
        self.assertContains(response, "账号安全")
        self.assertContains(response, f'href="{reverse("profile")}?section=basic"', html=False)
        self.assertContains(response, f'href="{reverse("profile")}?section=security"', html=False)
        self.assertContains(response, 'class="is-active"', html=False)
        self.assertContains(response, 'data-unsaved-guard', count=1, html=False)
        self.assertContains(response, "用户名")
        self.assertContains(response, "member")
        self.assertContains(response, 'name="first_name"', html=False)
        self.assertContains(response, 'type="hidden" name="email"', html=False)
        self.assertNotContains(response, 'name="verification_code"', html=False)

    def test_profile_basic_section_renders_clickable_avatar_upload_and_no_email(self):
        response = self.client.get(reverse("profile"), {"section": "basic"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'for="id_avatar"', html=False)
        self.assertContains(response, 'name="avatar"', html=False)
        self.assertContains(response, 'name="remove_avatar"', html=False)
        self.assertContains(response, "点击头像上传")
        self.assertNotContains(response, '<label for="id_avatar">Avatar</label>', html=False)
        self.assertContains(response, 'type="hidden" name="email"', html=False)
        self.assertContains(
            response,
            'class="secondary-button post-cover-undo-button is-hidden" data-profile-avatar-undo',
            html=False,
        )

    def test_profile_basic_section_shows_delete_avatar_button_when_avatar_exists(self):
        profile = self.user.profile
        profile.avatar.save("avatar.jpg", ContentFile(b"avatar-file"), save=True)

        response = self.client.get(reverse("profile"), {"section": "basic"})

        self.assertContains(response, "删除头像")
        self.assertContains(response, 'data-profile-avatar-remove', html=False)
        self.assertContains(response, 'data-profile-avatar-undo', html=False)
        self.assertNotContains(response, 'data-delete-confirm-trigger', html=False)

    def test_profile_avatar_delete_only_applies_when_profile_is_saved(self):
        profile = self.user.profile
        profile.avatar.save("avatar.jpg", ContentFile(b"avatar-file"), save=True)

        response = self.client.post(
            reverse("profile"),
            {
                "action": "profile",
                "section": "basic",
                "first_name": self.user.first_name,
                "email": self.user.email,
                "verification_code": "",
                "remove_avatar": "1",
            },
            follow=True,
        )

        self.assertRedirects(response, f'{reverse("profile")}?section=basic')
        profile.refresh_from_db()
        self.assertFalse(profile.avatar)
        self.assertTrue(
            AuditLog.objects.filter(action=AuditLog.ACTION_PROFILE_UPDATE).exists()
        )

    def test_profile_avatar_remains_until_save(self):
        profile = self.user.profile
        profile.avatar.save("avatar.jpg", ContentFile(b"avatar-file"), save=True)

        response = self.client.get(reverse("profile"), {"section": "basic"})

        self.assertEqual(response.status_code, 200)
        profile.refresh_from_db()
        self.assertTrue(profile.avatar)

    def test_profile_uploaded_avatar_overrides_pending_remove(self):
        profile = self.user.profile
        profile.avatar.save("avatar.jpg", ContentFile(b"avatar-file"), save=True)

        response = self.client.post(
            reverse("profile"),
            {
                "action": "profile",
                "section": "basic",
                "first_name": self.user.first_name,
                "email": self.user.email,
                "verification_code": "",
                "remove_avatar": "1",
                "avatar": build_test_image_file("new-avatar.png"),
            },
            follow=True,
        )

        self.assertRedirects(response, f'{reverse("profile")}?section=basic')
        profile.refresh_from_db()
        self.assertTrue(profile.avatar)
        self.assertIn("new-avatar", profile.avatar.name)

    def test_profile_security_section_only_renders_security_content(self):
        response = self.client.get(reverse("profile"), {"section": "security"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-unsaved-guard', count=2, html=False)
        self.assertContains(response, 'name="email"', html=False)
        self.assertContains(response, 'name="old_password"', html=False)
        self.assertNotContains(response, 'name="avatar"', html=False)
        self.assertNotContains(response, 'name="first_name"', html=False)

    def test_profile_update_without_email_change_does_not_require_code(self):
        response = self.client.post(
            reverse("profile"),
            {
                "action": "profile",
                "section": "basic",
                "first_name": "Updated member",
                "email": "member@example.com",
                "verification_code": "",
            },
            follow=True,
        )

        self.assertRedirects(response, f'{reverse("profile")}?section=basic')
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Updated member")
        self.assertEqual(self.user.email, "member@example.com")

    @override_settings(**MAIL_SETTINGS)
    def test_profile_update_requires_code_when_email_changes(self):
        response = self.client.post(
            reverse("profile"),
            {
                "action": "profile",
                "section": "security",
                "first_name": "Member",
                "email": "new@example.com",
                "verification_code": "",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "修改邮箱时必须填写验证码。")
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "member@example.com")

    @override_settings(**MAIL_SETTINGS)
    def test_profile_update_rejects_invalid_email_change_code(self):
        response = self.client.post(
            reverse("profile"),
            {
                "action": "profile",
                "section": "security",
                "first_name": "Member",
                "email": "new@example.com",
                "verification_code": "654321",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "验证码无效或已过期。")
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "member@example.com")

    @override_settings(**MAIL_SETTINGS)
    def test_profile_update_accepts_valid_email_change_code(self):
        verification = EmailVerificationCode.objects.create(
            email="new@example.com",
            code="123456",
            purpose=EmailVerificationCode.PURPOSE_EMAIL_CHANGE,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        response = self.client.post(
            reverse("profile"),
            {
                "action": "profile",
                "section": "security",
                "first_name": "Renamed",
                "email": "new@example.com",
                "verification_code": "123456",
            },
            follow=True,
        )

        self.assertRedirects(response, f'{reverse("profile")}?section=security')
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Renamed")
        self.assertEqual(self.user.email, "new@example.com")
        verification.refresh_from_db()
        self.assertIsNotNone(verification.consumed_at)

    @override_settings(EMAIL_DELIVERY_READY=False)
    def test_profile_update_allows_email_change_when_email_delivery_unavailable(self):
        response = self.client.post(
            reverse("profile"),
            {
                "action": "profile",
                "section": "security",
                "first_name": "Member",
                "email": "offline@example.com",
                "verification_code": "",
            },
            follow=True,
        )

        self.assertRedirects(response, f'{reverse("profile")}?section=security')
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "offline@example.com")

    def test_profile_password_error_stays_on_security_section(self):
        response = self.client.post(
            reverse("profile"),
            {
                "action": "password",
                "section": "security",
                "old_password": "wrong-password",
                "new_password1": "NewStrongPass123!",
                "new_password2": "NewStrongPass123!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="email"', html=False)
        self.assertContains(response, 'name="old_password"', html=False)
