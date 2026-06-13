from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.blog.auth import get as get_evaluator
from apps.blog.auth.constants import (
    ACCESS_STATUS_GRANTED,
    ACCESS_STATUS_INSUFFICIENT_MONEY,
    ACCESS_STATUS_INSUFFICIENT_POINTS,
    ACCESS_STATUS_INVALID_CONDITION,
    ACCESS_STATUS_PURCHASE_REQUIRED,
)
from apps.blog.models import ArticlePurchaseRecord, BookPurchaseRecord
from apps.blog.permissions import (
    CONDITION_TYPE_MONEY,
    check_condition_password,
    get_condition_rule_value,
    normalize_condition_rules,
)
from apps.users.models import UserProfile

from .base import BaseAccessHandler


def _get_user_profile(user):
    if not getattr(user, "is_authenticated", False):
        return None
    profile, _created = UserProfile.objects.get_or_create(user=user)
    return profile


def _get_purchase_model_and_field(obj):
    from apps.blog.models import Post as PostModel
    from apps.blog.models import PostDraft
    if isinstance(obj, (PostModel, PostDraft)):
        return ArticlePurchaseRecord, "article"
    return BookPurchaseRecord, "book"


def _check_has_purchase(user, obj):
    PurchaseModel, field_name = _get_purchase_model_and_field(obj)
    if not getattr(user, "is_authenticated", False):
        return False
    return PurchaseModel.objects.filter(user=user, **{field_name: obj}).exists()


def evaluate_condition_access(user, *, rules, has_purchase):
    try:
        normalized_rules = normalize_condition_rules(rules or [])
    except Exception:
        return {
            "status": ACCESS_STATUS_INVALID_CONDITION,
            "money_required": None,
            "points_required": None,
            "has_purchase": bool(has_purchase),
        }

    money_required = get_condition_rule_value(normalized_rules, CONDITION_TYPE_MONEY)
    points_required = get_condition_rule_value(normalized_rules, "points")
    if points_required is None:
        points_required = get_condition_rule_value(normalized_rules, "points")
    profile = _get_user_profile(user)

    result = {
        "status": ACCESS_STATUS_GRANTED,
        "money_required": money_required,
        "points_required": points_required,
        "has_purchase": bool(has_purchase),
    }

    for rule in normalized_rules:
        evaluator = get_evaluator(rule.get("type"))
        if evaluator is None:
            return {
                "status": ACCESS_STATUS_INVALID_CONDITION,
                "money_required": money_required,
                "points_required": points_required,
                "has_purchase": bool(has_purchase),
            }
        rule_result = evaluator.evaluate(
            user,
            rule.get("value"),
            has_purchase=has_purchase,
            profile=profile,
        )
        result.update(rule_result)
        if rule_result.get("status") != ACCESS_STATUS_GRANTED:
            return result

    return result


class CommonAccess(BaseAccessHandler):

    def __init__(self, obj):
        super().__init__(obj)
        from apps.blog.models import Post as PostModel
        self._is_post = isinstance(obj, PostModel)

    def _get_rules_attr(self, name, default=None):
        rules = getattr(self.obj, name, default) or []
        if not isinstance(rules, list):
            return []
        return rules

    @property
    def condition_rules(self):
        return self._get_rules_attr("condition_rules", [])

    @property
    def effective_visibility(self):
        from apps.blog.models import Post as PostModel
        model_cls = PostModel if self._is_post else type(self.obj)
        return getattr(self.obj, "visibility", model_cls.VISIBILITY_PUBLIC)

    def is_author_or_staff(self, user):
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if user.is_staff or user.is_superuser:
            return True
        if hasattr(self.obj, "author_id"):
            return getattr(user, "pk", None) == self.obj.author_id
        if hasattr(self.obj, "created_by_id"):
            return getattr(user, "pk", None) == self.obj.created_by_id
        return False

    def evaluate(self, user):
        return evaluate_condition_access(
            user,
            rules=self.condition_rules,
            has_purchase=_check_has_purchase(user, self.obj),
        )

    def check_password(self, raw_password):
        return check_condition_password(self.condition_rules, raw_password)

    def purchase(self, user):
        PurchaseModel, field_name = _get_purchase_model_and_field(self.obj)

        money_required = get_condition_rule_value(self.condition_rules, CONDITION_TYPE_MONEY)
        if not money_required:
            return {"ok": True, "created": False, "message": ""}

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=user)
            purchase_record = PurchaseModel.objects.select_for_update().filter(
                user=user, **{field_name: self.obj}
            ).first()
            if purchase_record is not None:
                return {"ok": True, "created": False, "message": ""}
            if profile.money < 0 or profile.money < money_required:
                return {"ok": False, "created": False, "message": str(_("Insufficient balance."))}
            profile.money -= money_required
            profile.save(update_fields=["money"])
            PurchaseModel.objects.create(
                user=user, **{field_name: self.obj, "cost_money": money_required}
            )
        return {"ok": True, "created": True, "message": ""}


__all__ = ["CommonAccess", "evaluate_condition_access"]
