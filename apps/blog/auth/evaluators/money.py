from django.utils.translation import gettext_lazy as _

from apps.blog.auth.constants import (
    ACCESS_STATUS_GRANTED,
    ACCESS_STATUS_INSUFFICIENT_MONEY,
    ACCESS_STATUS_PURCHASE_REQUIRED,
)
from apps.blog.auth.registry import register
from apps.blog.permissions import CONDITION_TYPE_MONEY
from .base import BaseConditionEvaluator


class MoneyEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_MONEY
    label = str(_("Money"))
    icon = "coins"
    tone = "money"
    value_kind = "integer"

    def evaluate(self, user, value, *, has_purchase=False, profile=None):
        if has_purchase:
            return {"status": ACCESS_STATUS_GRANTED}
        if not profile or profile.money < value:
            return {"status": ACCESS_STATUS_INSUFFICIENT_MONEY, "money_required": value}
        return {"status": ACCESS_STATUS_PURCHASE_REQUIRED, "money_required": value}


register(MoneyEvaluator())
__all__ = ["MoneyEvaluator"]
