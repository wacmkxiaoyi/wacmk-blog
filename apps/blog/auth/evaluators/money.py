from django.utils.translation import gettext_lazy as _

from apps.blog.auth.constants import (
    ACCESS_STATUS_GRANTED,
    ACCESS_STATUS_INSUFFICIENT_MONEY,
    ACCESS_STATUS_PURCHASE_REQUIRED,
)
from apps.blog.auth.registry import register
from apps.blog.permissions import CONDITION_TYPE_MONEY
from apps.blog.utils.site import apply_vip_discount_to_requirement, get_user_vip_discounts
from .base import BaseConditionEvaluator


class MoneyEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_MONEY
    label = str(_("Money"))
    icon = "coins"
    tone = "money"
    value_kind = "integer"

    def evaluate(self, user, value, *, has_purchase=False, profile=None):
        discounted_value = apply_vip_discount_to_requirement(value, get_user_vip_discounts(user)["money_discount"])
        if has_purchase:
            return {"status": ACCESS_STATUS_GRANTED}
        if not profile or profile.money < discounted_value:
            return {"status": ACCESS_STATUS_INSUFFICIENT_MONEY, "money_required": discounted_value}
        return {"status": ACCESS_STATUS_PURCHASE_REQUIRED, "money_required": discounted_value}


register(MoneyEvaluator())
__all__ = ["MoneyEvaluator"]
