from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


CONDITION_TYPE_MONEY = "money"
CONDITION_TYPE_POINTS = "points"
CONDITION_TYPE_ENCRYPTED = "encrypted"
CONDITION_TYPE_BOOK_ONLY = "book_only"
CONDITION_VALUE_TYPES = {CONDITION_TYPE_MONEY, CONDITION_TYPE_POINTS}
CONDITION_PASSWORD_TYPES = {CONDITION_TYPE_ENCRYPTED}
CONDITION_FLAG_TYPES = {CONDITION_TYPE_BOOK_ONLY}
CONDITION_TYPE_CHOICES = [
    (CONDITION_TYPE_MONEY, _("Money")),
    (CONDITION_TYPE_POINTS, _("Points")),
    (CONDITION_TYPE_ENCRYPTED, _("Encrypted")),
    (CONDITION_TYPE_BOOK_ONLY, _("Book only")),
]
CONDITION_TYPE_LABELS = dict(CONDITION_TYPE_CHOICES)
MAX_CONDITION_COUNT = len(CONDITION_TYPE_CHOICES)

ATTACHMENT_ALLOWED_CONDITION_TYPES = {CONDITION_TYPE_MONEY, CONDITION_TYPE_POINTS, CONDITION_TYPE_ENCRYPTED}

ACCESS_PRESENTATION = {
    "public": {"icon": "user-group", "tone": "public", "label": _("Public")},
    "private": {"icon": "user", "tone": "private", "label": _("Private")},
    CONDITION_TYPE_MONEY: {"icon": "coins", "tone": "money", "label": CONDITION_TYPE_LABELS[CONDITION_TYPE_MONEY]},
    CONDITION_TYPE_POINTS: {"icon": "gem", "tone": "points", "label": CONDITION_TYPE_LABELS[CONDITION_TYPE_POINTS]},
    CONDITION_TYPE_ENCRYPTED: {"icon": "lock", "tone": "encrypted", "label": CONDITION_TYPE_LABELS[CONDITION_TYPE_ENCRYPTED]},
    CONDITION_TYPE_BOOK_ONLY: {"icon": "book-open-reader", "tone": "book-only", "label": CONDITION_TYPE_LABELS[CONDITION_TYPE_BOOK_ONLY]},
}


def get_access_presentation(access_type, *, fallback_label=""):
    access_key = str(access_type or "").strip().lower()
    presentation = ACCESS_PRESENTATION.get(access_key, {})
    label = presentation.get("label")
    if not label:
        label = fallback_label or access_key.replace("_", " ").replace("-", " ").title()
    return {
        "type": access_key,
        "icon": presentation.get("icon", "circle-question"),
        "tone": presentation.get("tone", access_key.replace("_", "-")),
        "label": str(label),
    }


def normalize_condition_rules(raw_rules, *, allowed_types=None):
    if raw_rules in (None, ""):
        return []
    if not isinstance(raw_rules, list):
        raise ValidationError(_("Condition data must be a list."))

    if allowed_types is None:
        allowed_types = set(CONDITION_TYPE_LABELS)
    else:
        allowed_types = {str(item).strip().lower() for item in allowed_types if str(item).strip()}

    normalized = []
    seen_types = set()
    for rule in raw_rules:
        if not isinstance(rule, dict):
            raise ValidationError(_("Each condition must be an object."))
        condition_type = str(rule.get("type") or "").strip().lower()
        if condition_type not in CONDITION_TYPE_LABELS or condition_type not in allowed_types:
            raise ValidationError(_("Unknown condition type."))
        if condition_type in seen_types:
            raise ValidationError(_("Each condition type can only be used once."))
        seen_types.add(condition_type)
        if condition_type in CONDITION_VALUE_TYPES:
            raw_value = rule.get("value")
            try:
                condition_value = int(raw_value)
            except (TypeError, ValueError) as exc:
                raise ValidationError(_("Condition value must be a positive integer.")) from exc
            if condition_value < 1:
                raise ValidationError(_("Condition value must be a positive integer."))
            normalized.append({"type": condition_type, "value": condition_value})
            continue
        if condition_type in CONDITION_PASSWORD_TYPES:
            condition_value = str(rule.get("value") or "")
            normalized.append({"type": condition_type, "value": condition_value})
            continue
        normalized.append({"type": condition_type})

    if not normalized:
        raise ValidationError(_("At least one condition is required."))
    return normalized


def get_effective_condition_rules(rules, *, legacy_visibility="", allowed_types=None):
    normalized = []
    if rules not in (None, "", []):
        normalized = normalize_condition_rules(rules, allowed_types=allowed_types)
    return normalized


def get_condition_rule_map(rules, *, legacy_visibility="", allowed_types=None):
    return {
        rule["type"]: rule["value"]
        for rule in get_effective_condition_rules(rules, legacy_visibility=legacy_visibility, allowed_types=allowed_types)
        if rule["type"] in CONDITION_VALUE_TYPES
    }


def get_condition_rule_value(rules, condition_type, *, legacy_visibility="", allowed_types=None):
    return get_condition_rule_map(rules, legacy_visibility=legacy_visibility, allowed_types=allowed_types).get(condition_type)


def get_password_condition_rule(rules, *, legacy_visibility="", allowed_types=None):
    for rule in get_effective_condition_rules(rules, legacy_visibility=legacy_visibility, allowed_types=allowed_types):
        if rule["type"] in CONDITION_PASSWORD_TYPES:
            return rule
    return None


def get_condition_password_value(rules, *, legacy_visibility="", allowed_types=None):
    rule = get_password_condition_rule(rules, legacy_visibility=legacy_visibility, allowed_types=allowed_types)
    return "" if rule is None else str(rule.get("value") or "")


def hash_condition_password(raw_password):
    password = str(raw_password or "").strip()
    if not password:
        return ""
    try:
        identify_hasher(password)
    except ValueError:
        return make_password(password)
    return password


def check_condition_password(rules, raw_password, *, legacy_visibility="", allowed_types=None):
    stored_password = get_condition_password_value(rules, legacy_visibility=legacy_visibility, allowed_types=allowed_types)
    if not stored_password:
        return False
    return check_password(raw_password or "", stored_password)


def has_condition_rule(rules, condition_type, *, legacy_visibility="", allowed_types=None):
    return any(
        rule["type"] == condition_type
        for rule in get_effective_condition_rules(rules, legacy_visibility=legacy_visibility, allowed_types=allowed_types)
    )




def build_condition_summary_items(rules, *, legacy_visibility="", allowed_types=None):
    items = []
    for rule in get_effective_condition_rules(rules, legacy_visibility=legacy_visibility, allowed_types=allowed_types):
        item = get_access_presentation(rule["type"], fallback_label=CONDITION_TYPE_LABELS[rule["type"]])
        if rule["type"] in CONDITION_VALUE_TYPES:
            item["value"] = rule["value"]
        items.append(item)
    return items


__all__ = [name for name in globals() if not name.startswith("_")]
