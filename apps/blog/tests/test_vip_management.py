from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from django.utils.translation import gettext as _

from apps.blog.models import SiteSetting
from apps.blog.utils import build_business_identity_choices, get_or_create_site_setting


User = get_user_model()


class SiteSettingFormTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from apps.blog.forms.site import SiteSettingForm

        cls.form_class = SiteSettingForm

    def test_saves_default_vip_names_when_fields_are_blank(self):
        site_setting = SiteSetting.objects.create()
        form = self.form_class(
            data={
                "site_title": "",
                "post_editor_autosave_enabled": "on",
                "post_editor_autosave_interval_minutes": 5,
                "audit_log_cleanup_enabled": "on",
                "audit_log_retention_days": 30,
                "vip_max_level": 3,
                "vip_level_name_1": "",
                "vip_level_name_2": "Gold",
                "vip_level_name_3": "",
                "dashboard_visit_trend_days": SiteSetting.DASHBOARD_VISIT_TREND_DAYS_7,
            },
            instance=site_setting,
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(saved_setting.vip_max_level, 3)
        self.assertEqual(saved_setting.vip_level_names, ["VIP 1", "Gold", "VIP 3"])

    def test_hides_vip_names_when_feature_is_disabled(self):
        site_setting = SiteSetting.objects.create(vip_max_level=3, vip_level_names=["VIP 1", "Gold", "VIP 3"])
        form = self.form_class(
            data={
                "site_title": "",
                "post_editor_autosave_interval_minutes": 5,
                "audit_log_retention_days": 30,
                "vip_max_level": 0,
                "dashboard_visit_trend_days": SiteSetting.DASHBOARD_VISIT_TREND_DAYS_7,
            },
            instance=site_setting,
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(saved_setting.vip_max_level, 0)
        self.assertEqual(saved_setting.vip_level_names, [])


class UserManageFormTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from apps.blog.forms.manage import UserManageForm

        cls.form_class = UserManageForm

    def setUp(self):
        self.site_setting = get_or_create_site_setting()
        self.site_setting.vip_max_level = 2
        self.site_setting.vip_level_names = ["Silver", "Gold"]
        self.site_setting.save(update_fields=["vip_max_level", "vip_level_names"])
        self.user = User.objects.create_user(username="member", email="member@example.com", password="pass12345")
        self.user.groups.add(Group.objects.get_or_create(name="vip_2")[0])

    def test_business_identity_choices_follow_site_setting(self):
        form = self.form_class(instance=self.user)

        self.assertEqual(build_business_identity_choices(self.site_setting), list(form.fields["business_identity"].choices))
        self.assertEqual(form.fields["business_identity"].initial, "vip_2")

    def test_old_vip_group_is_not_selectable_after_max_level_reduction(self):
        self.site_setting.vip_max_level = 1
        self.site_setting.vip_level_names = ["Silver"]
        self.site_setting.save(update_fields=["vip_max_level", "vip_level_names"])

        form = self.form_class(instance=self.user)

        self.assertEqual(list(form.fields["business_identity"].choices), [("normal_user", _("Normal user")), ("vip_1", "Silver")])
        self.assertEqual(form.fields["business_identity"].initial, "normal_user")
        self.assertIn("preserved", form.fields["business_identity"].help_text.lower())


class ManageUserUpdateViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin", email="admin@example.com", password="admin-pass-123")
        self.user = User.objects.create_user(username="member", email="member@example.com", password="member-pass-123")
        self.url = reverse("manage-user-update", kwargs={"pk": self.user.pk})
        self.client.force_login(self.admin)
        site_setting = get_or_create_site_setting()
        site_setting.vip_max_level = 2
        site_setting.vip_level_names = ["Silver", "Gold"]
        site_setting.save(update_fields=["vip_max_level", "vip_level_names"])

    def test_selecting_vip_identity_sets_single_business_group(self):
        retained_group = Group.objects.get_or_create(name="custom_group")[0]
        legacy_vip_group = Group.objects.get_or_create(name="vip")[0]
        self.user.groups.add(retained_group, legacy_vip_group)

        response = self.client.post(
            self.url,
            {
                "username": self.user.username,
                "first_name": "",
                "email": self.user.email,
                "role_type": "member",
                "business_identity": "vip_2",
                "business_identity_touched": "1",
                "is_active": "on",
                "money": 0,
                "points": 0,
            },
        )

        self.assertRedirects(response, reverse("manage-users"))
        self.user.refresh_from_db()
        self.assertCountEqual(
            list(self.user.groups.values_list("name", flat=True)),
            ["custom_group", "vip", "vip_2"],
        )

    def test_admin_role_removes_business_groups_but_keeps_other_groups(self):
        retained_group = Group.objects.get_or_create(name="custom_group")[0]
        vip_group = Group.objects.get_or_create(name="vip_2")[0]
        self.user.groups.add(retained_group, vip_group)

        response = self.client.post(
            self.url,
            {
                "username": self.user.username,
                "first_name": "",
                "email": self.user.email,
                "role_type": "admin",
                "business_identity": "normal_user",
                "business_identity_touched": "1",
                "is_active": "on",
                "is_staff": "on",
                "is_superuser": "on",
                "money": 0,
                "points": 0,
            },
        )

        self.assertRedirects(response, reverse("manage-users"))
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)
        self.assertTrue(self.user.is_superuser)
        self.assertCountEqual(list(self.user.groups.values_list("name", flat=True)), ["custom_group"])

    def test_unavailable_vip_group_is_preserved_until_manual_change(self):
        site_setting = get_or_create_site_setting()
        site_setting.vip_max_level = 1
        site_setting.vip_level_names = ["Silver"]
        site_setting.save(update_fields=["vip_max_level", "vip_level_names"])
        self.user.groups.add(Group.objects.get_or_create(name="vip_2")[0])

        response = self.client.post(
            self.url,
            {
                "username": self.user.username,
                "first_name": "",
                "email": self.user.email,
                "role_type": "member",
                "business_identity": "normal_user",
                "is_active": "on",
                "money": 0,
                "points": 0,
            },
        )

        self.assertRedirects(response, reverse("manage-users"))
        self.user.refresh_from_db()
        self.assertIn("vip_2", list(self.user.groups.values_list("name", flat=True)))


class ManageSiteSettingViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin", email="admin@example.com", password="admin-pass-123")
        self.client.force_login(self.admin)
        self.url = reverse("manage-site-settings")

    def test_article_editor_fields_render_inside_article_section(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")

        self.assertNotIn('<h2>Article editor</h2>', content)
        self.assertIn('id="post-editor-autosave-dependent"', content)
        self.assertIn('id="audit-log-retention-dependent"', content)
        self.assertIn('data-vip-level-name-fields', content)
        self.assertIn('Enable draft autosave', content)
        self.assertIn('Draft autosave interval (minutes)', content)
        self.assertIn('Audit log retention (days)', content)
        self.assertIn('Maximum VIP level', content)
        self.assertIn('VIP 1 display name', content)

        vip_index = content.index('<h2>VIP settings</h2>')
        vip_max_index = content.index('Maximum VIP level')
        vip_name_index = content.index('VIP 1 display name')
        article_index = content.index('<h2>Article</h2>')
        autosave_index = content.index('Enable draft autosave')
        audit_index = content.index('<h2>Audit logs</h2>')
        retention_index = content.index('Audit log retention (days)')

        self.assertLess(vip_index, vip_max_index)
        self.assertLess(vip_max_index, vip_name_index)
        self.assertLess(article_index, autosave_index)
        self.assertLess(autosave_index, audit_index)
        self.assertLess(audit_index, retention_index)
        self.assertIn('<div class="user-manage-toggle-row">', content)
        self.assertIn('for="id_non_admin_max_post_count"', content)
