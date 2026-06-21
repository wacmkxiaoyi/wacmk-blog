import json
import os
import posixpath
import shutil
import uuid
import zipfile
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.core.files.storage import default_storage
from django.templatetags.static import static
from django.db import transaction
from django.db.models import Count, F
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.blog.constants import LEGACY_VIP_GROUP_NAME, get_default_business_group_name, get_vip_group_name
from apps.blog.models import Book, ContentViewLog, Post, SiteSetting
from apps.blog.utils.request import get_client_ip


SHARE_LINK_EXPIRY_OPTIONS = {
    "1d": {"label": _("1 day"), "delta": timedelta(days=1)},
    "7d": {"label": _("7 days"), "delta": timedelta(days=7)},
    "30d": {"label": _("30 days"), "delta": timedelta(days=30)},
    "never": {"label": _("Never expires"), "delta": None},
}

VIEW_COUNT_COOLDOWN_MINUTES = 30
VIP_MAX_LEVEL_LIMIT = 20
DASHBOARD_VISIT_TREND_DAYS_7 = 7
DASHBOARD_VISIT_TREND_DAYS_14 = 14
DASHBOARD_VISIT_TREND_DAYS_30 = 30
DASHBOARD_VISIT_TREND_DAY_CHOICES = [
    (DASHBOARD_VISIT_TREND_DAYS_7, _("7 days")),
    (DASHBOARD_VISIT_TREND_DAYS_14, _("14 days")),
    (DASHBOARD_VISIT_TREND_DAYS_30, _("30 days")),
]
LIVE2D_SOURCE_CDN = "cdn"
LIVE2D_SOURCE_WIDGET_BUNDLE = "widget_bundle"
LIVE2D_SOURCE_CUBISM_BUNDLE = "cubism_bundle"
LIVE2D_SOURCE_CHOICES = {LIVE2D_SOURCE_CDN, LIVE2D_SOURCE_WIDGET_BUNDLE, LIVE2D_SOURCE_CUBISM_BUNDLE}
LIVE2D_POSITION_LEFT = "left"
LIVE2D_POSITION_RIGHT = "right"
LIVE2D_POSITION_CHOICES = {LIVE2D_POSITION_LEFT, LIVE2D_POSITION_RIGHT}
LIVE2D_TIPS_MODE_BUILTIN = "builtin"
LIVE2D_TIPS_MODE_CUSTOM = "custom"
LIVE2D_TIPS_MODE_HYBRID = "hybrid"
LIVE2D_TIPS_MODE_CHOICES = {LIVE2D_TIPS_MODE_BUILTIN, LIVE2D_TIPS_MODE_CUSTOM, LIVE2D_TIPS_MODE_HYBRID}
LIVE2D_PAGE_GROUP_HOME = "home"
LIVE2D_PAGE_GROUP_ARTICLE_LIST = "article_list"
LIVE2D_PAGE_GROUP_ARTICLE_DETAIL = "article_detail"
LIVE2D_PAGE_GROUP_BOOK_LIST = "book_list"
LIVE2D_PAGE_GROUP_BOOK_DETAIL = "book_detail"
LIVE2D_PAGE_GROUP_TAG_PAGES = "tag_pages"
LIVE2D_PAGE_GROUP_SEARCH = "search"
LIVE2D_PAGE_GROUP_PROFILE = "profile"
LIVE2D_PAGE_GROUP_PUBLIC_SHARE = "public_share_pages"
LIVE2D_PAGE_GROUP_MANAGE = "manage_pages"
LIVE2D_PAGE_GROUPS = {
    LIVE2D_PAGE_GROUP_HOME,
    LIVE2D_PAGE_GROUP_ARTICLE_LIST,
    LIVE2D_PAGE_GROUP_ARTICLE_DETAIL,
    LIVE2D_PAGE_GROUP_BOOK_LIST,
    LIVE2D_PAGE_GROUP_BOOK_DETAIL,
    LIVE2D_PAGE_GROUP_TAG_PAGES,
    LIVE2D_PAGE_GROUP_SEARCH,
    LIVE2D_PAGE_GROUP_PROFILE,
    LIVE2D_PAGE_GROUP_PUBLIC_SHARE,
    LIVE2D_PAGE_GROUP_MANAGE,
}
LIVE2D_DEFAULT_CDN_AUTOLOAD_URL = "https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/autoload.js"
LIVE2D_DEFAULT_CDN_ASSETS_BASE = "https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/"
LIVE2D_DEFAULT_CUBISM5_PATH = static("vendor/live2d-runtime/live2dcubismcore.min.js")
LIVE2D_BUNDLE_ENGINE = "live2d-widget"
LIVE2D_CUBISM_BUNDLE_ENGINE = "cubism-runtime"
LIVE2D_BUNDLE_VERSION = 1
LIVE2D_BUNDLE_MAX_SIZE_BYTES = 1024 * 1024 * 1024
LIVE2D_BUNDLE_MEDIA_ROOT = Path("site") / "live2d"
LIVE2D_PIXI_JS_URL = static("vendor/live2d-runtime/pixi.min.js")
LIVE2D_PIXI_LIVE2D_DISPLAY_URL = static("vendor/live2d-runtime/cubism4.min.js")
SITE_SETTING_FILE_KEYS = {"site_icon", "auth_background", "app_background", "live2d_widget_bundle_file", "live2d_cubism_bundle_file"}


def _serialize_bool(value):
    return "true" if bool(value) else "false"


def _parse_bool(value, default):
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off", ""}:
        return False
    return default


def _serialize_int(value):
    return str(int(value))


def _parse_int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _serialize_decimal(value):
    return str(Decimal(str(value)))


def _parse_decimal(value, default):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


def _serialize_json(value):
    def _json_default(item):
        if isinstance(item, Decimal):
            return str(item)
        raise TypeError(f"Object of type {item.__class__.__name__} is not JSON serializable")

    return json.dumps(value, ensure_ascii=True, default=_json_default)


def _parse_json(value, default):
    if value in (None, ""):
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _serialize_string(value):
    return str(value or "")


def _parse_string(value, default):
    if value in (None, ""):
        return default
    return str(value)


SITE_SETTING_DEFINITIONS = {
    "enable_register": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "code_expire_seconds": {
        "default": 600,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "code_resend_seconds": {
        "default": 60,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "site_title": {
        "default": "",
        "serialize": lambda value: str(value or ""),
        "parse": lambda value, default: str(value or default or ""),
    },
    "site_icon": {
        "default": "",
        "serialize": lambda value: str(value or ""),
        "parse": lambda value, default: str(value or default or ""),
    },
    "auth_background": {
        "default": "",
        "serialize": lambda value: str(value or ""),
        "parse": lambda value, default: str(value or default or ""),
    },
    "app_background": {
        "default": "",
        "serialize": lambda value: str(value or ""),
        "parse": lambda value, default: str(value or default or ""),
    },
    "live2d_enabled": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_source_type": {
        "default": LIVE2D_SOURCE_CDN,
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_model_id": {
        "default": 0,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "live2d_random_model": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_home": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_article_list": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_article_detail": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_book_list": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_book_detail": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_tag_pages": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_search": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_profile": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_public_share_pages": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_show_on_manage_pages": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_cdn_autoload_url": {
        "default": LIVE2D_DEFAULT_CDN_AUTOLOAD_URL,
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_cdn_waifu_path": {
        "default": "",
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_cdn_assets_base": {
        "default": LIVE2D_DEFAULT_CDN_ASSETS_BASE,
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_widget_bundle_file": {
        "default": "",
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_widget_bundle_manifest": {
        "default": {},
        "serialize": _serialize_json,
        "parse": _parse_json,
    },
    "live2d_widget_bundle_extract_root": {
        "default": "",
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_cubism_bundle_file": {
        "default": "",
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_cubism_bundle_manifest": {
        "default": {},
        "serialize": _serialize_json,
        "parse": _parse_json,
    },
    "live2d_cubism_bundle_extract_root": {
        "default": "",
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_tips_enabled": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "live2d_tips_mode": {
        "default": LIVE2D_TIPS_MODE_BUILTIN,
        "serialize": _serialize_string,
        "parse": _parse_string,
    },
    "live2d_tips_config": {
        "default": {},
        "serialize": _serialize_json,
        "parse": _parse_json,
    },
    "post_editor_autosave_enabled": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "post_editor_autosave_interval_minutes": {
        "default": 5,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "audit_log_cleanup_enabled": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "audit_log_retention_days": {
        "default": 30,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "vip_max_level": {
        "default": 3,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "vip_level_names": {
        "default": [],
        "serialize": _serialize_json,
        "parse": _parse_json,
    },
    "vip_configs": {
        "default": [],
        "serialize": _serialize_json,
        "parse": _parse_json,
    },
    "dashboard_visit_trend_days": {
        "default": DASHBOARD_VISIT_TREND_DAYS_7,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "allow_non_admin_create_post": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "non_admin_max_post_count": {
        "default": 10,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "vip_only_create_post": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "allow_non_admin_create_book": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "non_admin_max_book_count": {
        "default": 3,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "vip_only_create_book": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "attachment_max_size_mb": {
        "default": 1,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "video_max_size_mb": {
        "default": 100,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "allow_user_upload_attachment": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "vip_only_upload_attachment": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "allow_user_upload_video": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "vip_only_upload_video": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "allow_user_comment": {
        "default": True,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "vip_only_comment": {
        "default": False,
        "serialize": _serialize_bool,
        "parse": _parse_bool,
    },
    "comment_first_reward_money": {
        "default": 1,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "comment_first_reward_points": {
        "default": 1,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "daily_login_reward_money": {
        "default": 10,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "daily_login_reward_points": {
        "default": 10,
        "serialize": _serialize_int,
        "parse": _parse_int,
    },
    "article_author_reward_money_ratio": {
        "default": Decimal("0.8"),
        "serialize": _serialize_decimal,
        "parse": _parse_decimal,
    },
    "article_author_reward_points_ratio": {
        "default": Decimal("0"),
        "serialize": _serialize_decimal,
        "parse": _parse_decimal,
    },
    "book_author_reward_money_ratio": {
        "default": Decimal("0.8"),
        "serialize": _serialize_decimal,
        "parse": _parse_decimal,
    },
    "book_author_reward_points_ratio": {
        "default": Decimal("0"),
        "serialize": _serialize_decimal,
        "parse": _parse_decimal,
    },
    "attachment_author_reward_money_ratio": {
        "default": Decimal("0.8"),
        "serialize": _serialize_decimal,
        "parse": _parse_decimal,
    },
    "attachment_author_reward_points_ratio": {
        "default": Decimal("0"),
        "serialize": _serialize_decimal,
        "parse": _parse_decimal,
    },
}


def get_view_count_window_start():
    return timezone.now() - timedelta(minutes=VIEW_COUNT_COOLDOWN_MINUTES)


def record_content_view(request, *, content_type, object_id, model):
    ip_address = get_client_ip(request)
    user = request.user if request.user.is_authenticated else None
    window_start = get_view_count_window_start()

    if not ip_address:
        return False

    existing_views = ContentViewLog.objects.filter(
        content_type=content_type,
        object_id=object_id,
        viewed_at__gte=window_start,
        ip_address=ip_address,
    )

    if existing_views.exists():
        return False

    with transaction.atomic():
        locked_views = ContentViewLog.objects.select_for_update().filter(
            content_type=content_type,
            object_id=object_id,
            viewed_at__gte=window_start,
            ip_address=ip_address,
        )
        if locked_views.exists():
            return False

        ContentViewLog.objects.create(
            content_type=content_type,
            object_id=object_id,
            user=user,
            ip_address=ip_address,
            session_key="",
        )
        model.objects.filter(pk=object_id).update(view_count=F("view_count") + 1)

    return True


def record_post_view(request, post):
    return record_content_view(
        request,
        content_type=ContentViewLog.CONTENT_TYPE_POST,
        object_id=post.pk,
        model=Post,
    )


def record_book_view(request, book):
    return record_content_view(
        request,
        content_type=ContentViewLog.CONTENT_TYPE_BOOK,
        object_id=book.pk,
        model=Book,
    )


def build_visit_trend(days=7):
    today = timezone.localdate()
    start_date = today - timedelta(days=days - 1)
    rows = list(
        ContentViewLog.objects.filter(viewed_at__date__gte=start_date)
        .annotate(day=TruncDate("viewed_at"))
        .values("content_type", "day")
        .annotate(total=Count("id"))
        .order_by("day", "content_type")
    )

    article_lookup = {}
    book_lookup = {}
    max_total = 0
    for row in rows:
        total = row["total"]
        max_total = max(max_total, total)
        if row["content_type"] == ContentViewLog.CONTENT_TYPE_POST:
            article_lookup[row["day"]] = total
        elif row["content_type"] == ContentViewLog.CONTENT_TYPE_BOOK:
            book_lookup[row["day"]] = total

    trend = []
    for offset in range(days):
        day = start_date + timedelta(days=offset)
        article_total = article_lookup.get(day, 0)
        book_total = book_lookup.get(day, 0)
        article_height = 0
        book_height = 0
        if max_total:
            if article_total > 0:
                article_height = max(8, round((article_total / max_total) * 100))
            if book_total > 0:
                book_height = max(8, round((book_total / max_total) * 100))
        trend.append(
            {
                "day": day,
                "label": day.strftime("%m/%d"),
                "article_total": article_total,
                "book_total": book_total,
                "article_height": article_height,
                "book_height": book_height,
            }
        )
    return trend


def _resolve_setting_value(key, raw_value):
    definition = SITE_SETTING_DEFINITIONS[key]
    return definition["parse"](raw_value, definition["default"])


def build_default_live2d_tips_config():
    return {
        "welcome": [
            str(_("Welcome to the blog. There is probably something new worth reading today.")),
            str(_("Take a look around. Articles, books, and tags are all waiting for you.")),
        ],
        "idle": [
            str(_("Still browsing? Try searching for a keyword you care about.")),
            str(_("If you are not sure where to start, the homepage usually has the freshest content.")),
        ],
        "touch": [
            str(_("Easy there. I am here to help, not to be poked forever.")),
            str(_("If you are looking for something specific, the search box is usually faster.")),
        ],
        "pages": {
            LIVE2D_PAGE_GROUP_HOME: [str(_("The homepage shows the main activity and the latest content."))],
            LIVE2D_PAGE_GROUP_ARTICLE_DETAIL: [str(_("You can keep scrolling to read comments and related details."))],
            LIVE2D_PAGE_GROUP_BOOK_DETAIL: [str(_("Books here support structured reading, so chapter navigation is useful."))],
            LIVE2D_PAGE_GROUP_PROFILE: [str(_("Your profile area is where you manage posts, books, and personal settings."))],
        },
        "rules": [
            {
                "selector": ".nav-search-input",
                "texts": [str(_("Use this box to search articles, books, and tags."))],
                "pageGroups": [
                    LIVE2D_PAGE_GROUP_HOME,
                    LIVE2D_PAGE_GROUP_ARTICLE_LIST,
                    LIVE2D_PAGE_GROUP_BOOK_LIST,
                    LIVE2D_PAGE_GROUP_SEARCH,
                ],
            },
            {
                "selector": ".user-menu-trigger",
                "texts": [str(_("This menu leads to your profile settings and account summary."))],
                "pageGroups": [LIVE2D_PAGE_GROUP_HOME, LIVE2D_PAGE_GROUP_PROFILE, LIVE2D_PAGE_GROUP_MANAGE],
            },
        ],
    }


def _normalize_live2d_message_list(value):
    if not isinstance(value, (list, tuple)):
        return []
    normalized = []
    for item in value:
        message = str(item or "").strip()
        if message:
            normalized.append(message)
    return normalized


def normalize_live2d_tips_config(value):
    raw = value if isinstance(value, dict) else {}
    pages = raw.get("pages") if isinstance(raw.get("pages"), dict) else {}
    rules = raw.get("rules") if isinstance(raw.get("rules"), list) else []
    normalized_rules = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        selector = str(rule.get("selector") or "").strip()
        texts = _normalize_live2d_message_list(rule.get("texts"))
        page_groups = rule.get("pageGroups") if isinstance(rule.get("pageGroups"), list) else []
        normalized_page_groups = [group for group in page_groups if group in LIVE2D_PAGE_GROUPS]
        if selector and texts:
            normalized_rules.append(
                {
                    "selector": selector,
                    "texts": texts,
                    "pageGroups": normalized_page_groups,
                }
            )
    return {
        "welcome": _normalize_live2d_message_list(raw.get("welcome")),
        "idle": _normalize_live2d_message_list(raw.get("idle")),
        "touch": _normalize_live2d_message_list(raw.get("touch")),
        "pages": {
            group: _normalize_live2d_message_list(pages.get(group))
            for group in LIVE2D_PAGE_GROUPS
        },
        "rules": normalized_rules,
    }


def _merge_live2d_message_lists(primary, secondary):
    merged = []
    seen = set()
    for collection in (primary, secondary):
        for item in collection:
            if item not in seen:
                seen.add(item)
                merged.append(item)
    return merged


def merge_live2d_tips_config(mode, builtin_config, custom_config):
    builtin = normalize_live2d_tips_config(builtin_config)
    custom = normalize_live2d_tips_config(custom_config)
    if mode == LIVE2D_TIPS_MODE_BUILTIN:
        return builtin
    if mode == LIVE2D_TIPS_MODE_CUSTOM:
        return custom
    return {
        "welcome": _merge_live2d_message_lists(builtin["welcome"], custom["welcome"]),
        "idle": _merge_live2d_message_lists(builtin["idle"], custom["idle"]),
        "touch": _merge_live2d_message_lists(builtin["touch"], custom["touch"]),
        "pages": {
            group: _merge_live2d_message_lists(builtin["pages"].get(group, []), custom["pages"].get(group, []))
            for group in LIVE2D_PAGE_GROUPS
        },
        "rules": builtin["rules"] + custom["rules"],
    }


def parse_live2d_tip_lines(value):
    if value in (None, ""):
        return []
    return [line.strip() for line in str(value).splitlines() if line.strip()]


def get_live2d_page_group(url_name):
    normalized = str(url_name or "").strip()
    if normalized in {"blog-home", "dashboard"}:
        return LIVE2D_PAGE_GROUP_HOME
    if normalized == "article-list":
        return LIVE2D_PAGE_GROUP_ARTICLE_LIST
    if normalized == "blog-detail":
        return LIVE2D_PAGE_GROUP_ARTICLE_DETAIL
    if normalized == "book-list":
        return LIVE2D_PAGE_GROUP_BOOK_LIST
    if normalized == "book-detail":
        return LIVE2D_PAGE_GROUP_BOOK_DETAIL
    if normalized in {"blog-tags", "blog-tag-detail"}:
        return LIVE2D_PAGE_GROUP_TAG_PAGES
    if normalized == "blog-search":
        return LIVE2D_PAGE_GROUP_SEARCH
    if normalized in {"blog-share-detail", "book-share-detail"}:
        return LIVE2D_PAGE_GROUP_PUBLIC_SHARE
    if normalized == "manage-home" or normalized.startswith("manage-"):
        return LIVE2D_PAGE_GROUP_MANAGE
    if normalized.startswith("profile"):
        return LIVE2D_PAGE_GROUP_PROFILE
    return ""


def is_live2d_page_enabled(site_setting, url_name):
    page_group = get_live2d_page_group(url_name)
    if not page_group:
        return False
    setting_key = f"live2d_show_on_{page_group}"
    return bool(site_setting.get(setting_key, SITE_SETTING_DEFINITIONS.get(setting_key, {}).get("default", False)))


def _normalize_live2d_remote_base_url(url):
    normalized = str(url or "").strip()
    if not normalized:
        return ""
    parsed = urlsplit(normalized)
    if parsed.netloc.lower() == "github.com":
        path_parts = [part for part in parsed.path.split("/") if part]
        if len(path_parts) >= 4 and path_parts[2] in {"tree", "blob"}:
            owner = path_parts[0]
            repo = path_parts[1]
            ref = path_parts[3]
            remainder = "/".join(path_parts[4:]).strip("/")
            suffix = f"/{remainder}" if remainder else ""
            return f"https://fastly.jsdelivr.net/gh/{owner}/{repo}@{ref}{suffix}/"
        if len(path_parts) >= 2:
            owner = path_parts[0]
            repo = path_parts[1]
            return f"https://fastly.jsdelivr.net/gh/{owner}/{repo}/"
    return normalized


def _build_live2d_entry_urls_from_autoload(autoload_url, waifu_path, assets_base):
    base_url = _normalize_live2d_remote_base_url(autoload_url or LIVE2D_DEFAULT_CDN_AUTOLOAD_URL)
    if "/" in base_url:
        base_url = base_url.rsplit("/", 1)[0] + "/"
    script_url = posixpath.join(base_url, "waifu-tips.js") if base_url else ""
    style_url = posixpath.join(base_url, "waifu.css") if base_url else ""
    resolved_waifu_path = str(waifu_path or "").strip() or (posixpath.join(base_url, "waifu-tips.json") if base_url else "")
    return {
        "scriptUrl": script_url,
        "styleUrl": style_url,
        "waifuPath": resolved_waifu_path,
        "assetsBase": _normalize_live2d_remote_base_url(assets_base or LIVE2D_DEFAULT_CDN_ASSETS_BASE),
        "cubism2Path": posixpath.join(base_url, "live2d.min.js") if base_url else "",
        "cubism5Path": LIVE2D_DEFAULT_CUBISM5_PATH,
    }


def _build_live2d_media_url(relative_path):
    normalized = str(relative_path or "").strip().replace("\\", "/").lstrip("/")
    if not normalized:
        return ""
    return settings.MEDIA_URL.rstrip("/") + "/" + normalized


def build_live2d_effective_tips_config(site_setting):
    custom_config = normalize_live2d_tips_config(site_setting.get("live2d_tips_config", {}))
    mode = site_setting.get("live2d_tips_mode") or LIVE2D_TIPS_MODE_BUILTIN
    if mode not in LIVE2D_TIPS_MODE_CHOICES:
        mode = LIVE2D_TIPS_MODE_BUILTIN
    return merge_live2d_tips_config(mode, build_default_live2d_tips_config(), custom_config)


def _build_live2d_widget_bundle_entry(bundle_manifest, extract_root):
    manifest = bundle_manifest if isinstance(bundle_manifest, dict) else {}
    entry = manifest.get("entry") if isinstance(manifest.get("entry"), dict) else {}
    if not extract_root or not entry:
        return {}
    return {
        "scriptUrl": _build_live2d_media_url(posixpath.join(extract_root, entry.get("js") or "")),
        "styleUrl": _build_live2d_media_url(posixpath.join(extract_root, entry.get("css") or "")),
        "waifuPath": _build_live2d_media_url(posixpath.join(extract_root, entry.get("waifuPath") or "")),
        "assetsBase": _build_live2d_media_url(posixpath.join(extract_root, entry.get("assetsBase") or "")),
        "cubism2Path": posixpath.join(_normalize_live2d_remote_base_url(LIVE2D_DEFAULT_CDN_AUTOLOAD_URL).rsplit("/", 1)[0] + "/", "live2d.min.js"),
        "cubism5Path": LIVE2D_DEFAULT_CUBISM5_PATH,
    }


def _build_live2d_cubism_entry(bundle_manifest, extract_root):
    manifest = bundle_manifest if isinstance(bundle_manifest, dict) else {}
    models = manifest.get("models") if isinstance(manifest.get("models"), list) else []
    if not extract_root or not models:
        return {}
    resolved_models = []
    for model in models:
        if not isinstance(model, dict):
            continue
        model_json = str(model.get("modelJson") or "").strip()
        if not model_json:
            continue
        resolved_models.append(
            {
                "id": int(model.get("id", 0) or 0),
                "name": str(model.get("name") or "").strip() or f"Model {model.get('id', 0)}",
                "modelJsonUrl": _build_live2d_media_url(posixpath.join(extract_root, model_json)),
                "groupId": str(model.get("groupId") or "").strip() or str(model.get("name") or "").strip() or f"model-{int(model.get('id', 0) or 0)}",
                "textureVariantId": str(model.get("textureVariantId") or "").strip() or f"variant-{int(model.get('id', 0) or 0)}",
                "textureVariantName": str(model.get("textureVariantName") or "").strip() or str(model.get("name") or "").strip() or f"Variant {int(model.get('id', 0) or 0)}",
                "expressions": model.get("expressions") if isinstance(model.get("expressions"), list) else [],
                "motionGroups": model.get("motionGroups") if isinstance(model.get("motionGroups"), list) else [],
                "hitMotionGroups": model.get("hitMotionGroups") if isinstance(model.get("hitMotionGroups"), list) else [],
                "hasPhysics": bool(model.get("hasPhysics")),
                "hasPose": bool(model.get("hasPose")),
                "hasUserData": bool(model.get("hasUserData")),
                "hasDisplayInfo": bool(model.get("hasDisplayInfo")),
                "hasSound": bool(model.get("hasSound")),
            }
        )
    if not resolved_models:
        return {}
    return {
        "models": resolved_models,
        "pixiUrl": LIVE2D_PIXI_JS_URL,
        "rendererUrl": LIVE2D_PIXI_LIVE2D_DISPLAY_URL,
        "cubismCoreUrl": LIVE2D_DEFAULT_CUBISM5_PATH,
    }


def build_live2d_runtime_config(site_setting, request=None):
    if not site_setting.get("live2d_enabled"):
        return None
    url_name = getattr(getattr(request, "resolver_match", None), "url_name", "") if request is not None else ""
    page_group = get_live2d_page_group(url_name)
    if request is not None and not is_live2d_page_enabled(site_setting, url_name):
        return None
    source_type = site_setting.get("live2d_source_type") or LIVE2D_SOURCE_CDN
    if source_type not in LIVE2D_SOURCE_CHOICES:
        source_type = LIVE2D_SOURCE_CDN
    if source_type == LIVE2D_SOURCE_WIDGET_BUNDLE:
        entry = _build_live2d_widget_bundle_entry(site_setting.get("live2d_widget_bundle_manifest", {}), site_setting.get("live2d_widget_bundle_extract_root", ""))
        if not entry or not entry.get("scriptUrl") or not entry.get("styleUrl") or not entry.get("waifuPath"):
            return None
        available_models = site_setting.get("live2d_widget_bundle_manifest", {}).get("models", []) if isinstance(site_setting.get("live2d_widget_bundle_manifest", {}), dict) else []
        engine = LIVE2D_BUNDLE_ENGINE
    elif source_type == LIVE2D_SOURCE_CUBISM_BUNDLE:
        entry = _build_live2d_cubism_entry(site_setting.get("live2d_cubism_bundle_manifest", {}), site_setting.get("live2d_cubism_bundle_extract_root", ""))
        if not entry or not entry.get("models"):
            return None
        available_models = site_setting.get("live2d_cubism_bundle_manifest", {}).get("models", []) if isinstance(site_setting.get("live2d_cubism_bundle_manifest", {}), dict) else []
        engine = LIVE2D_CUBISM_BUNDLE_ENGINE
    else:
        entry = _build_live2d_entry_urls_from_autoload(
            site_setting.get("live2d_cdn_autoload_url"),
            site_setting.get("live2d_cdn_waifu_path"),
            site_setting.get("live2d_cdn_assets_base"),
        )
        available_models = []
        engine = LIVE2D_BUNDLE_ENGINE
    runtime_config = {
        "enabled": True,
        "sourceType": source_type,
        "engine": engine,
        "randomModel": bool(site_setting.get("live2d_random_model", True)),
        "modelId": int(site_setting.get("live2d_model_id", 0) or 0),
        "pageGroup": page_group,
        "entry": entry,
        "messages": {
            "welcomeBack": str(_("Welcome back.")),
            "goodbye": str(_("See you next time.")),
            "modelSwitched": str(_("Model switched.")),
            "textureSwitched": str(_("Appearance switched.")),
            "expressionSwitched": str(_("Expression switched.")),
            "expressionUnavailable": str(_("The current model does not provide switchable expressions.")),
            "motionPlayed": str(_("Motion played.")),
            "motionUnavailable": str(_("The current model does not provide switchable motions.")),
            "photoSaved": str(_("Photo saved.")),
            "photoUnavailable": str(_("Photo is not available right now.")),
            "textureUnavailable": str(_("The current model does not support switching appearance.")),
            "textureSwitchFailed": str(_("Appearance switching failed. Please try again later.")),
            "modelSwitchFailed": str(_("Model switching failed. Your current environment may not support this renderer.")),
            "cubismUnsupported": str(_("Your current environment does not support Cubism rendering.")),
            "live2dLoadFailed": str(_("Live2D failed to load. Please try again later.")),
        },
        "tips": {
            "enabled": bool(site_setting.get("live2d_tips_enabled", True)),
            "mode": site_setting.get("live2d_tips_mode") or LIVE2D_TIPS_MODE_BUILTIN,
            "config": build_live2d_effective_tips_config(site_setting),
        },
        "availableModels": available_models,
    }
    return runtime_config


def _normalize_live2d_bundle_path(path):
    normalized = str(path or "").replace("\\", "/").strip("/")
    if not normalized or normalized.startswith("http://") or normalized.startswith("https://") or normalized.startswith("//"):
        raise ValueError(str(_("Bundle paths must stay inside the uploaded package.")))
    parts = [part for part in normalized.split("/") if part not in {"", "."}]
    if any(part == ".." for part in parts):
        raise ValueError(str(_("Bundle paths cannot escape the uploaded package root.")))
    return "/".join(parts)


def _resolve_live2d_bundle_relative_path(base_path, reference_path):
    base_dir = posixpath.dirname(str(base_path or "").replace("\\", "/"))
    combined = posixpath.join(base_dir, str(reference_path or "")) if base_dir else str(reference_path or "")
    return _normalize_live2d_bundle_path(combined)


def _validate_live2d_bundle_models(models):
    if not isinstance(models, list) or not models:
        raise ValueError(str(_("The bundle manifest must define at least one model.")))
    normalized_models = []
    seen_model_ids = set()
    for model in models:
        if not isinstance(model, dict):
            raise ValueError(str(_("Every bundle model entry must be an object.")))
        model_id = model.get("id")
        model_name = str(model.get("name") or "").strip()
        try:
            normalized_id = int(model_id)
        except (TypeError, ValueError):
            raise ValueError(str(_("Every bundle model must have a numeric id.")))
        if normalized_id in seen_model_ids:
            raise ValueError(str(_("Bundle model ids must be unique.")))
        seen_model_ids.add(normalized_id)
        normalized_models.append({"id": normalized_id, "name": model_name or f"Model {normalized_id}"})
    return normalized_models


def validate_live2d_widget_bundle_manifest(manifest):
    if not isinstance(manifest, dict):
        raise ValueError(str(_("The bundle manifest must be a JSON object.")))
    version = manifest.get("version")
    engine = str(manifest.get("engine") or "").strip()
    if version != LIVE2D_BUNDLE_VERSION:
        raise ValueError(str(_("Unsupported bundle manifest version.")))
    if engine != LIVE2D_BUNDLE_ENGINE:
        raise ValueError(str(_("Unsupported bundle engine.")))
    raw_entry = manifest.get("entry")
    if not isinstance(raw_entry, dict):
        raise ValueError(str(_("The bundle manifest must include an entry section.")))
    normalized_entry = {
        "js": _normalize_live2d_bundle_path(raw_entry.get("js")),
        "css": _normalize_live2d_bundle_path(raw_entry.get("css")),
        "waifuPath": _normalize_live2d_bundle_path(raw_entry.get("waifuPath")),
        "assetsBase": _normalize_live2d_bundle_path(raw_entry.get("assetsBase")),
    }
    normalized_models = _validate_live2d_bundle_models(manifest.get("models"))
    defaults = manifest.get("defaults") if isinstance(manifest.get("defaults"), dict) else {}
    try:
        default_model_id = int(defaults.get("modelId", normalized_models[0]["id"]))
    except (TypeError, ValueError):
        default_model_id = normalized_models[0]["id"]
    if default_model_id not in {model["id"] for model in normalized_models}:
        default_model_id = normalized_models[0]["id"]
    default_position = str(defaults.get("position") or LIVE2D_POSITION_LEFT)
    if default_position not in LIVE2D_POSITION_CHOICES:
        default_position = LIVE2D_POSITION_LEFT
    try:
        default_scale = Decimal(str(defaults.get("scale", "1")))
    except (InvalidOperation, TypeError, ValueError):
        default_scale = Decimal("1")
    return {
        "version": LIVE2D_BUNDLE_VERSION,
        "engine": LIVE2D_BUNDLE_ENGINE,
        "entry": normalized_entry,
        "models": normalized_models,
        "defaults": {
            "modelId": default_model_id,
            "position": default_position,
            "scale": str(default_scale),
        },
    }


def validate_live2d_cubism_bundle_manifest(manifest):
    if not isinstance(manifest, dict):
        raise ValueError(str(_("The bundle manifest must be a JSON object.")))
    version = manifest.get("version")
    engine = str(manifest.get("engine") or "").strip()
    if version != LIVE2D_BUNDLE_VERSION:
        raise ValueError(str(_("Unsupported bundle manifest version.")))
    if engine != LIVE2D_CUBISM_BUNDLE_ENGINE:
        raise ValueError(str(_("Unsupported bundle engine.")))
    normalized_models = _validate_live2d_bundle_models(manifest.get("models"))
    defaults = manifest.get("defaults") if isinstance(manifest.get("defaults"), dict) else {}
    manifest_models = manifest.get("models") if isinstance(manifest.get("models"), list) else []
    normalized_cubism_models = []
    seen_variant_keys = set()
    for index, normalized_model in enumerate(normalized_models):
        raw_model = manifest_models[index] if index < len(manifest_models) and isinstance(manifest_models[index], dict) else {}
        model_json = _normalize_live2d_bundle_path(raw_model.get("modelJson"))
        group_id = str(raw_model.get("groupId") or "").strip() or normalized_model["name"] or f"model-{normalized_model['id']}"
        texture_variant_id = str(raw_model.get("textureVariantId") or "").strip() or f"variant-{normalized_model['id']}"
        texture_variant_name = str(raw_model.get("textureVariantName") or "").strip() or normalized_model["name"] or f"Variant {normalized_model['id']}"
        variant_key = (group_id, texture_variant_id)
        if variant_key in seen_variant_keys:
            raise ValueError(str(_("Each Cubism model variant must use a unique groupId + textureVariantId combination.")))
        seen_variant_keys.add(variant_key)
        normalized_cubism_models.append(
            {
                "id": normalized_model["id"],
                "name": normalized_model["name"],
                "modelJson": model_json,
                "groupId": group_id,
                "textureVariantId": texture_variant_id,
                "textureVariantName": texture_variant_name,
            }
        )
    try:
        default_model_id = int(defaults.get("modelId", normalized_cubism_models[0]["id"]))
    except (TypeError, ValueError):
        default_model_id = normalized_cubism_models[0]["id"]
    if default_model_id not in {model["id"] for model in normalized_cubism_models}:
        default_model_id = normalized_cubism_models[0]["id"]
    try:
        default_scale = Decimal(str(defaults.get("scale", "1")))
    except (InvalidOperation, TypeError, ValueError):
        default_scale = Decimal("1")
    return {
        "version": LIVE2D_BUNDLE_VERSION,
        "engine": LIVE2D_CUBISM_BUNDLE_ENGINE,
        "models": normalized_cubism_models,
        "defaults": {
            "modelId": default_model_id,
            "scale": str(default_scale),
        },
    }


def _extract_cubism_model_dependencies(model_definition):
    references = []
    file_references = model_definition.get("FileReferences") if isinstance(model_definition, dict) else {}
    if not isinstance(file_references, dict):
        return references
    moc_path = file_references.get("Moc")
    if moc_path:
        references.append(moc_path)
    for texture_path in file_references.get("Textures", []) if isinstance(file_references.get("Textures"), list) else []:
        if texture_path:
            references.append(texture_path)
    for optional_key in ("Physics", "Pose", "UserData", "DisplayInfo"):
        optional_path = file_references.get(optional_key)
        if optional_path:
            references.append(optional_path)
    expressions = file_references.get("Expressions", []) if isinstance(file_references.get("Expressions"), list) else []
    for expression in expressions:
        if isinstance(expression, dict) and expression.get("File"):
            references.append(expression.get("File"))
    motions = file_references.get("Motions", {}) if isinstance(file_references.get("Motions"), dict) else {}
    for motion_group in motions.values():
        if not isinstance(motion_group, list):
            continue
        for motion in motion_group:
            if isinstance(motion, dict) and motion.get("File"):
                references.append(motion.get("File"))
            if isinstance(motion, dict) and motion.get("Sound"):
                references.append(motion.get("Sound"))
    return references


def _extract_cubism_model_runtime_metadata(model_definition):
    file_references = model_definition.get("FileReferences") if isinstance(model_definition, dict) else {}
    expressions = []
    motion_groups = []
    hit_motion_groups = []
    has_sound = False
    if not isinstance(file_references, dict):
        return {
            "expressions": expressions,
            "motionGroups": motion_groups,
            "hitMotionGroups": hit_motion_groups,
            "hasPhysics": False,
            "hasPose": False,
            "hasUserData": False,
            "hasDisplayInfo": False,
            "hasSound": False,
        }
    for expression in file_references.get("Expressions", []) if isinstance(file_references.get("Expressions"), list) else []:
        if not isinstance(expression, dict):
            continue
        expression_file = str(expression.get("File") or "").strip()
        expression_name = str(expression.get("Name") or "").strip()
        if not expression_file:
            continue
        expressions.append(
            {
                "name": expression_name or Path(expression_file).stem.replace(".exp3", ""),
                "file": expression_file,
            }
        )
    motions = file_references.get("Motions", {}) if isinstance(file_references.get("Motions"), dict) else {}
    for group_name, motion_group in motions.items():
        normalized_group_name = str(group_name or "").strip()
        normalized_group_key = normalized_group_name.replace("_", "").replace("-", "").lower()
        if not normalized_group_name:
            continue
        motion_groups.append(normalized_group_name)
        if normalized_group_key in {"tapbody", "tap", "touchbody", "bodytap"}:
            hit_motion_groups.append(normalized_group_name)
        if not isinstance(motion_group, list):
            continue
        for motion in motion_group:
            if isinstance(motion, dict) and motion.get("Sound"):
                has_sound = True
    return {
        "expressions": expressions,
        "motionGroups": motion_groups,
        "hitMotionGroups": hit_motion_groups,
        "hasPhysics": bool(file_references.get("Physics")),
        "hasPose": bool(file_references.get("Pose")),
        "hasUserData": bool(file_references.get("UserData")),
        "hasDisplayInfo": bool(file_references.get("DisplayInfo")),
        "hasSound": has_sound,
    }


def _read_cubism_model_definition(archive, model_json_path):
    with archive.open(model_json_path) as model_json_file:
        try:
            return json.loads(model_json_file.read().decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise ValueError(str(_("A Cubism model3.json file is not valid UTF-8 JSON.")))


def _validate_cubism_model_dependencies(archive, normalized_members, model_json_path):
    model_definition = _read_cubism_model_definition(archive, model_json_path)
    for dependency in _extract_cubism_model_dependencies(model_definition):
        resolved_dependency = _resolve_live2d_bundle_relative_path(model_json_path, dependency)
        if resolved_dependency not in normalized_members:
            raise ValueError(str(_("The Cubism bundle is missing a file referenced by model3.json.")))
    return model_definition


def _discover_live2d_cubism_models(normalized_members):
    model_paths = sorted(path for path in normalized_members if path.lower().endswith(".model3.json"))
    if not model_paths:
        raise ValueError(str(_("The Cubism bundle must include at least one model3.json file or a manifest.json file.")))
    discovered_models = []
    for index, model_path in enumerate(model_paths):
        model_name = Path(model_path).stem.replace(".model3", "")
        parent_name = Path(model_path).parent.name.strip()
        discovered_models.append(
            {
                "id": index,
                "name": parent_name or model_name or f"Model {index}",
                "modelJson": model_path,
                "groupId": parent_name or model_name or f"model-{index}",
                "textureVariantId": "default",
                "textureVariantName": str(_("Default")),
            }
        )
    return {
        "version": LIVE2D_BUNDLE_VERSION,
        "engine": LIVE2D_CUBISM_BUNDLE_ENGINE,
        "models": discovered_models,
        "defaults": {
            "modelId": discovered_models[0]["id"],
            "scale": "1",
        },
    }


def inspect_live2d_cubism_bundle(uploaded_file):
    if uploaded_file is None:
        raise ValueError(str(_("Please upload a Cubism runtime bundle file.")))
    file_name = str(getattr(uploaded_file, "name", "") or "")
    if not file_name.lower().endswith(".zip"):
        raise ValueError(str(_("The Cubism runtime bundle must be uploaded as a zip file.")))
    file_size = getattr(uploaded_file, "size", 0) or 0
    if file_size > LIVE2D_BUNDLE_MAX_SIZE_BYTES:
        raise ValueError(str(_("The Cubism runtime bundle is too large.")))
    try:
        uploaded_file.seek(0)
    except Exception:
        pass
    with zipfile.ZipFile(uploaded_file) as archive:
        manifest_name = ""
        normalized_members = set()
        for member in archive.namelist():
            normalized_member = _normalize_live2d_bundle_path(member)
            normalized_members.add(normalized_member)
            if normalized_member == "manifest.json":
                manifest_name = member
        if manifest_name:
            with archive.open(manifest_name) as manifest_file:
                try:
                    manifest = json.loads(manifest_file.read().decode("utf-8"))
                except (UnicodeDecodeError, ValueError):
                    raise ValueError(str(_("The bundle manifest is not valid UTF-8 JSON.")))
            normalized_manifest = validate_live2d_cubism_bundle_manifest(manifest)
        else:
            normalized_manifest = _discover_live2d_cubism_models(normalized_members)
        for model in normalized_manifest["models"]:
            model_json_path = model["modelJson"]
            if model_json_path not in normalized_members:
                raise ValueError(str(_("The bundle is missing one of the declared model3.json files.")))
            model_definition = _validate_cubism_model_dependencies(archive, normalized_members, model_json_path)
            model.update(_extract_cubism_model_runtime_metadata(model_definition))
    try:
        uploaded_file.seek(0)
    except Exception:
        pass
    return normalized_manifest


def inspect_live2d_widget_bundle(uploaded_file):
    if uploaded_file is None:
        raise ValueError(str(_("Please upload a Live2D bundle file.")))
    file_name = str(getattr(uploaded_file, "name", "") or "")
    if not file_name.lower().endswith(".zip"):
        raise ValueError(str(_("The Live2D bundle must be uploaded as a zip file.")))
    file_size = getattr(uploaded_file, "size", 0) or 0
    if file_size > LIVE2D_BUNDLE_MAX_SIZE_BYTES:
        raise ValueError(str(_("The Live2D bundle is too large.")))
    try:
        uploaded_file.seek(0)
    except Exception:
        pass
    with zipfile.ZipFile(uploaded_file) as archive:
        manifest_name = ""
        normalized_members = set()
        for member in archive.namelist():
            normalized_member = _normalize_live2d_bundle_path(member)
            normalized_members.add(normalized_member)
            if normalized_member == "manifest.json":
                manifest_name = member
        if not manifest_name:
            raise ValueError(str(_("The bundle must include a manifest.json file at its root.")))
        with archive.open(manifest_name) as manifest_file:
            try:
                manifest = json.loads(manifest_file.read().decode("utf-8"))
            except (UnicodeDecodeError, ValueError):
                raise ValueError(str(_("The bundle manifest is not valid UTF-8 JSON.")))
        normalized_manifest = validate_live2d_widget_bundle_manifest(manifest)
        referenced_paths = [
            normalized_manifest["entry"]["js"],
            normalized_manifest["entry"]["css"],
            normalized_manifest["entry"]["waifuPath"],
        ]
        for referenced_path in referenced_paths:
            if referenced_path not in normalized_members:
                raise ValueError(str(_("The bundle is missing one of the required entry files.")))
    try:
        uploaded_file.seek(0)
    except Exception:
        pass
    return normalized_manifest


def _delete_storage_directory(relative_directory):
    normalized = str(relative_directory or "").replace("\\", "/").strip("/")
    if not normalized:
        return
    media_root = Path(settings.MEDIA_ROOT).resolve()
    target_path = (media_root / normalized).resolve()
    if media_root not in target_path.parents and target_path != media_root:
        return
    if target_path.exists() and target_path.is_dir():
        shutil.rmtree(target_path, ignore_errors=True)


def _delete_live2d_bundle_storage(bundle_file_key, extract_root_key, manifest_key, clear_settings=True):
    bundle_file = get_setting(bundle_file_key, "")
    extract_root = get_setting(extract_root_key, "")
    if bundle_file and default_storage.exists(bundle_file):
        default_storage.delete(bundle_file)
    _delete_storage_directory(extract_root)
    if clear_settings:
        SiteSetting.objects.filter(key__in={bundle_file_key, manifest_key, extract_root_key}).delete()


def delete_live2d_widget_bundle(clear_settings=True):
    _delete_live2d_bundle_storage(
        "live2d_widget_bundle_file",
        "live2d_widget_bundle_extract_root",
        "live2d_widget_bundle_manifest",
        clear_settings=clear_settings,
    )


def delete_live2d_cubism_bundle(clear_settings=True):
    _delete_live2d_bundle_storage(
        "live2d_cubism_bundle_file",
        "live2d_cubism_bundle_extract_root",
        "live2d_cubism_bundle_manifest",
        clear_settings=clear_settings,
    )


def _save_live2d_saved_bundle(uploaded_file, inspected_manifest, *, bundle_directory, delete_callback):
    manifest = inspected_manifest
    delete_callback(clear_settings=False)
    bundle_id = uuid.uuid4().hex[:12]
    bundle_relative_path = str(LIVE2D_BUNDLE_MEDIA_ROOT / bundle_directory / "bundles" / f"{bundle_id}.zip").replace("\\", "/")
    extract_root = str(LIVE2D_BUNDLE_MEDIA_ROOT / bundle_directory / "extracted" / bundle_id).replace("\\", "/")
    saved_path = default_storage.save(bundle_relative_path, uploaded_file)
    extract_root_path = Path(settings.MEDIA_ROOT) / extract_root
    extract_root_path.mkdir(parents=True, exist_ok=True)
    try:
        uploaded_file.seek(0)
    except Exception:
        pass
    with zipfile.ZipFile(uploaded_file) as archive:
        for member in archive.infolist():
            normalized_member = _normalize_live2d_bundle_path(member.filename)
            target_path = (extract_root_path / normalized_member).resolve()
            if extract_root_path.resolve() not in target_path.parents and target_path != extract_root_path.resolve():
                continue
            if member.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
                continue
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, open(target_path, "wb") as destination:
                shutil.copyfileobj(source, destination)
    return {
        "bundle_file": saved_path,
        "bundle_manifest": manifest,
        "bundle_extract_root": extract_root,
    }


def save_live2d_widget_bundle(uploaded_file, inspected_manifest=None):
    manifest = inspected_manifest or inspect_live2d_widget_bundle(uploaded_file)
    return _save_live2d_saved_bundle(uploaded_file, manifest, bundle_directory="widget", delete_callback=delete_live2d_widget_bundle)


def save_live2d_cubism_bundle(uploaded_file, inspected_manifest=None):
    manifest = inspected_manifest or inspect_live2d_cubism_bundle(uploaded_file)
    return _save_live2d_saved_bundle(uploaded_file, manifest, bundle_directory="cubism", delete_callback=delete_live2d_cubism_bundle)


def get_site_setting():
    values = {entry.key: _resolve_setting_value(entry.key, entry.value) for entry in SiteSetting.objects.filter(key__in=SITE_SETTING_DEFINITIONS)}
    for key, definition in SITE_SETTING_DEFINITIONS.items():
        values.setdefault(key, definition["default"])
    return values


def get_or_create_site_setting():
    return get_site_setting()


def get_setting(key, default=None):
    if key not in SITE_SETTING_DEFINITIONS:
        raise KeyError(key)
    entry = SiteSetting.objects.filter(key=key).values_list("value", flat=True).first()
    if entry is None:
        return SITE_SETTING_DEFINITIONS[key]["default"] if default is None else default
    return _resolve_setting_value(key, entry)


def set_setting(key, value):
    if key not in SITE_SETTING_DEFINITIONS:
        raise KeyError(key)
    serialized = SITE_SETTING_DEFINITIONS[key]["serialize"](value)
    SiteSetting.objects.update_or_create(key=key, defaults={"value": serialized})


def set_settings(mapping):
    for key, value in mapping.items():
        set_setting(key, value)


def reset_site_settings():
    for file_key in SITE_SETTING_FILE_KEYS:
        if file_key == "live2d_widget_bundle_file":
            delete_live2d_widget_bundle(clear_settings=False)
        elif file_key == "live2d_cubism_bundle_file":
            delete_live2d_cubism_bundle(clear_settings=False)
        else:
            delete_setting_file(file_key)
    SiteSetting.objects.all().delete()


def save_setting_file(key, uploaded_file):
    if key not in SITE_SETTING_FILE_KEYS:
        raise KeyError(key)
    delete_setting_file(key)
    if uploaded_file is None:
        set_setting(key, "")
        return ""
    saved_path = default_storage.save(f"site/{uploaded_file.name}", uploaded_file)
    set_setting(key, saved_path)
    return saved_path


def delete_setting_file(key):
    if key not in SITE_SETTING_FILE_KEYS:
        raise KeyError(key)
    current_path = get_setting(key, "")
    if current_path and default_storage.exists(current_path):
        default_storage.delete(current_path)
    SiteSetting.objects.filter(key=key).delete()


def get_setting_file_url(key):
    path = get_setting(key, "")
    if not path:
        return ""
    try:
        return default_storage.url(path)
    except Exception:
        return ""


def iter_live2d_bundle_relative_paths():
    relative_paths = []
    for extract_root_key in ("live2d_widget_bundle_extract_root", "live2d_cubism_bundle_extract_root"):
        extract_root = str(get_setting(extract_root_key, "") or "").replace("\\", "/").strip("/")
        if not extract_root:
            continue
        root_path = Path(settings.MEDIA_ROOT) / extract_root
        if not root_path.exists() or not root_path.is_dir():
            continue
        for path in root_path.rglob("*"):
            if path.is_file():
                relative_paths.append(str(path.relative_to(settings.MEDIA_ROOT)).replace("\\", "/"))
    return relative_paths


def get_normalized_vip_level_names(site_setting=None):
    return [config["display_name"] for config in get_normalized_vip_configs(site_setting)]


def build_default_vip_config(level):
    money_discount = min(Decimal("0.10") * Decimal(level), Decimal("1"))
    points_discount = min(Decimal("0.05") * Decimal(level), Decimal("1"))
    money_reward = min(Decimal("0.10") * Decimal(level), Decimal("1"))
    points_reward = min(Decimal("0.05") * Decimal(level), Decimal("1"))
    return {
        "display_name": f"VIP {level}",
        "money_discount": money_discount,
        "points_discount": points_discount,
        "money_reward": money_reward,
        "points_reward": points_reward,
        "daily_login_bonus_money": level * 5,
        "daily_login_bonus_points": level * 5,
        "first_comment_bonus_money": level * 2,
        "first_comment_bonus_points": level * 2,
    }


def _normalize_discount_value(value, default):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default
    if parsed < 0:
        return Decimal("0")
    if parsed > 1:
        return Decimal("1")
    return parsed


def _normalize_non_negative_int_value(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(parsed, 0)


def get_normalized_vip_configs(site_setting=None):
    setting = site_setting or get_site_setting()
    max_level = max(int(setting.get("vip_max_level", 0) or 0), 0)
    configured_items = list(setting.get("vip_configs", []) or [])
    legacy_names = list(setting.get("vip_level_names", []) or [])
    normalized_configs = []
    for level in range(1, max_level + 1):
        default_config = build_default_vip_config(level)
        configured_item = configured_items[level - 1] if level - 1 < len(configured_items) else {}
        if not isinstance(configured_item, dict):
            configured_item = {}
        legacy_name = legacy_names[level - 1] if level - 1 < len(legacy_names) else ""
        display_name = (configured_item.get("display_name") or legacy_name or "").strip() or default_config["display_name"]
        normalized_configs.append(
            {
                "display_name": display_name,
                "money_discount": _normalize_discount_value(configured_item.get("money_discount"), default_config["money_discount"]),
                "points_discount": _normalize_discount_value(configured_item.get("points_discount"), default_config["points_discount"]),
                "money_reward": _normalize_discount_value(configured_item.get("money_reward"), default_config["money_reward"]),
                "points_reward": _normalize_discount_value(configured_item.get("points_reward"), default_config["points_reward"]),
                "daily_login_bonus_money": _normalize_non_negative_int_value(
                    configured_item.get("daily_login_bonus_money"),
                    default_config["daily_login_bonus_money"],
                ),
                "daily_login_bonus_points": _normalize_non_negative_int_value(
                    configured_item.get("daily_login_bonus_points"),
                    default_config["daily_login_bonus_points"],
                ),
                "first_comment_bonus_money": _normalize_non_negative_int_value(
                    configured_item.get("first_comment_bonus_money"),
                    default_config["first_comment_bonus_money"],
                ),
                "first_comment_bonus_points": _normalize_non_negative_int_value(
                    configured_item.get("first_comment_bonus_points"),
                    default_config["first_comment_bonus_points"],
                ),
            }
        )
    return normalized_configs


def get_user_vip_level(user, site_setting=None):
    setting = site_setting or get_site_setting()
    if user is None:
        return 0
    group_names = list(user.groups.values_list("name", flat=True))
    normalized_group_names = [group_name for group_name in group_names if group_name]
    for level in range(max(int(setting.get("vip_max_level", 0) or 0), 0), 0, -1):
        if get_vip_group_name(level) in normalized_group_names:
            return level
    if LEGACY_VIP_GROUP_NAME in normalized_group_names:
        return max(int(setting.get("vip_max_level", 0) or 0), 0)
    return 0


def get_user_vip_discounts(user, site_setting=None):
    setting = site_setting or get_site_setting()
    vip_level = get_user_vip_level(user, setting)
    if vip_level <= 0:
        return {
            "vip_level": 0,
            "money_discount": Decimal("0"),
            "points_discount": Decimal("0"),
        }
    configs = get_normalized_vip_configs(setting)
    if vip_level > len(configs):
        return {
            "vip_level": vip_level,
            "money_discount": Decimal("0"),
            "points_discount": Decimal("0"),
        }
    config = configs[vip_level - 1]
    return {
        "vip_level": vip_level,
        "money_discount": config["money_discount"],
        "points_discount": config["points_discount"],
    }


def apply_vip_discount_to_requirement(value, discount):
    if value is None:
        return None
    try:
        normalized_value = int(value)
    except (TypeError, ValueError):
        return value
    if normalized_value <= 0:
        return normalized_value
    discount_value = _normalize_discount_value(discount, Decimal("0"))
    if discount_value <= 0:
        return normalized_value
    discounted = (Decimal(normalized_value) * (Decimal("1") - discount_value)).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return max(int(discounted), 0)


def build_business_identity_choices(site_setting=None):
    setting = site_setting or get_site_setting()
    choices = [(get_default_business_group_name(), _("Normal user"))]
    for level, config in enumerate(get_normalized_vip_configs(setting), start=1):
        choices.append((get_vip_group_name(level), config["display_name"]))
    return choices


def resolve_business_identity_from_group_names(group_names, site_setting=None):
    setting = site_setting or get_site_setting()
    available_choices = {value for value, _label in build_business_identity_choices(setting)}
    normalized_group_names = [group_name for group_name in group_names if group_name]
    for level in range(max(int(setting.get("vip_max_level", 0) or 0), 0), 0, -1):
        vip_group_name = get_vip_group_name(level)
        if vip_group_name in normalized_group_names and vip_group_name in available_choices:
            return vip_group_name
    if LEGACY_VIP_GROUP_NAME in normalized_group_names:
        highest_level = max(int(setting.get("vip_max_level", 0) or 0), 0)
        if highest_level > 0:
            highest_vip_group_name = get_vip_group_name(highest_level)
            if highest_vip_group_name in available_choices:
                return highest_vip_group_name
    default_group_name = get_default_business_group_name()
    if default_group_name in available_choices:
        return default_group_name
    return normalized_group_names[0] if normalized_group_names else default_group_name


def build_user_business_identity_summary(user, site_setting=None):
    setting = site_setting or get_site_setting()
    group_names = list(user.groups.values_list("name", flat=True)) if user is not None else []
    identity_value = resolve_business_identity_from_group_names(group_names, setting)
    identity_label_map = dict(build_business_identity_choices(setting))
    default_group_name = get_default_business_group_name()
    identity_label = str(identity_label_map.get(identity_value) or identity_value or _("Normal user"))
    vip_discounts = get_user_vip_discounts(user, setting)
    return {
        "value": identity_value,
        "label": identity_label,
        "is_vip": identity_value != default_group_name,
        "vip_level": vip_discounts["vip_level"],
        "money_discount": vip_discounts["money_discount"],
        "points_discount": vip_discounts["points_discount"],
    }


def format_share_link_expires_display(share_link):
    if not share_link:
        return ""
    if share_link.expires_at is None:
        return str(_("Never expires"))
    return timezone.localtime(share_link.expires_at).strftime("%Y-%m-%d %H:%M")


def check_comment_permission(user, site_setting=None):
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff or user.is_superuser:
        return True
    setting = site_setting or get_site_setting()
    if not setting.get("allow_user_comment"):
        return False
    if setting.get("vip_only_comment"):
        identity = build_user_business_identity_summary(user, setting)
        if not identity["is_vip"]:
            return False
    return True


def check_attachment_upload_permission(user, site_setting=None):
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff or user.is_superuser:
        return True
    setting = site_setting or get_site_setting()
    if not setting.get("allow_user_upload_attachment"):
        return False
    if setting.get("vip_only_upload_attachment"):
        identity = build_user_business_identity_summary(user, setting)
        if not identity["is_vip"]:
            return False
    return True


def check_video_upload_permission(user, site_setting=None):
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff or user.is_superuser:
        return True
    setting = site_setting or get_site_setting()
    if not setting.get("allow_user_upload_video"):
        return False
    if setting.get("vip_only_upload_video"):
        identity = build_user_business_identity_summary(user, setting)
        if not identity["is_vip"]:
            return False
    return True


def build_share_expiry_options():
    return [{"value": key, "label": str(option["label"])} for key, option in SHARE_LINK_EXPIRY_OPTIONS.items()]


__all__ = [
    "DASHBOARD_VISIT_TREND_DAYS_7",
    "DASHBOARD_VISIT_TREND_DAYS_14",
    "DASHBOARD_VISIT_TREND_DAYS_30",
    "DASHBOARD_VISIT_TREND_DAY_CHOICES",
    "LIVE2D_SOURCE_CDN",
    "LIVE2D_SOURCE_WIDGET_BUNDLE",
    "LIVE2D_SOURCE_CUBISM_BUNDLE",
    "SHARE_LINK_EXPIRY_OPTIONS",
    "SITE_SETTING_DEFINITIONS",
    "SITE_SETTING_FILE_KEYS",
    "VIP_MAX_LEVEL_LIMIT",
    "build_business_identity_choices",
    "build_default_vip_config",
    "build_share_expiry_options",
    "build_live2d_effective_tips_config",
    "build_live2d_runtime_config",
    "build_user_business_identity_summary",
    "build_visit_trend",
    "apply_vip_discount_to_requirement",
    "check_attachment_upload_permission",
    "check_comment_permission",
    "check_video_upload_permission",
    "delete_live2d_widget_bundle",
    "delete_live2d_cubism_bundle",
    "delete_setting_file",
    "format_share_link_expires_display",
    "get_live2d_page_group",
    "get_normalized_vip_configs",
    "get_normalized_vip_level_names",
    "get_user_vip_discounts",
    "get_user_vip_level",
    "get_or_create_site_setting",
    "get_setting",
    "get_setting_file_url",
    "get_site_setting",
    "get_view_count_window_start",
    "inspect_live2d_widget_bundle",
    "inspect_live2d_cubism_bundle",
    "is_live2d_page_enabled",
    "iter_live2d_bundle_relative_paths",
    "merge_live2d_tips_config",
    "normalize_live2d_tips_config",
    "parse_live2d_tip_lines",
    "record_book_view",
    "record_content_view",
    "record_post_view",
    "reset_site_settings",
    "resolve_business_identity_from_group_names",
    "save_live2d_widget_bundle",
    "save_live2d_cubism_bundle",
    "save_setting_file",
    "set_setting",
    "set_settings",
    "validate_live2d_widget_bundle_manifest",
    "validate_live2d_cubism_bundle_manifest",
]
