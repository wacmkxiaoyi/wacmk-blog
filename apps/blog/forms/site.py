import json
from decimal import Decimal

from django import forms
from django.core.validators import URLValidator
from django.utils.translation import gettext_lazy as _

from apps.blog.utils.site import (
    DASHBOARD_VISIT_TREND_DAY_CHOICES,
    LIVE2D_PAGE_GROUP_ARTICLE_DETAIL,
    LIVE2D_PAGE_GROUP_BOOK_DETAIL,
    LIVE2D_PAGE_GROUP_HOME,
    LIVE2D_PAGE_GROUP_PROFILE,
    LIVE2D_SOURCE_CUBISM_BUNDLE,
    LIVE2D_SOURCE_CDN,
    LIVE2D_SOURCE_CHOICES,
    LIVE2D_SOURCE_WIDGET_BUNDLE,
    LIVE2D_TIPS_MODE_BUILTIN,
    LIVE2D_TIPS_MODE_CHOICES,
    LIVE2D_TIPS_MODE_CUSTOM,
    LIVE2D_TIPS_MODE_HYBRID,
    SITE_SETTING_DEFINITIONS,
    VIP_MAX_LEVEL_LIMIT,
    build_default_vip_config,
    build_default_live2d_tips_config,
    get_normalized_vip_configs,
    get_site_setting,
    inspect_live2d_cubism_bundle,
    inspect_live2d_widget_bundle,
    normalize_live2d_tips_config,
    parse_live2d_tip_lines,
    save_live2d_cubism_bundle,
    save_live2d_widget_bundle,
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
    live2d_enabled = forms.BooleanField(
        required=False,
        label=_("Enable Live2D assistant"),
        help_text=_("Show a Live2D assistant on supported desktop pages."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    live2d_source_type = forms.ChoiceField(
        label=_("Assistant source"),
        help_text=_("Choose whether the assistant resources come from a CDN, a Live2D widget bundle, or a standard Cubism runtime bundle."),
        choices=[
            (LIVE2D_SOURCE_CDN, _("CDN")),
            (LIVE2D_SOURCE_WIDGET_BUNDLE, _("Live2D widget bundle")),
            (LIVE2D_SOURCE_CUBISM_BUNDLE, _("Cubism runtime bundle")),
        ],
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    live2d_model_id = forms.IntegerField(
        min_value=0,
        label=_("Assistant model id"),
        help_text=_("Used when random assistant model is disabled. For CDN mode, this is the zero-based index in model_list.json. Bundle sources expose the available ids below."),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": 0, "step": 1}),
    )
    live2d_random_model = forms.BooleanField(
        required=False,
        initial=True,
        label=_("Random assistant model"),
        help_text=_("When enabled, the current assistant source picks a model at random."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    live2d_show_on_home = forms.BooleanField(required=False, label=_("Show on homepage"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_article_list = forms.BooleanField(required=False, label=_("Show on article lists"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_article_detail = forms.BooleanField(required=False, label=_("Show on article detail pages"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_book_list = forms.BooleanField(required=False, label=_("Show on book lists"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_book_detail = forms.BooleanField(required=False, label=_("Show on book detail pages"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_tag_pages = forms.BooleanField(required=False, label=_("Show on tag pages"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_search = forms.BooleanField(required=False, label=_("Show on search pages"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_profile = forms.BooleanField(required=False, label=_("Show on profile pages"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_public_share_pages = forms.BooleanField(required=False, label=_("Show on public share pages"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_show_on_manage_pages = forms.BooleanField(required=False, label=_("Show on management pages"), widget=forms.CheckboxInput(attrs={"class": "switch-input"}))
    live2d_cdn_autoload_url = forms.CharField(
        required=False,
        label=_("CDN autoload URL"),
        help_text=_("Leave blank to use the default supported autoload script URL."),
        widget=forms.URLInput(attrs={"class": "input-control", "placeholder": "https://.../autoload.js"}),
    )
    live2d_cdn_waifu_path = forms.CharField(
        required=False,
        label=_("CDN tips JSON URL (optional)"),
        help_text=_("Optional override for the tips JSON file loaded by the assistant."),
        widget=forms.URLInput(attrs={"class": "input-control", "placeholder": "https://.../waifu-tips.json"}),
    )
    live2d_cdn_assets_base = forms.CharField(
        required=False,
        label=_("CDN model assets base URL"),
        help_text=_("Optional override for the remote model assets base URL."),
        widget=forms.URLInput(attrs={"class": "input-control", "placeholder": "https://.../"}),
    )
    live2d_widget_bundle_file = forms.FileField(
        required=False,
        label=_("Live2D widget bundle"),
        help_text=_("Upload a zip bundle that includes manifest.json and the required Live2D resource files."),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": ".zip,application/zip"}),
    )
    live2d_cubism_bundle_file = forms.FileField(
        required=False,
        label=_("Cubism runtime bundle"),
        help_text=_("Upload a standard Cubism runtime zip bundle. It may include manifest.json, .model3.json, .moc3, textures, .motion3.json, .exp3.json, .physics3.json, and related runtime files referenced by model3.json."),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": ".zip,application/zip"}),
    )
    live2d_tips_enabled = forms.BooleanField(
        required=False,
        label=_("Enable assistant tips"),
        help_text=_("Allow the assistant to show welcome, idle, and hover tips."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    live2d_tips_mode = forms.ChoiceField(
        label=_("Tip source mode"),
        help_text=_("Built-in uses the default tips, custom uses only your own tips, and hybrid merges both."),
        choices=[
            (LIVE2D_TIPS_MODE_BUILTIN, _("Built-in only")),
            (LIVE2D_TIPS_MODE_CUSTOM, _("Custom only")),
            (LIVE2D_TIPS_MODE_HYBRID, _("Hybrid")),
        ],
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    live2d_tips_welcome_text = forms.CharField(required=False, label=_("Welcome tips"), help_text=_("Enter one welcome message per line."), widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 4}))
    live2d_tips_idle_text = forms.CharField(required=False, label=_("Idle tips"), help_text=_("Enter one idle message per line."), widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 4}))
    live2d_tips_touch_text = forms.CharField(required=False, label=_("Touch tips"), help_text=_("Enter one touch response per line."), widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 4}))
    live2d_tips_home_text = forms.CharField(required=False, label=_("Homepage tips"), help_text=_("Enter one homepage-specific message per line."), widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 3}))
    live2d_tips_article_text = forms.CharField(required=False, label=_("Article page tips"), help_text=_("Enter one article-detail message per line."), widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 3}))
    live2d_tips_book_text = forms.CharField(required=False, label=_("Book page tips"), help_text=_("Enter one book-detail message per line."), widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 3}))
    live2d_tips_profile_text = forms.CharField(required=False, label=_("Profile page tips"), help_text=_("Enter one profile-specific message per line."), widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 3}))
    live2d_tips_rules_json = forms.CharField(
        required=False,
        label=_("Advanced hover rules (JSON)"),
        help_text=_("Enter a JSON array of rule objects. Each rule supports selector, texts, and optional pageGroups."),
        widget=forms.Textarea(attrs={"class": "input-control input-textarea", "rows": 8, "spellcheck": "false"}),
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
    video_max_size_mb = forms.IntegerField(
        min_value=1,
        initial=100,
        label=_("Maximum video size (MB)"),
        help_text=_("Maximum allowed size for a single uploaded video. Default is 100 MB."),
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
    allow_user_upload_video = forms.BooleanField(
        required=False,
        label=_("Allow users to upload video"),
        help_text=_("When enabled, non-admin users can upload and insert videos from article and comment editors."),
        widget=forms.CheckboxInput(attrs={"class": "switch-input"}),
    )
    vip_only_upload_video = forms.BooleanField(
        required=False,
        label=_("Only VIP upload"),
        help_text=_("When enabled, only VIP users can upload and insert videos. Admins are unaffected."),
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
        "live2d_enabled",
        "live2d_source_type",
        "live2d_model_id",
        "live2d_random_model",
        "live2d_show_on_home",
        "live2d_show_on_article_list",
        "live2d_show_on_article_detail",
        "live2d_show_on_book_list",
        "live2d_show_on_book_detail",
        "live2d_show_on_tag_pages",
        "live2d_show_on_search",
        "live2d_show_on_profile",
        "live2d_show_on_public_share_pages",
        "live2d_show_on_manage_pages",
        "live2d_cdn_autoload_url",
        "live2d_cdn_waifu_path",
        "live2d_cdn_assets_base",
        "live2d_tips_enabled",
        "live2d_tips_mode",
        "live2d_tips_config",
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
        "video_max_size_mb",
        "allow_user_upload_attachment",
        "vip_only_upload_attachment",
        "allow_user_upload_video",
        "vip_only_upload_video",
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
        self.current_live2d_widget_manifest = self.settings.get("live2d_widget_bundle_manifest", {}) if isinstance(self.settings.get("live2d_widget_bundle_manifest", {}), dict) else {}
        self.current_live2d_cubism_manifest = self.settings.get("live2d_cubism_bundle_manifest", {}) if isinstance(self.settings.get("live2d_cubism_bundle_manifest", {}), dict) else {}
        self.uploaded_live2d_widget_manifest = None
        self.uploaded_live2d_cubism_manifest = None
        super().__init__(*args, **kwargs)
        for field_name in self.SETTING_FIELDS:
            initial_value = self.settings.get(field_name, SITE_SETTING_DEFINITIONS[field_name]["default"])
            if field_name in self.fields:
                self.fields[field_name].initial = initial_value
                self.initial[field_name] = initial_value
        tips_config = normalize_live2d_tips_config(self.settings.get("live2d_tips_config", {}))
        self.initial["live2d_tips_welcome_text"] = "\n".join(tips_config.get("welcome", []))
        self.initial["live2d_tips_idle_text"] = "\n".join(tips_config.get("idle", []))
        self.initial["live2d_tips_touch_text"] = "\n".join(tips_config.get("touch", []))
        self.initial["live2d_tips_home_text"] = "\n".join(tips_config.get("pages", {}).get(LIVE2D_PAGE_GROUP_HOME, []))
        self.initial["live2d_tips_article_text"] = "\n".join(tips_config.get("pages", {}).get(LIVE2D_PAGE_GROUP_ARTICLE_DETAIL, []))
        self.initial["live2d_tips_book_text"] = "\n".join(tips_config.get("pages", {}).get(LIVE2D_PAGE_GROUP_BOOK_DETAIL, []))
        self.initial["live2d_tips_profile_text"] = "\n".join(tips_config.get("pages", {}).get(LIVE2D_PAGE_GROUP_PROFILE, []))
        self.initial["live2d_tips_rules_json"] = json.dumps(tips_config.get("rules", []), ensure_ascii=True, indent=2)
        self.vip_level_rows = []
        vip_max_level = self._get_requested_vip_max_level()
        vip_configs = get_normalized_vip_configs(self.settings)

        for level in range(1, VIP_MAX_LEVEL_LIMIT + 1):
            default_config = build_default_vip_config(level)
            config = vip_configs[level - 1] if level - 1 < len(vip_configs) else default_config
            display_name_field_name = f"vip_level_display_name_{level}"
            money_discount_field_name = f"vip_level_money_discount_{level}"
            points_discount_field_name = f"vip_level_points_discount_{level}"
            money_reward_field_name = f"vip_level_money_reward_{level}"
            points_reward_field_name = f"vip_level_points_reward_{level}"
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
            self.fields[money_reward_field_name] = forms.DecimalField(
                required=False,
                min_value=0,
                max_value=1,
                decimal_places=2,
                label=_("Money reward"),
                help_text=_("Extra author money reward multiplier for users at this VIP level. Enter a value between 0 and 1. For example, 0.10 means 10%% extra reward."),
                initial=config["money_reward"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "max": 1,
                        "step": 0.01,
                        "data-vip-config-input": "money_reward",
                        "data-vip-level": str(level),
                    }
                ),
            )
            self.fields[points_reward_field_name] = forms.DecimalField(
                required=False,
                min_value=0,
                max_value=1,
                decimal_places=2,
                label=_("Points reward"),
                help_text=_("Extra author points reward multiplier for users at this VIP level. Enter a value between 0 and 1. For example, 0.05 means 5%% extra reward."),
                initial=config["points_reward"],
                widget=forms.NumberInput(
                    attrs={
                        "class": "input-control",
                        "min": 0,
                        "max": 1,
                        "step": 0.01,
                        "data-vip-config-input": "points_reward",
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
                    "money_reward_field": self[money_reward_field_name],
                    "points_reward_field": self[points_reward_field_name],
                    "daily_login_bonus_money_field": self[daily_login_bonus_money_field_name],
                    "daily_login_bonus_points_field": self[daily_login_bonus_points_field_name],
                    "first_comment_bonus_money_field": self[first_comment_bonus_money_field_name],
                    "first_comment_bonus_points_field": self[first_comment_bonus_points_field_name],
                }
            )
        self.current_vip_max_level = vip_max_level
        self.live2d_widget_bundle_models = self.current_live2d_widget_manifest.get("models", []) if isinstance(self.current_live2d_widget_manifest, dict) else []
        self.live2d_cubism_bundle_models = self.current_live2d_cubism_manifest.get("models", []) if isinstance(self.current_live2d_cubism_manifest, dict) else []

    def _validate_live2d_url_field(self, field_name, value):
        normalized = str(value or "").strip()
        if not normalized:
            return ""
        try:
            URLValidator()(normalized)
        except forms.ValidationError:
            raise forms.ValidationError(_("Enter a valid URL."))
        return normalized

    def _clean_live2d_tips_rules(self, raw_value):
        if not str(raw_value or "").strip():
            return []
        try:
            parsed = json.loads(raw_value)
        except ValueError:
            raise forms.ValidationError(_("Advanced hover rules must be valid JSON."))
        if not isinstance(parsed, list):
            raise forms.ValidationError(_("Advanced hover rules must be a JSON array."))
        normalized_rules = []
        valid_page_groups = {
            "home",
            "article_list",
            "article_detail",
            "book_list",
            "book_detail",
            "tag_pages",
            "search",
            "profile",
            "public_share_pages",
            "manage_pages",
        }
        for index, item in enumerate(parsed, start=1):
            if not isinstance(item, dict):
                raise forms.ValidationError(_("Rule %(index)s must be an object.") % {"index": index})
            selector = str(item.get("selector") or "").strip()
            texts = [text.strip() for text in item.get("texts", []) if str(text or "").strip()] if isinstance(item.get("texts"), list) else []
            page_groups = item.get("pageGroups", []) if isinstance(item.get("pageGroups"), list) else []
            if not selector:
                raise forms.ValidationError(_("Rule %(index)s must include a selector.") % {"index": index})
            if not texts:
                raise forms.ValidationError(_("Rule %(index)s must include at least one message in texts.") % {"index": index})
            invalid_groups = [group for group in page_groups if group not in valid_page_groups]
            if invalid_groups:
                raise forms.ValidationError(_("Rule %(index)s contains unsupported page groups.") % {"index": index})
            normalized_rules.append({"selector": selector, "texts": texts, "pageGroups": page_groups})
        return normalized_rules

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
        live2d_enabled = cleaned_data.get("live2d_enabled")
        live2d_source_type = cleaned_data.get("live2d_source_type") or LIVE2D_SOURCE_CDN
        if live2d_source_type not in LIVE2D_SOURCE_CHOICES:
            self.add_error("live2d_source_type", _("Unsupported Live2D source type."))
        for url_field_name in ("live2d_cdn_autoload_url", "live2d_cdn_waifu_path", "live2d_cdn_assets_base"):
            try:
                cleaned_data[url_field_name] = self._validate_live2d_url_field(url_field_name, cleaned_data.get(url_field_name))
            except forms.ValidationError as exc:
                self.add_error(url_field_name, exc)
        if live2d_source_type == LIVE2D_SOURCE_WIDGET_BUNDLE:
            uploaded_bundle = cleaned_data.get("live2d_widget_bundle_file")
            if uploaded_bundle:
                try:
                    self.uploaded_live2d_widget_manifest = inspect_live2d_widget_bundle(uploaded_bundle)
                except ValueError as exc:
                    self.add_error("live2d_widget_bundle_file", exc)
            elif not self.current_live2d_widget_manifest and live2d_enabled:
                self.add_error("live2d_widget_bundle_file", _("Upload a Live2D widget bundle before enabling widget-bundle mode."))
            manifest = self.uploaded_live2d_widget_manifest or self.current_live2d_widget_manifest
            available_model_ids = {int(item.get("id")) for item in manifest.get("models", []) if isinstance(item, dict) and item.get("id") is not None} if isinstance(manifest, dict) else set()
            model_id = cleaned_data.get("live2d_model_id")
            if not cleaned_data.get("live2d_random_model") and available_model_ids and model_id not in available_model_ids:
                self.add_error("live2d_model_id", _("Choose one of the model ids exposed by the widget bundle."))
        elif live2d_source_type == LIVE2D_SOURCE_CUBISM_BUNDLE:
            uploaded_bundle = cleaned_data.get("live2d_cubism_bundle_file")
            if uploaded_bundle:
                try:
                    self.uploaded_live2d_cubism_manifest = inspect_live2d_cubism_bundle(uploaded_bundle)
                except ValueError as exc:
                    self.add_error("live2d_cubism_bundle_file", exc)
            elif not self.current_live2d_cubism_manifest and live2d_enabled:
                self.add_error("live2d_cubism_bundle_file", _("Upload a Cubism runtime bundle before enabling cubism-bundle mode."))
            manifest = self.uploaded_live2d_cubism_manifest or self.current_live2d_cubism_manifest
            available_model_ids = {int(item.get("id")) for item in manifest.get("models", []) if isinstance(item, dict) and item.get("id") is not None} if isinstance(manifest, dict) else set()
            model_id = cleaned_data.get("live2d_model_id")
            if not cleaned_data.get("live2d_random_model") and available_model_ids and model_id not in available_model_ids:
                self.add_error("live2d_model_id", _("Choose one of the model ids exposed by the Cubism bundle."))
        tips_mode = cleaned_data.get("live2d_tips_mode") or LIVE2D_TIPS_MODE_BUILTIN
        if tips_mode not in LIVE2D_TIPS_MODE_CHOICES:
            self.add_error("live2d_tips_mode", _("Unsupported tip source mode."))
        try:
            rules = self._clean_live2d_tips_rules(cleaned_data.get("live2d_tips_rules_json", ""))
        except forms.ValidationError as exc:
            self.add_error("live2d_tips_rules_json", exc)
            rules = []
        cleaned_data["live2d_tips_config"] = {
            "welcome": parse_live2d_tip_lines(cleaned_data.get("live2d_tips_welcome_text")),
            "idle": parse_live2d_tip_lines(cleaned_data.get("live2d_tips_idle_text")),
            "touch": parse_live2d_tip_lines(cleaned_data.get("live2d_tips_touch_text")),
            "pages": {
                LIVE2D_PAGE_GROUP_HOME: parse_live2d_tip_lines(cleaned_data.get("live2d_tips_home_text")),
                LIVE2D_PAGE_GROUP_ARTICLE_DETAIL: parse_live2d_tip_lines(cleaned_data.get("live2d_tips_article_text")),
                LIVE2D_PAGE_GROUP_BOOK_DETAIL: parse_live2d_tip_lines(cleaned_data.get("live2d_tips_book_text")),
                LIVE2D_PAGE_GROUP_PROFILE: parse_live2d_tip_lines(cleaned_data.get("live2d_tips_profile_text")),
            },
            "rules": rules,
        }
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
            money_reward = cleaned_data.get(f"vip_level_money_reward_{level}")
            points_reward = cleaned_data.get(f"vip_level_points_reward_{level}")
            daily_login_bonus_money = cleaned_data.get(f"vip_level_daily_login_bonus_money_{level}")
            daily_login_bonus_points = cleaned_data.get(f"vip_level_daily_login_bonus_points_{level}")
            first_comment_bonus_money = cleaned_data.get(f"vip_level_first_comment_bonus_money_{level}")
            first_comment_bonus_points = cleaned_data.get(f"vip_level_first_comment_bonus_points_{level}")
            vip_configs.append(
                {
                    "display_name": display_name,
                    "money_discount": money_discount if money_discount not in (None, "") else default_config["money_discount"],
                    "points_discount": points_discount if points_discount not in (None, "") else default_config["points_discount"],
                    "money_reward": money_reward if money_reward not in (None, "") else default_config["money_reward"],
                    "points_reward": points_reward if points_reward not in (None, "") else default_config["points_reward"],
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

        uploaded_bundle = self.cleaned_data.get("live2d_widget_bundle_file")
        if uploaded_bundle:
            saved_bundle = save_live2d_widget_bundle(uploaded_bundle, self.uploaded_live2d_widget_manifest)
            payload["live2d_widget_bundle_file"] = saved_bundle["bundle_file"]
            payload["live2d_widget_bundle_manifest"] = saved_bundle["bundle_manifest"]
            payload["live2d_widget_bundle_extract_root"] = saved_bundle["bundle_extract_root"]
            if self.cleaned_data.get("live2d_source_type") == LIVE2D_SOURCE_WIDGET_BUNDLE and self.cleaned_data.get("live2d_model_id") is None:
                payload["live2d_model_id"] = saved_bundle["bundle_manifest"].get("defaults", {}).get("modelId", 0)
        else:
            payload["live2d_widget_bundle_file"] = self.settings.get("live2d_widget_bundle_file", "")
            payload["live2d_widget_bundle_manifest"] = self.settings.get("live2d_widget_bundle_manifest", {})
            payload["live2d_widget_bundle_extract_root"] = self.settings.get("live2d_widget_bundle_extract_root", "")

        uploaded_cubism_bundle = self.cleaned_data.get("live2d_cubism_bundle_file")
        if uploaded_cubism_bundle:
            saved_bundle = save_live2d_cubism_bundle(uploaded_cubism_bundle, self.uploaded_live2d_cubism_manifest)
            payload["live2d_cubism_bundle_file"] = saved_bundle["bundle_file"]
            payload["live2d_cubism_bundle_manifest"] = saved_bundle["bundle_manifest"]
            payload["live2d_cubism_bundle_extract_root"] = saved_bundle["bundle_extract_root"]
            if self.cleaned_data.get("live2d_source_type") == LIVE2D_SOURCE_CUBISM_BUNDLE and self.cleaned_data.get("live2d_model_id") is None:
                payload["live2d_model_id"] = saved_bundle["bundle_manifest"].get("defaults", {}).get("modelId", 0)
        else:
            payload["live2d_cubism_bundle_file"] = self.settings.get("live2d_cubism_bundle_file", "")
            payload["live2d_cubism_bundle_manifest"] = self.settings.get("live2d_cubism_bundle_manifest", {})
            payload["live2d_cubism_bundle_extract_root"] = self.settings.get("live2d_cubism_bundle_extract_root", "")

        set_settings(payload)
        self.settings = get_site_setting()
        return self.settings
