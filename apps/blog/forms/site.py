from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.models import SiteSetting


class SiteSettingForm(forms.ModelForm):
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
    dashboard_visit_trend_days = forms.TypedChoiceField(
        label=_("Homepage visit trend range"),
        help_text=_("Choose how many recent days to show in the homepage visit chart."),
        choices=SiteSetting.DASHBOARD_VISIT_TREND_DAY_CHOICES,
        coerce=int,
        widget=forms.Select(attrs={"class": "input-control"}),
    )

    class Meta:
        model = SiteSetting
        fields = [
            "site_title",
            "site_icon",
            "auth_background",
            "app_background",
            "post_editor_autosave_enabled",
            "post_editor_autosave_interval_minutes",
            "audit_log_cleanup_enabled",
            "audit_log_retention_days",
            "dashboard_visit_trend_days",
        ]

    def save(self, commit=True):
        site_setting = super().save(commit=False)

        if commit:
            site_setting.save()
            self.save_m2m()

        return site_setting
