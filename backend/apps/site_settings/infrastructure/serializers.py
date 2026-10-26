import json
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

from rest_framework import serializers

from apps.site_settings.domain.definitions import SETTING_DEFINITIONS, VIP_DEFAULT


SOURCES = {"cdn", "widget_bundle", "cubism_bundle"}
TIP_MODES = {"builtin", "custom", "hybrid"}
PROVIDERS = {"openai", "anthropic", "gemini", "azure_openai", "deepseek", "qwen", "moonshot", "ollama", "host_vllm"}
SHOW_ON_KEYS = {"home", "article_list", "article_detail", "book_list", "book_detail", "tag_pages", "search", "profile", "public_share_pages", "manage_pages"}


def require_object(value, fields):
    if not isinstance(value, dict) or set(value) != set(fields):
        raise serializers.ValidationError("Invalid settings structure.")


def require_bool(value, name):
    if not isinstance(value, bool):
        raise serializers.ValidationError({name: "Must be true or false."})


def require_int(value, name, minimum, maximum=None):
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum or (maximum is not None and value > maximum):
        limit = f" between {minimum} and {maximum}" if maximum is not None else f" of at least {minimum}"
        raise serializers.ValidationError({name: f"Use an integer{limit}."})


def require_ratio(value, name):
    try:
        ratio = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise serializers.ValidationError({name: "Use a decimal between 0 and 1."})
    if not Decimal("0") <= ratio <= Decimal("1"):
        raise serializers.ValidationError({name: "Use a decimal between 0 and 1."})


class BasicSettingsSerializer(serializers.Serializer):
    values = serializers.DictField(child=serializers.JSONField())

    def validate_values(self, values):
        allowed = {key for key, definition in SETTING_DEFINITIONS.items() if definition["section"] == "basic"}
        unknown = set(values) - allowed
        if unknown:
            raise serializers.ValidationError({key: "Unknown or unavailable setting." for key in unknown})
        for key, value in values.items():
            getattr(self, f"validate_{key.replace('.', '_')}")(value)
        return values

    def validate_basic_site(self, value):
        require_object(value, ("title", "dashboard_visit_trend_days"))
        if not isinstance(value["title"], str) or len(value["title"].strip()) > 120:
            raise serializers.ValidationError({"title": "Use up to 120 characters."})
        if value["dashboard_visit_trend_days"] not in (7, 14, 30):
            raise serializers.ValidationError({"dashboard_visit_trend_days": "Choose 7, 14, or 30."})

    def validate_basic_assets(self, value):
        require_object(value, ("site_icon", "auth_background", "app_background"))
        if any(not isinstance(path, str) for path in value.values()):
            raise serializers.ValidationError("Invalid asset path.")

    def validate_registration(self, value):
        require_object(value, ("enable_register", "code_expire_seconds", "code_resend_seconds"))
        require_bool(value["enable_register"], "enable_register")
        require_int(value["code_expire_seconds"], "code_expire_seconds", 60, 3600)
        require_int(value["code_resend_seconds"], "code_resend_seconds", 10, 600)

    def validate_user_rewards(self, value):
        require_object(value, ("daily_login_reward_money", "daily_login_reward_points", "storage_capacity_mb"))
        require_int(value["daily_login_reward_money"], "daily_login_reward_money", 0)
        require_int(value["daily_login_reward_points"], "daily_login_reward_points", 0)
        require_int(value["storage_capacity_mb"], "storage_capacity_mb", 0)

    def validate_vip(self, value):
        require_object(value, ("vip_max_level", "vip_configs"))
        require_int(value["vip_max_level"], "vip_max_level", 0, 20)
        if not isinstance(value["vip_configs"], list) or len(value["vip_configs"]) != value["vip_max_level"]:
            raise serializers.ValidationError({"vip_configs": "Provide exactly one configuration for each enabled level."})
        for config in value["vip_configs"]:
            require_object(config, VIP_DEFAULT)
            if not isinstance(config["display_name"], str) or not config["display_name"].strip() or len(config["display_name"]) > 60:
                raise serializers.ValidationError({"vip_configs": "Each VIP name must contain up to 60 characters."})
            for key in ("money_discount", "points_discount", "money_reward", "points_reward"):
                require_ratio(config[key], key)
            for key in ("daily_login_bonus_money", "daily_login_bonus_points", "first_comment_bonus_money", "first_comment_bonus_points", "storage_capacity_mb"):
                require_int(config[key], key, 0)

    def validate_content_article(self, value):
        self._validate_content(value, True)

    def validate_content_book(self, value):
        self._validate_content(value, False)

    def _validate_content(self, value, post):
        fields = ("allow_non_admin_create", "non_admin_max_count", "vip_only", "author_reward_money_ratio", "author_reward_points_ratio")
        if post: fields = fields[:3] + ("editor_autosave_enabled", "editor_autosave_interval_minutes") + fields[3:]
        require_object(value, fields)
        for key in ("allow_non_admin_create", "vip_only") + (("editor_autosave_enabled",) if post else ()):
            require_bool(value[key], key)
        require_int(value["non_admin_max_count"], "non_admin_max_count", 0)
        if post: require_int(value["editor_autosave_interval_minutes"], "editor_autosave_interval_minutes", 1, 60)
        require_ratio(value["author_reward_money_ratio"], "author_reward_money_ratio")
        require_ratio(value["author_reward_points_ratio"], "author_reward_points_ratio")

    def validate_upload_attachment(self, value):
        require_object(value, ("allow_user_upload", "vip_only", "max_size_mb", "author_reward_money_ratio", "author_reward_points_ratio"))
        for key in ("allow_user_upload", "vip_only"): require_bool(value[key], key)
        require_int(value["max_size_mb"], "max_size_mb", 1)
        require_ratio(value["author_reward_money_ratio"], "author_reward_money_ratio")
        require_ratio(value["author_reward_points_ratio"], "author_reward_points_ratio")

    def validate_upload_video(self, value):
        require_object(value, ("allow_user_upload", "vip_only", "max_size_mb"))
        for key in ("allow_user_upload", "vip_only"): require_bool(value[key], key)
        require_int(value["max_size_mb"], "max_size_mb", 1)

    def validate_comment(self, value):
        require_object(value, ("allow_user_comment", "vip_only", "first_reward_money", "first_reward_points"))
        for key in ("allow_user_comment", "vip_only"): require_bool(value[key], key)
        require_int(value["first_reward_money"], "first_reward_money", 0)
        require_int(value["first_reward_points"], "first_reward_points", 0)

    def validate_system_audit_cleanup(self, value):
        require_object(value, ("enabled", "retention_days"))
        require_bool(value["enabled"], "enabled")
        require_int(value["retention_days"], "retention_days", 1, 3650)

    def validate_basic_live2d(self, value):
        fields = ("enabled", "source_type", "cdn_autoload_url", "cdn_assets_base", "cdn_waifu_path", "widget_bundle", "cubism_bundle", "random_model", "model_id", "show_on", "tips", "ai")
        require_object(value, fields)
        require_bool(value["enabled"], "enabled")
        if value["source_type"] not in SOURCES: raise serializers.ValidationError({"source_type": "Invalid source."})
        for key in ("cdn_autoload_url", "cdn_assets_base", "cdn_waifu_path", "widget_bundle", "cubism_bundle"):
            if not isinstance(value[key], str): raise serializers.ValidationError({key: "Must be a string."})
        for key in ("cdn_autoload_url", "cdn_assets_base", "cdn_waifu_path"):
            if value[key] and urlparse(value[key]).scheme not in {"http", "https"}: raise serializers.ValidationError({key: "Use an HTTP(S) URL."})
        require_bool(value["random_model"], "random_model"); require_int(value["model_id"], "model_id", 0)
        require_object(value["show_on"], SHOW_ON_KEYS)
        for key, enabled in value["show_on"].items(): require_bool(enabled, key)
        tips = value["tips"]; require_object(tips, ("enabled", "mode", "welcome_text", "idle_text", "touch_text", "home_text", "article_text", "book_text", "profile_text", "rules_json"))
        require_bool(tips["enabled"], "tips.enabled")
        if tips["mode"] not in TIP_MODES: raise serializers.ValidationError({"tips.mode": "Invalid tips mode."})
        if any(not isinstance(tips[key], str) for key in ("welcome_text", "idle_text", "touch_text", "home_text", "article_text", "book_text", "profile_text", "rules_json")):
            raise serializers.ValidationError("Tip values must be strings.")
        try:
            if not isinstance(json.loads(tips["rules_json"]), list): raise ValueError
        except (TypeError, ValueError, json.JSONDecodeError): raise serializers.ValidationError({"tips.rules_json": "Use a JSON array."})
        ai = value["ai"]; require_object(ai, ("enabled", "vip_only", "allow_anonymous", "provider", "endpoint", "api_key", "model", "system_prompt"))
        for key in ("enabled", "vip_only", "allow_anonymous"): require_bool(ai[key], f"ai.{key}")
        if ai["provider"] not in PROVIDERS: raise serializers.ValidationError({"ai.provider": "Invalid provider."})
        if not all(isinstance(ai[key], str) for key in ("endpoint", "api_key", "model", "system_prompt")): raise serializers.ValidationError("Invalid AI fields.")
        if ai["enabled"] and not ai["model"].strip(): raise serializers.ValidationError({"ai.model": "Model is required when AI is enabled."})
