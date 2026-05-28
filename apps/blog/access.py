from django.db import transaction
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError

from apps.blog.models import ArticlePurchaseRecord, BookPurchaseRecord
from apps.blog.permissions import (
    CONDITION_TYPE_MONEY,
    CONDITION_TYPE_POINTS,
    get_condition_rule_value,
    has_value_condition_rules,
    normalize_condition_rules,
)
from apps.users.models import UserProfile


ACCESS_STATUS_GRANTED = "granted"
ACCESS_STATUS_PURCHASE_REQUIRED = "purchase_required"
ACCESS_STATUS_INSUFFICIENT_MONEY = "insufficient_money"
ACCESS_STATUS_INSUFFICIENT_POINTS = "insufficient_points"
ACCESS_STATUS_INVALID_CONDITION = "invalid_condition"


def get_user_profile(user):
    if not getattr(user, "is_authenticated", False):
        return None
    profile, _created = UserProfile.objects.get_or_create(user=user)
    return profile


def user_has_article_purchase(user, article):
    if not getattr(user, "is_authenticated", False):
        return False
    return ArticlePurchaseRecord.objects.filter(user=user, article=article).exists()


def user_has_book_purchase(user, book):
    if not getattr(user, "is_authenticated", False):
        return False
    return BookPurchaseRecord.objects.filter(user=user, book=book).exists()


def evaluate_condition_access(user, *, rules, has_purchase):
    try:
        normalized_rules = normalize_condition_rules(rules or [])
    except ValidationError:
        return {
            "status": ACCESS_STATUS_INVALID_CONDITION,
            "money_required": None,
            "points_required": None,
            "has_purchase": bool(has_purchase),
        }
    money_required = get_condition_rule_value(normalized_rules, CONDITION_TYPE_MONEY)
    points_required = get_condition_rule_value(normalized_rules, CONDITION_TYPE_POINTS)
    profile = get_user_profile(user)
    current_money = max(getattr(profile, "money", 0), 0) if profile is not None else 0
    current_points = max(getattr(profile, "points", 0), 0) if profile is not None else 0

    if money_required and not has_purchase:
        if current_money < money_required:
            return {
                "status": ACCESS_STATUS_INSUFFICIENT_MONEY,
                "money_required": money_required,
                "points_required": points_required,
                "has_purchase": False,
            }
        return {
            "status": ACCESS_STATUS_PURCHASE_REQUIRED,
            "money_required": money_required,
            "points_required": points_required,
            "has_purchase": False,
        }

    if points_required and current_points < points_required:
        return {
            "status": ACCESS_STATUS_INSUFFICIENT_POINTS,
            "money_required": money_required,
            "points_required": points_required,
            "has_purchase": bool(has_purchase),
        }

    return {
        "status": ACCESS_STATUS_GRANTED,
        "money_required": money_required,
        "points_required": points_required,
        "has_purchase": bool(has_purchase),
    }


def evaluate_article_access(user, article):
    return evaluate_condition_access(
        user,
        rules=article.condition_rules if has_value_condition_rules(article.condition_rules) else [],
        has_purchase=user_has_article_purchase(user, article),
    )


def evaluate_book_access(user, book):
    return evaluate_condition_access(
        user,
        rules=book.condition_rules if has_value_condition_rules(book.condition_rules) else [],
        has_purchase=user_has_book_purchase(user, book),
    )


def purchase_article_access(user, article):
    money_required = get_condition_rule_value(article.condition_rules or [], CONDITION_TYPE_MONEY)
    if not money_required:
        return {"ok": True, "created": False, "message": ""}

    with transaction.atomic():
        profile = UserProfile.objects.select_for_update().get(user=user)
        purchase_record = ArticlePurchaseRecord.objects.select_for_update().filter(user=user, article=article).first()
        if purchase_record is not None:
            return {"ok": True, "created": False, "message": ""}
        if profile.money < 0 or profile.money < money_required:
            return {"ok": False, "created": False, "message": str(_("Insufficient balance."))}
        profile.money -= money_required
        profile.save(update_fields=["money"])
        ArticlePurchaseRecord.objects.create(user=user, article=article, cost_money=money_required)
    return {"ok": True, "created": True, "message": ""}


def purchase_book_access(user, book):
    money_required = get_condition_rule_value(book.condition_rules or [], CONDITION_TYPE_MONEY)
    if not money_required:
        return {"ok": True, "created": False, "message": ""}

    with transaction.atomic():
        profile = UserProfile.objects.select_for_update().get(user=user)
        purchase_record = BookPurchaseRecord.objects.select_for_update().filter(user=user, book=book).first()
        if purchase_record is not None:
            return {"ok": True, "created": False, "message": ""}
        if profile.money < 0 or profile.money < money_required:
            return {"ok": False, "created": False, "message": str(_("Insufficient balance."))}
        profile.money -= money_required
        profile.save(update_fields=["money"])
        BookPurchaseRecord.objects.create(user=user, book=book, cost_money=money_required)
    return {"ok": True, "created": True, "message": ""}


__all__ = [name for name in globals() if not name.startswith("_")]
