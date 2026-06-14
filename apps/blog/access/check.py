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

    if handler.is_author_or_staff(user):
        has_book_only = (
            isinstance(obj, (Post, PostDraft))
            and has_condition_rule(handler.condition_rules, CONDITION_TYPE_BOOK_ONLY)
        )
        all_granted = True
        for rule in _iter_evaluatable_rules(handler):
            item = _build_condition_item(rule["type"], rule.get("value"))
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
        item = _build_condition_item(rule_type, rule_value)
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


def _build_condition_item(rule_type, rule_value=None):
    evaluator = get_evaluator(rule_type)
    if evaluator is not None:
        return {
            "type": rule_type,
            "icon": evaluator.icon,
            "label": str(evaluator.label),
            "requirement": _format_requirement(rule_type, rule_value),
            "status": "pending",
            "action": "none",
        }
    return {
        "type": rule_type,
        "icon": "circle-question",
        "label": rule_type,
        "requirement": str(rule_value or "—"),
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
