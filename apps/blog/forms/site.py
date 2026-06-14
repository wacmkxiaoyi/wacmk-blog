from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.models import SiteSetting


def build_default_vip_name(level):
    return f"VIP {level}"


class SiteSettingForm(forms.ModelForm):
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
        max_value=SiteSetting.VIP_MAX_LEVEL_LIMIT,
        label=_("Maximum VIP level"),
        help_text=_("Set to 0 to disable VIP support. Choose up to %(max_level)s levels.") % {"max_level": SiteSetting.VIP_MAX_LEVEL_LIMIT},
        widget=forms.NumberInput(
            attrs={
                "class": "input-control",
                "min": 0,
                "max": SiteSetting.VIP_MAX_LEVEL_LIMIT,
                "step": 1,
                "data-vip-max-level-input": "true",
            }
        ),
    )
    dashboard_visit_trend_days = forms.TypedChoiceField(
        label=_("Homepage visit trend range"),
        help_text=_("Choose how many recent days to show in the homepage visit chart."),
        choices=SiteSetting.DASHBOARD_VISIT_TREND_DAY_CHOICES,
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
    allow_comment = forms.BooleanField(
        required=False,
        label=_("Enable comment feature"),
        help_text=_("When disabled, users cannot post, reply, or edit comments on articles and books. Admins are unaffected."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    vip_only_comment = forms.BooleanField(
        required=False,
        label=_("Only VIP commenting"),
        help_text=_("When enabled, only VIP users can post, reply, and edit comments. Admins are unaffected."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )

    class Meta:
        model = SiteSetting
        fields = [
            "enable_register",
            "code_expire_seconds",
            "code_resend_seconds",
            "site_title",
            "site_icon",
            "auth_background",
            "app_background",
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
            "allow_comment",
            "vip_only_comment",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vip_level_name_fields = []
        self.vip_level_name_rows = []
        vip_max_level = self._get_requested_vip_max_level()
        vip_level_names = self._normalize_vip_level_names(SiteSetting.VIP_MAX_LEVEL_LIMIT)

        for level in range(1, SiteSetting.VIP_MAX_LEVEL_LIMIT + 1):
            field_name = f"vip_level_name_{level}"
            self.fields[field_name] = forms.CharField(
                required=False,
                label=_("VIP %(level)s display name") % {"level": level},
                help_text="",
                initial=vip_level_names[level - 1],
                widget=forms.TextInput(
                    attrs={
                        "class": "input-control",
                        "placeholder": build_default_vip_name(level),
                        "data-vip-level-name-input": "true",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.vip_level_name_fields.append(field_name)
            self.vip_level_name_rows.append(
                {
                    "field": self[field_name],
                    "level": level,
                    "hidden": level > vip_max_level,
                }
            )
        self.current_vip_max_level = vip_max_level

    def _get_requested_vip_max_level(self):
        if self.is_bound:
            raw_value = self.data.get(self.add_prefix("vip_max_level"), self.initial.get("vip_max_level", 0))
        else:
            raw_value = self.initial.get("vip_max_level", getattr(self.instance, "vip_max_level", 0))
        try:
            vip_max_level = int(raw_value)
        except (TypeError, ValueError):
            vip_max_level = getattr(self.instance, "vip_max_level", 0) or 0
        return max(0, min(vip_max_level, SiteSetting.VIP_MAX_LEVEL_LIMIT))

    def _normalize_vip_level_names(self, vip_max_level):
        stored_names = list(getattr(self.instance, "vip_level_names", []) or [])
        normalized = []
        for level in range(1, vip_max_level + 1):
            configured_name = ""
            if level - 1 < len(stored_names):
                configured_name = (stored_names[level - 1] or "").strip()
            normalized.append(configured_name or build_default_vip_name(level))
        return normalized

    def clean(self):
        cleaned_data = super().clean()
        vip_max_level = cleaned_data.get("vip_max_level")
        if vip_max_level is None:
            return cleaned_data
        cleaned_data["vip_level_names"] = [
            (cleaned_data.get(field_name) or "").strip() or build_default_vip_name(index)
            for index, field_name in enumerate(self.vip_level_name_fields, start=1)
        ][:vip_max_level]
        return cleaned_data

    def save(self, commit=True):
        site_setting = super().save(commit=False)
        site_setting.vip_level_names = self.cleaned_data.get("vip_level_names", [])

        if commit:
            site_setting.save()
            self.save_m2m()

        return site_setting
