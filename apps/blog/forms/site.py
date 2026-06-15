from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.utils.site import (
    DASHBOARD_VISIT_TREND_DAY_CHOICES,
    SITE_SETTING_DEFINITIONS,
    VIP_MAX_LEVEL_LIMIT,
    build_default_vip_config,
    get_normalized_vip_configs,
    get_site_setting,
    save_setting_file,
    set_settings,
)


def build_default_vip_name(level):
    return f"VIP {level}"


class SiteSettingForm(forms.Form):
    enable_register = forms.BooleanField(
        required=False,
        label=_("Enable registration"),
        help_text=_("When enabled, users can register new accounts via email verification."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    code_expire_seconds = forms.IntegerField(
        min_value=60,
        max_value=3600,
        label=_("Verification code expiry (seconds)"),
        help_text=_("How long before a verification code sent via email becomes invalid. Enter a value between 60 and 3600 seconds."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 60, "max": 3600, "step": 1}),
    )
    code_resend_seconds = forms.IntegerField(
        min_value=10,
        max_value=600,
        label=_("Resend cooldown (seconds)"),
        help_text=_("How long a user must wait before requesting another verification code. Enter a value between 10 and 600 seconds."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 10, "max": 600, "step": 1}),
    )
    site_title = forms.CharField(
        required=False,
        label=_("Website title"),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Leave blank to use the default site title"),
            }
        ),
        help_text=_("Shown in the browser tab and site header context where applicable."),
    )
    site_icon = forms.ImageField(
        required=False,
        label=_("Website icon"),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": "image/*"}),
        help_text=_("Used as the browser tab icon. Leave empty to keep the current icon or use the default."),
    )
    auth_background = forms.ImageField(
        required=False,
        label=_("Login page background"),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": "image/*"}),
        help_text=_("Used on login, register, and other unauthenticated auth pages."),
    )
    app_background = forms.ImageField(
        required=False,
        label=_("Authenticated page background"),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": "image/*"}),
        help_text=_("Used after sign-in across the main site and management pages."),
    )
    post_editor_autosave_enabled = forms.BooleanField(
        required=False,
        label=_("Enable draft autosave"),
        help_text=_("Automatically save article drafts in this browser while editing."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    post_editor_autosave_interval_minutes = forms.IntegerField(
        min_value=1,
        max_value=60,
        label=_("Draft autosave interval (minutes)"),
        help_text=_("How often the editor should save a local recovery draft. Enter a value between 1 and 60 minutes."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 1, "max": 60, "step": 1}),
    )
    audit_log_cleanup_enabled = forms.BooleanField(
        required=False,
        label=_("Enable scheduled audit log cleanup"),
        help_text=_("Allow the system task to automatically delete expired audit logs."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    audit_log_retention_days = forms.IntegerField(
        min_value=1,
        max_value=3650,
        label=_("Audit log retention (days)"),
        help_text=_("Audit logs older than this number of days will be removed when the cleanup task runs."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 1, "max": 3650, "step": 1}),
    )
    vip_max_level = forms.IntegerField(
        min_value=0,
        max_value=VIP_MAX_LEVEL_LIMIT,
        label=_("Maximum VIP level"),
        help_text=_("Set to 0 to disable VIP support. Choose up to %(max_level)s levels.") % {"max_level": VIP_MAX_LEVEL_LIMIT},
        widget=forms.NumberInput(
            attrs={
                "class": "input-control",
                "min": 0,
                "max": VIP_MAX_LEVEL_LIMIT,
                "step": 1,
                "data-vip-max-level-input": "true",
            }
        ),
    )
    dashboard_visit_trend_days = forms.TypedChoiceField(
        label=_("Homepage visit trend range"),
        help_text=_("Choose how many recent days to show in the homepage visit chart."),
        choices=DASHBOARD_VISIT_TREND_DAY_CHOICES,
        coerce=int,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    allow_non_admin_create_post = forms.BooleanField(
        required=False,
        label=_("Allow users to create articles"),
        help_text=_("When enabled, non-admin users can create draft articles from their profile. When disabled, article creation is hidden for everyone."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    non_admin_max_post_count = forms.IntegerField(
        min_value=0,
        initial=10,
        label=_("Maximum articles for non-admin users"),
        help_text=_("Maximum number of articles (including drafts) that non-admin users can create. Set to 0 for no limit."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "step": 1}),
    )
    vip_only_create_post = forms.BooleanField(
        required=False,
        label=_("Only VIP posting"),
        help_text=_("When enabled, only VIP users can create articles."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    allow_non_admin_create_book = forms.BooleanField(
        required=False,
        label=_("Allow users to create books"),
        help_text=_("When enabled, non-admin users can create books from their profile. When disabled, book creation is hidden for everyone."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    non_admin_max_book_count = forms.IntegerField(
        min_value=0,
        initial=3,
        label=_("Maximum books for non-admin users"),
        help_text=_("Maximum number of books that non-admin users can create. Set to 0 for no limit."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "step": 1}),
    )
    vip_only_create_book = forms.BooleanField(
        required=False,
        label=_("Only VIP create"),
        help_text=_("When enabled, only VIP users can create books."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    attachment_max_size_mb = forms.IntegerField(
        min_value=1,
        initial=1,
        label=_("Maximum attachment size (MB)"),
        help_text=_("Maximum allowed size for a single uploaded attachment. Default is 1 MB."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 1, "step": 1}),
    )
    allow_user_upload_attachment = forms.BooleanField(
        required=False,
        label=_("Allow users to upload attachments"),
        help_text=_("When enabled, non-admin users can upload and reuse attachments from article and comment editors."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    vip_only_upload_attachment = forms.BooleanField(
        required=False,
        label=_("Only VIP upload"),
        help_text=_("When enabled, only VIP users can upload and insert attachments. Admins are unaffected."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    allow_user_comment = forms.BooleanField(
        required=False,
        label=_("Allow users to comment"),
        help_text=_("When disabled, users cannot post, reply, or edit comments on articles and books. Admins are unaffected."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    vip_only_comment = forms.BooleanField(
        required=False,
        label=_("Only VIP commenting"),
        help_text=_("When enabled, only VIP users can post, reply, and edit comments. Admins are unaffected."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    comment_first_reward_money = forms.IntegerField(
        required=False,
        min_value=0,
        initial=1,
        label=_("First comment reward money"),
        help_text=_("When a user posts their first comment on an article, reward this amount of money. Set to 0 to disable."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "step": 1}),
    )
    comment_first_reward_points = forms.IntegerField(
        required=False,
        min_value=0,
        initial=1,
        label=_("First comment reward points"),
        help_text=_("When a user posts their first comment on an article, reward this amount of points. Set to 0 to disable."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "step": 1}),
    )
    daily_login_reward_money = forms.IntegerField(
        required=False,
        min_value=0,
        initial=10,
        label=_("Daily first login reward money"),
        help_text=_("When a user logs in for the first time each day, reward this amount of money. Set to 0 to disable money rewards."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "step": 1}),
    )
    daily_login_reward_points = forms.IntegerField(
        required=False,
        min_value=0,
        initial=10,
        label=_("Daily first login reward points"),
        help_text=_("When a user logs in for the first time each day, reward this amount of points. Set to 0 to disable points rewards."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "step": 1}),
    )
    article_author_reward_money_ratio = forms.DecimalField(
        required=False,
        min_value=0,
        max_value=1,
        decimal_places=2,
        label=_("Article author money reward ratio"),
        help_text=_("When a reader first enters an article, reward the author this share of the money requirement. Enter a value between 0 and 1."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "max": 1, "step": 0.01}),
    )
    article_author_reward_points_ratio = forms.DecimalField(
        required=False,
        min_value=0,
        max_value=1,
        decimal_places=2,
        label=_("Article author points reward ratio"),
        help_text=_("When a reader first enters an article, reward the author this share of the points requirement. Enter a value between 0 and 1."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "max": 1, "step": 0.01}),
    )
    book_author_reward_money_ratio = forms.DecimalField(
        required=False,
        min_value=0,
        max_value=1,
        decimal_places=2,
        label=_("Book author money reward ratio"),
        help_text=_("When a reader first enters a book, reward the author this share of the money requirement. Enter a value between 0 and 1."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "max": 1, "step": 0.01}),
    )
    book_author_reward_points_ratio = forms.DecimalField(
        required=False,
        min_value=0,
        max_value=1,
        decimal_places=2,
        label=_("Book author points reward ratio"),
        help_text=_("When a reader first enters a book, reward the author this share of the points requirement. Enter a value between 0 and 1."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "max": 1, "step": 0.01}),
    )
    attachment_author_reward_money_ratio = forms.DecimalField(
        required=False,
        min_value=0,
        max_value=1,
        decimal_places=2,
        label=_("Attachment author money reward ratio"),
        help_text=_("When a reader first downloads an attachment, reward the author this share of the money requirement. Enter a value between 0 and 1."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "max": 1, "step": 0.01}),
    )
    attachment_author_reward_points_ratio = forms.DecimalField(
        required=False,
        min_value=0,
        max_value=1,
        decimal_places=2,
        label=_("Attachment author points reward ratio"),
        help_text=_("When a reader first downloads an attachment, reward the author this share of the points requirement. Enter a value between 0 and 1."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "max": 1, "step": 0.01}),
    )

    SETTING_FIELDS = [
        "enable_register",
        "code_expire_seconds",
        "code_resend_seconds",
        "site_title",
        "post_editor_autosave_enabled",
        "post_editor_autosave_interval_minutes",
        "audit_log_cleanup_enabled",
        "audit_log_retention_days",
        "vip_max_level",
        "dashboard_visit_trend_days",
        "allow_non_admin_create_post",
        "non_admin_max_post_count",
        "vip_only_create_post",
        "allow_non_admin_create_book",
        "non_admin_max_book_count",
        "vip_only_create_book",
        "attachment_max_size_mb",
        "allow_user_upload_attachment",
        "vip_only_upload_attachment",
        "allow_user_comment",
        "vip_only_comment",
        "comment_first_reward_money",
        "comment_first_reward_points",
        "daily_login_reward_money",
        "daily_login_reward_points",
        "article_author_reward_money_ratio",
        "article_author_reward_points_ratio",
        "book_author_reward_money_ratio",
        "book_author_reward_points_ratio",
        "attachment_author_reward_money_ratio",
        "attachment_author_reward_points_ratio",
    ]

    def __init__(self, *args, **kwargs):
        self.settings = kwargs.pop("settings", None) or get_site_setting()
        super().__init__(*args, **kwargs)
        for field_name in self.SETTING_FIELDS:
            initial_value = self.settings.get(field_name, SITE_SETTING_DEFINITIONS[field_name]["default"])
            self.fields[field_name].initial = initial_value
            self.initial[field_name] = initial_value
        self.vip_level_rows = []
        vip_max_level = self._get_requested_vip_max_level()
        vip_configs = get_normalized_vip_configs(self.settings)

        for level in range(1, VIP_MAX_LEVEL_LIMIT + 1):
            default_config = build_default_vip_config(level)
            config = vip_configs[level - 1] if level - 1 < len(vip_configs) else default_config
            display_name_field_name = f"vip_level_display_name_{level}"
            money_discount_field_name = f"vip_level_money_discount_{level}"
            points_discount_field_name = f"vip_level_points_discount_{level}"
            daily_login_bonus_money_field_name = f"vip_level_daily_login_bonus_money_{level}"
            daily_login_bonus_points_field_name = f"vip_level_daily_login_bonus_points_{level}"
            first_comment_bonus_money_field_name = f"vip_level_first_comment_bonus_money_{level}"
            first_comment_bonus_points_field_name = f"vip_level_first_comment_bonus_points_{level}"

            self.fields[display_name_field_name] = forms.CharField(
                required=False,
                label=_("Display name"),
                help_text="",
                initial=config["display_name"],
                widget=forms.TextInput(
                    attrs={
                        "class": "input-control",
                        "placeholder": build_default_vip_name(level),
                        "data-vip-config-input": "display_name",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.fields[money_discount_field_name] = forms.DecimalField(
                required=False,
                min_value=0,
                max_value=1,
                decimal_places=2,
                label=_("Money discount"),
                help_text=_("Enter a value between 0 and 1. For example, 0.10 means the user pays 90%% of the original money requirement."),
                initial=config["money_discount"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "max": 1,
                        "step": 0.01,
                        "data-vip-config-input": "money_discount",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.fields[points_discount_field_name] = forms.DecimalField(
                required=False,
                min_value=0,
                max_value=1,
                decimal_places=2,
                label=_("Points discount"),
                help_text=_("Enter a value between 0 and 1. For example, 0.05 means the user needs 95%% of the original points requirement."),
                initial=config["points_discount"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "max": 1,
                        "step": 0.01,
                        "data-vip-config-input": "points_discount",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.fields[daily_login_bonus_money_field_name] = forms.IntegerField(
                required=False,
                min_value=0,
                label=_("Daily login extra money"),
                help_text=_("Extra daily login money granted to users at this VIP level. Leave blank to use the default of level x 5."),
                initial=config["daily_login_bonus_money"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "step": 1,
                        "data-vip-config-input": "daily_login_bonus_money",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.fields[daily_login_bonus_points_field_name] = forms.IntegerField(
                required=False,
                min_value=0,
                label=_("Daily login extra points"),
                help_text=_("Extra daily login points granted to users at this VIP level. Leave blank to use the default of level x 5."),
                initial=config["daily_login_bonus_points"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "step": 1,
                        "data-vip-config-input": "daily_login_bonus_points",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.fields[first_comment_bonus_money_field_name] = forms.IntegerField(
                required=False,
                min_value=0,
                label=_("First comment extra money"),
                help_text=_("Extra first comment money granted to users at this VIP level. Leave blank to use the default of level x 2."),
                initial=config["first_comment_bonus_money"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "step": 1,
                        "data-vip-config-input": "first_comment_bonus_money",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.fields[first_comment_bonus_points_field_name] = forms.IntegerField(
                required=False,
                min_value=0,
                label=_("First comment extra points"),
                help_text=_("Extra first comment points granted to users at this VIP level. Leave blank to use the default of level x 2."),
                initial=config["first_comment_bonus_points"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "step": 1,
                        "data-vip-config-input": "first_comment_bonus_points",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.vip_level_rows.append(
                {
                    "level": level,
                    "hidden": level > vip_max_level,
                    "title": config["display_name"] or build_default_vip_name(level),
                    "display_name_field": self[display_name_field_name],
                    "money_discount_field": self[money_discount_field_name],
                    "points_discount_field": self[points_discount_field_name],
                    "daily_login_bonus_money_field": self[daily_login_bonus_money_field_name],
                    "daily_login_bonus_points_field": self[daily_login_bonus_points_field_name],
                    "first_comment_bonus_money_field": self[first_comment_bonus_money_field_name],
                    "first_comment_bonus_points_field": self[first_comment_bonus_points_field_name],
                }
            )
        self.current_vip_max_level = vip_max_level

    def _get_requested_vip_max_level(self):
        if self.is_bound:
            raw_value = self.data.get(self.add_prefix("vip_max_level"), self.initial.get("vip_max_level", 0))
        else:
            raw_value = self.initial.get("vip_max_level", self.settings.get("vip_max_level", 0))
        try:
            vip_max_level = int(raw_value)
        except (TypeError, ValueError):
            vip_max_level = self.settings.get("vip_max_level", 0) or 0
        return max(0, min(vip_max_level, VIP_MAX_LEVEL_LIMIT))

    def clean(self):
        cleaned_data = super().clean()
        vip_max_level = cleaned_data.get("vip_max_level")
        ratio_defaults = {
            "comment_first_reward_money": 1,
            "comment_first_reward_points": 1,
            "daily_login_reward_money": 10,
            "daily_login_reward_points": 10,
            "article_author_reward_money_ratio": 0.8,
            "article_author_reward_points_ratio": 0,
            "book_author_reward_money_ratio": 0.8,
            "book_author_reward_points_ratio": 0,
            "attachment_author_reward_money_ratio": 0.8,
            "attachment_author_reward_points_ratio": 0,
        }
        for field_name, fallback in ratio_defaults.items():
            if cleaned_data.get(field_name) in (None, ""):
                cleaned_data[field_name] = self.settings.get(field_name, fallback)
        if vip_max_level is None:
            return cleaned_data
        vip_configs = []
        for level in range(1, vip_max_level + 1):
            default_config = build_default_vip_config(level)
            display_name = (cleaned_data.get(f"vip_level_display_name_{level}") or "").strip() or build_default_vip_name(level)
            money_discount = cleaned_data.get(f"vip_level_money_discount_{level}")
            points_discount = cleaned_data.get(f"vip_level_points_discount_{level}")
            daily_login_bonus_money = cleaned_data.get(f"vip_level_daily_login_bonus_money_{level}")
            daily_login_bonus_points = cleaned_data.get(f"vip_level_daily_login_bonus_points_{level}")
            first_comment_bonus_money = cleaned_data.get(f"vip_level_first_comment_bonus_money_{level}")
            first_comment_bonus_points = cleaned_data.get(f"vip_level_first_comment_bonus_points_{level}")
            vip_configs.append(
                {
                    "display_name": display_name,
                    "money_discount": money_discount if money_discount not in (None, "") else default_config["money_discount"],
                    "points_discount": points_discount if points_discount not in (None, "") else default_config["points_discount"],
                    "daily_login_bonus_money": (
                        daily_login_bonus_money
                        if daily_login_bonus_money not in (None, "")
                        else default_config["daily_login_bonus_money"]
                    ),
                    "daily_login_bonus_points": (
                        daily_login_bonus_points
                        if daily_login_bonus_points not in (None, "")
                        else default_config["daily_login_bonus_points"]
                    ),
                    "first_comment_bonus_money": (
                        first_comment_bonus_money
                        if first_comment_bonus_money not in (None, "")
                        else default_config["first_comment_bonus_money"]
                    ),
                    "first_comment_bonus_points": (
                        first_comment_bonus_points
                        if first_comment_bonus_points not in (None, "")
                        else default_config["first_comment_bonus_points"]
                    ),
                }
            )
        cleaned_data["vip_configs"] = vip_configs
        return cleaned_data

    def save(self):
        payload = {field_name: self.cleaned_data[field_name] for field_name in self.SETTING_FIELDS}
        payload["vip_configs"] = self.cleaned_data.get("vip_configs", [])
        payload["vip_level_names"] = [config["display_name"] for config in payload["vip_configs"]]

        for file_field in ("site_icon", "auth_background", "app_background"):
            uploaded = self.cleaned_data.get(file_field)
            if uploaded:
                save_setting_file(file_field, uploaded)

        set_settings(payload)
        self.settings = get_site_setting()
        return self.settings
