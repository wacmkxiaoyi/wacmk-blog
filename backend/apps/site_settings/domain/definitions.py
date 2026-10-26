from copy import deepcopy


def default_vip_config(level):
    return {
        "display_name": f"VIP {level}",
        "money_discount": f"{min(level * 0.10, 1):.2f}",
        "points_discount": f"{min(level * 0.05, 1):.2f}",
        "money_reward": f"{min(level * 0.10, 1):.2f}",
        "points_reward": f"{min(level * 0.05, 1):.2f}",
        "daily_login_bonus_money": level * 5,
        "daily_login_bonus_points": level * 5,
        "first_comment_bonus_money": level * 2,
        "first_comment_bonus_points": level * 2,
        "storage_capacity_mb": level * 1024,
    }


VIP_DEFAULT = default_vip_config(1)


SETTING_DEFINITIONS = {
    "basic.site": {"section": "basic", "public": True, "default": {"title": "", "dashboard_visit_trend_days": 7}},
    "basic.assets": {"section": "basic", "public": True, "default": {"site_icon": "", "auth_background": "", "app_background": ""}},
    "basic.live2d": {"section": "basic", "public": False, "default": {
        "enabled": False, "source_type": "cdn", "cdn_autoload_url": "", "cdn_assets_base": "", "cdn_waifu_path": "",
        "widget_bundle": "", "cubism_bundle": "", "random_model": True, "model_id": 0,
        "show_on": {"home": True, "article_list": False, "article_detail": True, "book_list": False, "book_detail": True, "tag_pages": False, "search": False, "profile": False, "public_share_pages": False, "manage_pages": False},
        "tips": {"enabled": True, "mode": "builtin", "welcome_text": "", "idle_text": "", "touch_text": "", "home_text": "", "article_text": "", "book_text": "", "profile_text": "", "rules_json": "[]"},
        "ai": {"enabled": False, "vip_only": True, "allow_anonymous": False, "provider": "openai", "endpoint": "", "api_key": "", "model": "gpt-5.4-nano", "system_prompt": ""},
    }},
    "registration": {"section": "basic", "public": True, "default": {"enable_register": True, "code_expire_seconds": 600, "code_resend_seconds": 60}},
    "user.rewards": {"section": "basic", "public": False, "default": {"daily_login_reward_money": 10, "daily_login_reward_points": 10, "storage_capacity_mb": 10}},
    "vip": {"section": "basic", "public": False, "default": {"vip_max_level": 3, "vip_configs": [default_vip_config(level) for level in range(1, 4)]}},
    "content.article": {"section": "basic", "public": True, "default": {"allow_non_admin_create": True, "non_admin_max_count": 10, "vip_only": False, "editor_autosave_enabled": True, "editor_autosave_interval_minutes": 5, "author_reward_money_ratio": "0.80", "author_reward_points_ratio": "0.00"}},
    "content.book": {"section": "basic", "public": True, "default": {"allow_non_admin_create": False, "non_admin_max_count": 3, "vip_only": False, "author_reward_money_ratio": "0.80", "author_reward_points_ratio": "0.00"}},
    "upload.attachment": {"section": "basic", "public": True, "default": {"allow_user_upload": True, "vip_only": False, "max_size_mb": 20, "author_reward_money_ratio": "0.80", "author_reward_points_ratio": "0.00"}},
    "upload.video": {"section": "basic", "public": True, "default": {"allow_user_upload": True, "vip_only": True, "max_size_mb": 200}},
    "comment": {"section": "basic", "public": True, "default": {"allow_user_comment": True, "vip_only": False, "first_reward_money": 1, "first_reward_points": 1}},
    "system.audit_cleanup": {"section": "basic", "public": False, "default": {"enabled": True, "retention_days": 7}},
}


def default_for(key):
    return deepcopy(SETTING_DEFINITIONS[key]["default"])
