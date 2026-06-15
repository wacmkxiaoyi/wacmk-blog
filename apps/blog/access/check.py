from decimal import Decimal, InvalidOperation

from django.db.models import Model
from django.utils.translation import gettext_lazy as _

from apps.blog.auth import get as get_evaluator
from apps.blog.auth.constants import (
    ACCESS_STATUS_GRANTED,
    ACCESS_STATUS_INSUFFICIENT_MONEY,
    ACCESS_STATUS_INSUFFICIENT_POINTS,
    ACCESS_STATUS_PURCHASE_REQUIRED,
)
from apps.blog.models.attachment import Attachment, AttachmentPasswordRecord
from apps.blog.models.book import Book, BookPasswordRecord
from apps.blog.models.post import Post, PostDraft, PostPasswordRecord
from apps.blog.permissions import (
    CONDITION_TYPE_BOOK_ONLY,
    CONDITION_TYPE_ENCRYPTED,
    CONDITION_TYPE_MONEY,
    CONDITION_TYPE_POINTS,
    get_condition_rule_value,
    has_condition_rule,
)
from apps.blog.utils.site import apply_vip_discount_to_requirement, build_user_business_identity_summary, get_user_vip_discounts
from apps.users.models import UserProfile

from .resolver import get_access_handler
from .vip_check import check_is_vip_user

from .common import _check_has_purchase


def _get_password_record(user, obj):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    if isinstance(obj, (Post, PostDraft)):
        return PostPasswordRecord.objects.filter(user=user, post=obj).first()
    if isinstance(obj, Attachment):
        return AttachmentPasswordRecord.objects.filter(user=user, attachment=obj).first()
    if isinstance(obj, Book):
        return BookPasswordRecord.objects.filter(user=user, book=obj).first()
    return None


def build_access_check(obj: Model, user, *, in_book_context=False):
    handler = get_access_handler(obj, user)
    conditions = []
    all_granted = True
    is_vip = check_is_vip_user(user) if user and getattr(user, "is_authenticated", False) else False
    vip_discounts = get_user_vip_discounts(user) if user and getattr(user, "is_authenticated", False) else {
        "vip_level": 0,
        "money_discount": 0,
        "points_discount": 0,
    }
    if user and getattr(user, "is_authenticated", False):
        vip_discounts["vip_label"] = build_user_business_identity_summary(user).get("label", "")
    else:
        vip_discounts["vip_label"] = ""

    if handler.is_author_or_staff(user):
        has_book_only = (
            isinstance(obj, (Post, PostDraft))
            and has_condition_rule(handler.condition_rules, CONDITION_TYPE_BOOK_ONLY)
        )
        all_granted = True
        for rule in _iter_evaluatable_rules(handler):
            item = _build_condition_item(rule["type"], rule.get("value"), vip_discounts=vip_discounts)
            item["status"] = "granted"
            item["action"] = "none"
            conditions.append(item)
        if has_book_only and not in_book_context:
            evaluator = get_evaluator(CONDITION_TYPE_BOOK_ONLY)
            book_only_item = {
                "type": CONDITION_TYPE_BOOK_ONLY,
                "icon": evaluator.icon if evaluator else "book-open-reader",
                "label": str(evaluator.label) if evaluator else _("Book only"),
                "requirement": "—",
                "status": "pending",
                "action": "none",
            }
            conditions.insert(0, book_only_item)
        return {
            "object_type": _resolve_object_type(obj),
            "object_name": _get_object_name(obj),
            "access_scope": getattr(obj, "access_scope", "unified"),
            "is_vip": is_vip,
            "conditions": conditions,
            "all_granted": all_granted,
        }

    password_record = _get_password_record(user, obj)
    has_purchase = _check_has_purchase(user, obj)
    profile = _get_user_profile(user) if user and getattr(user, "is_authenticated", False) else None

    for rule in _iter_evaluatable_rules(handler):
        rule_type = rule["type"]
        rule_value = rule.get("value")
        item = _build_condition_item(rule_type, rule_value, vip_discounts=vip_discounts)
        evaluator = get_evaluator(rule_type)

        if rule_type == CONDITION_TYPE_ENCRYPTED:
            if password_record is not None:
                item["status"] = "granted"
                item["action"] = "none"
            else:
                item["status"] = "pending"
                item["action"] = "password"
                all_granted = False
        elif rule_type == CONDITION_TYPE_MONEY and evaluator is not None:
            eval_result = evaluator.evaluate(user, rule_value, has_purchase=has_purchase, profile=profile)
            status = eval_result.get("status", ACCESS_STATUS_GRANTED)
            item["status"] = "granted" if status == ACCESS_STATUS_GRANTED else status
            if status == ACCESS_STATUS_PURCHASE_REQUIRED:
                item["action"] = "purchase"
                all_granted = False
            elif status == ACCESS_STATUS_INSUFFICIENT_MONEY:
                item["action"] = "none"
                all_granted = False
            elif status == ACCESS_STATUS_GRANTED:
                item["action"] = "none"
        elif evaluator is not None:
            eval_result = evaluator.evaluate(user, rule_value, has_purchase=has_purchase, profile=profile)
            status = eval_result.get("status", ACCESS_STATUS_GRANTED)
            item["status"] = "granted" if status == ACCESS_STATUS_GRANTED else status
            item["action"] = "none"
            if status == ACCESS_STATUS_INSUFFICIENT_POINTS:
                all_granted = False
        conditions.append(item)

    if isinstance(obj, (Post, PostDraft)) and has_condition_rule(handler.condition_rules, CONDITION_TYPE_BOOK_ONLY) and not in_book_context:
        evaluator = get_evaluator(CONDITION_TYPE_BOOK_ONLY)
        book_only_item = {
            "type": CONDITION_TYPE_BOOK_ONLY,
            "icon": evaluator.icon if evaluator else "book-open-reader",
            "label": str(evaluator.label) if evaluator else _("Book only"),
            "requirement": "—",
            "status": "pending",
            "action": "none",
        }
        conditions.insert(0, book_only_item)
        all_granted = False

    return {
        "object_type": _resolve_object_type(obj),
        "object_name": _get_object_name(obj),
        "access_scope": getattr(obj, "access_scope", "unified"),
        "is_vip": is_vip,
        "conditions": conditions,
        "all_granted": all_granted,
    }


def _get_object_name(obj):
    if isinstance(obj, (Post, PostDraft)):
        return getattr(obj, "title", "") or ""
    if isinstance(obj, Attachment):
        return getattr(obj, "title", "") or getattr(obj, "original_filename", "") or ""
    if isinstance(obj, Book):
        return getattr(obj, "name", "") or ""
    return ""


def _iter_evaluatable_rules(handler):
    rules = handler.condition_rules or []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        rule_type = str(rule.get("type") or "").strip().lower()
        if rule_type in (CONDITION_TYPE_BOOK_ONLY,):
            continue
        yield rule


def _build_condition_item(rule_type, rule_value=None, vip_discounts=None):
    evaluator = get_evaluator(rule_type)
    vip_discounts = vip_discounts or {"money_discount": 0, "points_discount": 0}
    requirement_value = rule_value
    original_requirement = rule_value
    discount_rate = None
    discount_applied = False
    if rule_type == CONDITION_TYPE_MONEY and rule_value is not None:
        discount_rate = vip_discounts.get("money_discount", 0)
        requirement_value = apply_vip_discount_to_requirement(rule_value, discount_rate)
        discount_applied = requirement_value != rule_value
    elif rule_type == CONDITION_TYPE_POINTS and rule_value is not None:
        discount_rate = vip_discounts.get("points_discount", 0)
        requirement_value = apply_vip_discount_to_requirement(rule_value, discount_rate)
        discount_applied = requirement_value != rule_value
    discount_percent = ""
    vip_label = ""
    if discount_rate not in (None, "", 0) and discount_applied:
        try:
            discount_percent_value = Decimal(str(discount_rate)) * Decimal("100")
            discount_percent = format(discount_percent_value.normalize(), "f")
            if "." in discount_percent:
                discount_percent = discount_percent.rstrip("0").rstrip(".")
            if not discount_percent:
                discount_percent = "0"
        except (InvalidOperation, TypeError, ValueError):
            discount_percent = ""
        vip_label = str(vip_discounts.get("vip_label") or "")
    if evaluator is not None:
        return {
            "type": rule_type,
            "icon": evaluator.icon,
            "label": str(evaluator.label),
            "requirement": _format_requirement(rule_type, requirement_value),
            "original_requirement": original_requirement,
            "discounted_requirement": requirement_value,
            "discount_rate": str(discount_rate) if discount_rate is not None else "",
            "discount_percent": discount_percent,
            "vip_label": vip_label,
            "discount_applied": discount_applied,
            "status": "pending",
            "action": "none",
        }
    return {
        "type": rule_type,
        "icon": "circle-question",
        "label": rule_type,
        "requirement": str(requirement_value or "—"),
        "original_requirement": original_requirement,
        "discounted_requirement": requirement_value,
        "discount_rate": str(discount_rate) if discount_rate is not None else "",
        "discount_percent": discount_percent,
        "vip_label": vip_label,
        "discount_applied": discount_applied,
        "status": "pending",
        "action": "none",
    }


def _format_requirement(rule_type, rule_value):
    if rule_type in (CONDITION_TYPE_ENCRYPTED,):
        return str(_("Password"))
    if rule_type in (CONDITION_TYPE_MONEY, CONDITION_TYPE_POINTS) and rule_value is not None:
        return str(rule_value)
    return "—"


def _resolve_object_type(obj):
    if isinstance(obj, (Post, PostDraft)):
        return "post"
    if isinstance(obj, Attachment):
        return "attachment"
    if isinstance(obj, Book):
        return "book"
    return "unknown"


def _get_user_profile(user):
    if not getattr(user, "is_authenticated", False):
        return None
    profile, _created = UserProfile.objects.get_or_create(user=user)
    return profile


__all__ = ["build_access_check"]
