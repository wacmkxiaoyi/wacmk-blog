from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from django.utils.translation import gettext as _

from apps.blog.models import UserMoneyHistory, UserPointsHistory
from apps.blog.utils import DASHBOARD_VISIT_TREND_DAYS_7, build_business_identity_choices, get_or_create_site_setting, set_settings
from apps.blog.utils.site import build_user_business_identity_summary, get_user_vip_discounts


User = get_user_model()


class SiteSettingFormTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from apps.blog.forms.site import SiteSettingForm

        cls.form_class = SiteSettingForm

    def build_form_data(self, **overrides):
        data = {
            "site_title": "",
            "enable_register": "",
            "code_expire_seconds": 600,
            "code_resend_seconds": 60,
            "post_editor_autosave_enabled": "on",
            "post_editor_autosave_interval_minutes": 5,
            "audit_log_cleanup_enabled": "on",
            "audit_log_retention_days": 30,
            "vip_max_level": 3,
            "dashboard_visit_trend_days": DASHBOARD_VISIT_TREND_DAYS_7,
            "non_admin_max_post_count": 10,
            "non_admin_max_book_count": 3,
            "attachment_max_size_mb": 1,
            "allow_user_comment": "on",
            "comment_first_reward_money": "1",
            "comment_first_reward_points": "1",
            "article_author_reward_money_ratio": "0.8",
            "article_author_reward_points_ratio": "0",
            "book_author_reward_money_ratio": "0.8",
            "book_author_reward_points_ratio": "0",
            "attachment_author_reward_money_ratio": "0.8",
            "attachment_author_reward_points_ratio": "0",
            "vip_level_display_name_1": "VIP 1",
            "vip_level_money_discount_1": "0.10",
            "vip_level_points_discount_1": "0.05",
            "vip_level_daily_login_bonus_money_1": "5",
            "vip_level_daily_login_bonus_points_1": "5",
            "vip_level_first_comment_bonus_money_1": "2",
            "vip_level_first_comment_bonus_points_1": "2",
            "vip_level_display_name_2": "VIP 2",
            "vip_level_money_discount_2": "0.20",
            "vip_level_points_discount_2": "0.10",
            "vip_level_daily_login_bonus_money_2": "10",
            "vip_level_daily_login_bonus_points_2": "10",
            "vip_level_first_comment_bonus_money_2": "4",
            "vip_level_first_comment_bonus_points_2": "4",
            "vip_level_display_name_3": "VIP 3",
            "vip_level_money_discount_3": "0.30",
            "vip_level_points_discount_3": "0.15",
            "vip_level_daily_login_bonus_money_3": "15",
            "vip_level_daily_login_bonus_points_3": "15",
            "vip_level_first_comment_bonus_money_3": "6",
            "vip_level_first_comment_bonus_points_3": "6",
        }
        data.update(overrides)
        return data

    def test_saves_default_vip_configs_when_fields_are_blank(self):
        form = self.form_class(
            data=self.build_form_data(
                vip_max_level=3,
                vip_level_display_name_1="",
                vip_level_display_name_2="Gold",
                vip_level_display_name_3="",
            ),
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(saved_setting["vip_max_level"], 3)
        self.assertEqual(
            saved_setting["vip_configs"],
            [
                {"display_name": "VIP 1", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2},
                {"display_name": "Gold", "money_discount": "0.20", "points_discount": "0.10", "daily_login_bonus_money": 10, "daily_login_bonus_points": 10, "first_comment_bonus_money": 4, "first_comment_bonus_points": 4},
                {"display_name": "VIP 3", "money_discount": "0.30", "points_discount": "0.15", "daily_login_bonus_money": 15, "daily_login_bonus_points": 15, "first_comment_bonus_money": 6, "first_comment_bonus_points": 6},
            ],
        )

    def test_hides_vip_configs_when_feature_is_disabled(self):
        set_settings(
            {
                "vip_max_level": 3,
                "vip_configs": [
                    {"display_name": "VIP 1", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2},
                    {"display_name": "Gold", "money_discount": "0.20", "points_discount": "0.10", "daily_login_bonus_money": 10, "daily_login_bonus_points": 10, "first_comment_bonus_money": 4, "first_comment_bonus_points": 4},
                    {"display_name": "VIP 3", "money_discount": "0.30", "points_discount": "0.15", "daily_login_bonus_money": 15, "daily_login_bonus_points": 15, "first_comment_bonus_money": 6, "first_comment_bonus_points": 6},
                ],
            }
        )
        form = self.form_class(
            data=self.build_form_data(vip_max_level=0),
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(saved_setting["vip_max_level"], 0)
        self.assertEqual(saved_setting["vip_configs"], [])

    def test_uses_legacy_vip_level_names_as_display_name_fallback(self):
        set_settings({"vip_max_level": 2, "vip_level_names": ["Silver", "Gold"]})

        form = self.form_class()

        self.assertEqual(form.fields["vip_level_display_name_1"].initial, "Silver")
        self.assertEqual(form.fields["vip_level_display_name_2"].initial, "Gold")

    def test_vip_daily_login_bonus_defaults_to_level_times_five(self):
        form = self.form_class()

        self.assertEqual(form.fields["vip_level_daily_login_bonus_money_1"].initial, 5)
        self.assertEqual(form.fields["vip_level_daily_login_bonus_points_1"].initial, 5)
        self.assertEqual(form.fields["vip_level_daily_login_bonus_money_2"].initial, 10)
        self.assertEqual(form.fields["vip_level_daily_login_bonus_points_2"].initial, 10)

    def test_vip_first_comment_bonus_defaults_to_level_times_two(self):
        form = self.form_class()

        self.assertEqual(form.fields["vip_level_first_comment_bonus_money_1"].initial, 2)
        self.assertEqual(form.fields["vip_level_first_comment_bonus_points_1"].initial, 2)
        self.assertEqual(form.fields["vip_level_first_comment_bonus_money_2"].initial, 4)
        self.assertEqual(form.fields["vip_level_first_comment_bonus_points_2"].initial, 4)

    def test_saves_custom_vip_discounts(self):
        form = self.form_class(
            data=self.build_form_data(
                vip_max_level=2,
                vip_level_display_name_1="Silver",
                vip_level_money_discount_1="0.25",
                vip_level_points_discount_1="0.15",
                vip_level_daily_login_bonus_money_1="9",
                vip_level_daily_login_bonus_points_1="8",
                vip_level_first_comment_bonus_money_1="7",
                vip_level_first_comment_bonus_points_1="6",
                vip_level_display_name_2="Gold",
                vip_level_money_discount_2="0.40",
                vip_level_points_discount_2="0.30",
                vip_level_daily_login_bonus_money_2="20",
                vip_level_daily_login_bonus_points_2="18",
                vip_level_first_comment_bonus_money_2="13",
                vip_level_first_comment_bonus_points_2="12",
            )
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(
            saved_setting["vip_configs"],
            [
                {"display_name": "Silver", "money_discount": "0.25", "points_discount": "0.15", "daily_login_bonus_money": 9, "daily_login_bonus_points": 8, "first_comment_bonus_money": 7, "first_comment_bonus_points": 6},
                {"display_name": "Gold", "money_discount": "0.40", "points_discount": "0.30", "daily_login_bonus_money": 20, "daily_login_bonus_points": 18, "first_comment_bonus_money": 13, "first_comment_bonus_points": 12},
            ],
        )

    def test_old_vip_config_without_bonus_fields_uses_defaults(self):
        set_settings(
            {
                "vip_max_level": 2,
                "vip_configs": [
                    {"display_name": "Silver", "money_discount": "0.10", "points_discount": "0.05"},
                    {"display_name": "Gold", "money_discount": "0.20", "points_discount": "0.10"},
                ],
            }
        )

        form = self.form_class()

        self.assertEqual(form.fields["vip_level_daily_login_bonus_money_1"].initial, 5)
        self.assertEqual(form.fields["vip_level_daily_login_bonus_points_1"].initial, 5)
        self.assertEqual(form.fields["vip_level_daily_login_bonus_money_2"].initial, 10)
        self.assertEqual(form.fields["vip_level_daily_login_bonus_points_2"].initial, 10)
        self.assertEqual(form.fields["vip_level_first_comment_bonus_money_1"].initial, 2)
        self.assertEqual(form.fields["vip_level_first_comment_bonus_points_1"].initial, 2)
        self.assertEqual(form.fields["vip_level_first_comment_bonus_money_2"].initial, 4)
        self.assertEqual(form.fields["vip_level_first_comment_bonus_points_2"].initial, 4)

    def test_author_reward_ratios_default_to_expected_values(self):
        form = self.form_class()

        self.assertEqual(form.initial["article_author_reward_money_ratio"], Decimal("0.8"))
        self.assertEqual(form.initial["article_author_reward_points_ratio"], Decimal("0"))
        self.assertEqual(form.initial["book_author_reward_money_ratio"], Decimal("0.8"))
        self.assertEqual(form.initial["book_author_reward_points_ratio"], Decimal("0"))
        self.assertEqual(form.initial["attachment_author_reward_money_ratio"], Decimal("0.8"))
        self.assertEqual(form.initial["attachment_author_reward_points_ratio"], Decimal("0"))

    def test_saves_author_reward_ratios(self):
        form = self.form_class(
            data=self.build_form_data(
                vip_max_level=0,
                article_author_reward_money_ratio="0.75",
                article_author_reward_points_ratio="0.25",
                book_author_reward_money_ratio="0.5",
                book_author_reward_points_ratio="0.1",
                attachment_author_reward_money_ratio="0.6",
                attachment_author_reward_points_ratio="0.2",
            ),
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(saved_setting["article_author_reward_money_ratio"], Decimal("0.75"))
        self.assertEqual(saved_setting["article_author_reward_points_ratio"], Decimal("0.25"))
        self.assertEqual(saved_setting["book_author_reward_money_ratio"], Decimal("0.5"))
        self.assertEqual(saved_setting["book_author_reward_points_ratio"], Decimal("0.1"))
        self.assertEqual(saved_setting["attachment_author_reward_money_ratio"], Decimal("0.6"))
        self.assertEqual(saved_setting["attachment_author_reward_points_ratio"], Decimal("0.2"))

    def test_saves_allow_user_comment_setting(self):
        form = self.form_class(
            data=self.build_form_data(
                vip_max_level=0,
                allow_user_comment="",
            ),
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertFalse(saved_setting["allow_user_comment"])

    def test_first_comment_rewards_default_to_expected_values(self):
        form = self.form_class()

        self.assertEqual(form.initial["comment_first_reward_money"], 1)
        self.assertEqual(form.initial["comment_first_reward_points"], 1)

    def test_daily_login_rewards_default_to_expected_values(self):
        form = self.form_class()

        self.assertEqual(form.initial["daily_login_reward_money"], 10)
        self.assertEqual(form.initial["daily_login_reward_points"], 10)

    def test_saves_first_comment_rewards(self):
        form = self.form_class(
            data=self.build_form_data(
                vip_max_level=0,
                comment_first_reward_money="3",
                comment_first_reward_points="5",
            ),
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(saved_setting["comment_first_reward_money"], 3)
        self.assertEqual(saved_setting["comment_first_reward_points"], 5)

    def test_saves_daily_login_rewards(self):
        form = self.form_class(
            data=self.build_form_data(
                vip_max_level=0,
                daily_login_reward_money="12",
                daily_login_reward_points="15",
            ),
        )

        self.assertTrue(form.is_valid(), form.errors)
        saved_setting = form.save()

        self.assertEqual(saved_setting["daily_login_reward_money"], 12)
        self.assertEqual(saved_setting["daily_login_reward_points"], 15)


class UserManageFormTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from apps.blog.forms.manage import UserManageForm

        cls.form_class = UserManageForm

    def setUp(self):
        set_settings({
            "vip_max_level": 2,
            "vip_configs": [
                {"display_name": "Silver", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5},
                {"display_name": "Gold", "money_discount": "0.20", "points_discount": "0.10", "daily_login_bonus_money": 10, "daily_login_bonus_points": 10, "first_comment_bonus_money": 4, "first_comment_bonus_points": 4},
            ],
        })
        self.site_setting = get_or_create_site_setting()
        self.user = User.objects.create_user(username="member", email="member@example.com", password="pass12345")
        self.user.groups.add(Group.objects.get_or_create(name="vip_2")[0])

    def test_business_identity_choices_follow_site_setting(self):
        form = self.form_class(instance=self.user)

        self.assertEqual(build_business_identity_choices(self.site_setting), list(form.fields["business_identity"].choices))
        self.assertEqual(form.fields["business_identity"].initial, "vip_2")

    def test_old_vip_group_is_not_selectable_after_max_level_reduction(self):
        set_settings({
            "vip_max_level": 1,
            "vip_configs": [
                {"display_name": "Silver", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2},
            ],
        })

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
        set_settings({
            "vip_max_level": 2,
            "vip_configs": [
                {"display_name": "Silver", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2},
                {"display_name": "Gold", "money_discount": "0.20", "points_discount": "0.10", "daily_login_bonus_money": 10, "daily_login_bonus_points": 10, "first_comment_bonus_money": 4, "first_comment_bonus_points": 4},
            ],
        })

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

    def test_admin_role_keeps_business_groups_when_vip_selected(self):
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
                "business_identity": "vip_2",
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
        self.assertCountEqual(list(self.user.groups.values_list("name", flat=True)), ["custom_group", "vip_2"])
        self.assertEqual(build_user_business_identity_summary(self.user)["label"], "Gold")
        self.assertEqual(get_user_vip_discounts(self.user)["vip_level"], 2)

    def test_money_adjustment_creates_money_history_record(self):
        response = self.client.post(
            self.url,
            {
                "username": self.user.username,
                "first_name": "",
                "email": self.user.email,
                "role_type": "member",
                "business_identity": "normal_user",
                "business_identity_touched": "1",
                "is_active": "on",
                "money": 25,
                "points": 0,
            },
        )

        self.assertRedirects(response, reverse("manage-users"))
        record = UserMoneyHistory.objects.get(user=self.user, reason_type=UserMoneyHistory.REASON_ADMIN_ADJUSTMENT)
        self.assertEqual(record.change_amount, 25)
        self.assertEqual(record.balance_after, 25)

    def test_points_adjustment_creates_points_history_record(self):
        response = self.client.post(
            self.url,
            {
                "username": self.user.username,
                "first_name": "",
                "email": self.user.email,
                "role_type": "member",
                "business_identity": "normal_user",
                "business_identity_touched": "1",
                "is_active": "on",
                "money": 0,
                "points": 25,
            },
        )

        self.assertRedirects(response, reverse("manage-users"))
        record = UserPointsHistory.objects.get(user=self.user, reason_type=UserPointsHistory.REASON_ADMIN_ADJUSTMENT)
        self.assertEqual(record.change_amount, 25)
        self.assertEqual(record.balance_after, 25)
        self.assertIn("Admin adjusted points: 0 -> 25", record.reason_text)

    def test_admin_role_preserves_unavailable_business_identity_until_manual_change(self):
        set_settings({
            "vip_max_level": 1,
            "vip_configs": [
                {"display_name": "Silver", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5},
            ],
        })
        retained_group = Group.objects.get_or_create(name="custom_group")[0]
        unavailable_vip_group = Group.objects.get_or_create(name="vip_2")[0]
        self.user.groups.add(retained_group, unavailable_vip_group)

        response = self.client.post(
            self.url,
            {
                "username": self.user.username,
                "first_name": "",
                "email": self.user.email,
                "role_type": "admin",
                "business_identity": "normal_user",
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
        self.assertCountEqual(list(self.user.groups.values_list("name", flat=True)), ["custom_group", "vip_2"])

    def test_admin_role_with_vip_identity_renders_admin_and_vip_labels(self):
        self.user.is_staff = True
        self.user.is_superuser = True
        self.user.save(update_fields=["is_staff", "is_superuser"])
        self.user.groups.add(Group.objects.get_or_create(name="vip_2")[0])

        response = self.client.get(reverse("user-namecard", kwargs={"user_id": self.user.pk}))

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Administrator", content)
        self.assertIn("Gold", content)

    def test_unavailable_vip_group_is_preserved_until_manual_change(self):
        set_settings({
            "vip_max_level": 1,
            "vip_configs": [
                {"display_name": "Silver", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2},
            ],
        })
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
        form = response.context["form"]

        self.assertNotIn('<h2>Article editor</h2>', content)
        self.assertIn('id="post-editor-autosave-dependent"', content)
        self.assertIn('id="audit-log-retention-dependent"', content)
        self.assertIn('data-vip-config-fields', content)
        self.assertIn(str(form.fields["post_editor_autosave_enabled"].label), content)
        self.assertIn(str(form.fields["post_editor_autosave_interval_minutes"].label), content)
        self.assertIn(str(form.fields["audit_log_retention_days"].label), content)
        self.assertIn(str(form.fields["vip_max_level"].label), content)
        self.assertIn(str(form.fields["vip_level_display_name_1"].label), content)
        self.assertIn(str(form.fields["vip_level_money_discount_1"].label), content)
        self.assertIn(str(form.fields["vip_level_points_discount_1"].label), content)
        self.assertIn(str(form.fields["vip_level_daily_login_bonus_money_1"].label), content)
        self.assertIn(str(form.fields["vip_level_daily_login_bonus_points_1"].label), content)
        self.assertIn(str(form.fields["vip_level_first_comment_bonus_money_1"].label), content)
        self.assertIn(str(form.fields["vip_level_first_comment_bonus_points_1"].label), content)
        self.assertIn(str(form.fields["allow_user_comment"].label), content)
        self.assertIn(str(form.fields["daily_login_reward_money"].label), content)
        self.assertIn(str(form.fields["daily_login_reward_points"].label), content)

        basic_index = content.index('<h2>Basic information</h2>')
        dashboard_index = content.index('<h2>Dashboard</h2>')
        user_index = content.index('<h2>User</h2>')
        daily_login_money_index = content.index(str(form.fields["daily_login_reward_money"].label))
        daily_login_points_index = content.index(str(form.fields["daily_login_reward_points"].label))
        vip_index = content.index('<h2>VIP</h2>')
        vip_max_index = content.index(str(form.fields["vip_max_level"].label))
        vip_name_index = content.index(str(form.fields["vip_level_display_name_1"].label))
        article_index = content.index('<h2>Article</h2>')
        autosave_index = content.index(str(form.fields["post_editor_autosave_enabled"].label))
        audit_index = content.index('<h2>Audit logs</h2>')
        retention_index = content.index(str(form.fields["audit_log_retention_days"].label))

        self.assertLess(basic_index, dashboard_index)
        self.assertLess(dashboard_index, user_index)
        self.assertLess(user_index, daily_login_money_index)
        self.assertLess(daily_login_money_index, daily_login_points_index)
        self.assertLess(daily_login_points_index, vip_index)
        self.assertLess(vip_index, vip_max_index)
        self.assertLess(vip_max_index, vip_name_index)
        self.assertLess(article_index, autosave_index)
        self.assertLess(autosave_index, audit_index)
        self.assertLess(audit_index, retention_index)
        self.assertIn('<div class="user-manage-toggle-row">', content)
        self.assertIn('for="id_non_admin_max_post_count"', content)


class ProfileUserGroupSectionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="member", email="member@example.com", password="member-pass-123")
        self.client.force_login(self.user)
        set_settings(
            {
                "vip_max_level": 2,
                "allow_non_admin_create_post": True,
                "vip_only_create_post": True,
                "allow_user_comment": True,
                "vip_only_comment": False,
                "allow_non_admin_create_book": False,
                "vip_only_create_book": False,
                "allow_user_upload_attachment": True,
                "vip_only_upload_attachment": True,
                "vip_configs": [
                    {
                        "display_name": "Silver",
                        "money_discount": "0.10",
                        "points_discount": "0.05",
                        "daily_login_bonus_money": 5,
                        "daily_login_bonus_points": 0,
                        "first_comment_bonus_money": 2,
                        "first_comment_bonus_points": 0,
                    },
                    {
                        "display_name": "Gold",
                        "money_discount": "0.25",
                        "points_discount": "0.15",
                        "daily_login_bonus_money": 10,
                        "daily_login_bonus_points": 8,
                        "first_comment_bonus_money": 4,
                        "first_comment_bonus_points": 3,
                    },
                ],
            }
        )

    def test_profile_nav_contains_user_group_section_after_security(self):
        response = self.client.get(reverse("profile"))

        self.assertEqual(response.status_code, 200)
        nav_items = response.context["profile_nav"]
        self.assertEqual(nav_items[1]["section"], "security")
        self.assertEqual(nav_items[2]["section"], "money-history")
        self.assertEqual(nav_items[3]["section"], "points-history")
        self.assertEqual(nav_items[4]["section"], "user-group")

    def test_money_history_page_renders_records(self):
        UserMoneyHistory.objects.create(
            user=self.user,
            change_amount=10,
            balance_after=10,
            reason_type=UserMoneyHistory.REASON_DAILY_LOGIN_REWARD,
            reason_text="Daily login reward",
        )

        response = self.client.get(reverse("profile-money-history"))

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn(f'<h1>{str(_("Money history"))}</h1>', content)
        self.assertIn("Daily login reward", content)
        self.assertIn(">+10<", content)

    def test_points_history_page_renders_records(self):
        UserPointsHistory.objects.create(
            user=self.user,
            change_amount=8,
            balance_after=8,
            reason_type=UserPointsHistory.REASON_DAILY_LOGIN_REWARD,
            reason_text="Daily login reward",
        )

        response = self.client.get(reverse("profile-points-history"))

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn(f'<h1>{str(_("Points history"))}</h1>', content)
        self.assertIn("Daily login reward", content)
        self.assertIn(">+8<", content)

    def test_user_group_page_renders_table_with_current_vip_highlight(self):
        self.user.groups.add(Group.objects.get_or_create(name="vip_2")[0])

        response = self.client.get(f"{reverse('profile')}?section=user-group")

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn(f'<h1>{str(_("User group"))}</h1>', content)
        self.assertIn("profile-user-group-table-wrap", content)
        self.assertIn('class="profile-user-group-heading is-vip">Silver</span>', content)
        self.assertIn('class="profile-user-group-heading is-vip">Gold</span>', content)
        self.assertIn('-25%', content)
        self.assertIn('>8<', content)
        self.assertIn('>3<', content)
        self.assertIn('class="is-current"><span class="profile-user-group-heading is-vip">Gold</span>', content)
        self.assertNotIn("profile-user-group-indicator", content)

    def test_user_group_page_shows_only_normal_user_column_when_vip_disabled(self):
        set_settings({"vip_max_level": 0})

        response = self.client.get(f"{reverse('profile')}?section=user-group")

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn(str(_("Normal user")), content)
        self.assertNotIn("Silver", content)
        self.assertNotIn("Gold", content)
        self.assertNotIn("-25%", content)
