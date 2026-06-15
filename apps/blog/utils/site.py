import json
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING

from django.core.files.storage import default_storage
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
SITE_SETTING_FILE_KEYS = {"site_icon", "auth_background", "app_background"}


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


def get_normalized_vip_level_names(site_setting=None):
    return [config["display_name"] for config in get_normalized_vip_configs(site_setting)]


def build_default_vip_config(level):
    money_discount = min(Decimal("0.10") * Decimal(level), Decimal("1"))
    points_discount = min(Decimal("0.05") * Decimal(level), Decimal("1"))
    return {
        "display_name": f"VIP {level}",
        "money_discount": money_discount,
        "points_discount": points_discount,
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


def build_share_expiry_options():
    return [{"value": key, "label": str(option["label"])} for key, option in SHARE_LINK_EXPIRY_OPTIONS.items()]


__all__ = [
    "DASHBOARD_VISIT_TREND_DAYS_7",
    "DASHBOARD_VISIT_TREND_DAYS_14",
    "DASHBOARD_VISIT_TREND_DAYS_30",
    "DASHBOARD_VISIT_TREND_DAY_CHOICES",
    "SHARE_LINK_EXPIRY_OPTIONS",
    "SITE_SETTING_DEFINITIONS",
    "SITE_SETTING_FILE_KEYS",
    "VIP_MAX_LEVEL_LIMIT",
    "build_business_identity_choices",
    "build_default_vip_config",
    "build_share_expiry_options",
    "build_user_business_identity_summary",
    "build_visit_trend",
    "apply_vip_discount_to_requirement",
    "check_attachment_upload_permission",
    "check_comment_permission",
    "delete_setting_file",
    "format_share_link_expires_display",
    "get_normalized_vip_configs",
    "get_normalized_vip_level_names",
    "get_user_vip_discounts",
    "get_user_vip_level",
    "get_or_create_site_setting",
    "get_setting",
    "get_setting_file_url",
    "get_site_setting",
    "get_view_count_window_start",
    "record_book_view",
    "record_content_view",
    "record_post_view",
    "reset_site_settings",
    "resolve_business_identity_from_group_names",
    "save_setting_file",
    "set_setting",
    "set_settings",
]
