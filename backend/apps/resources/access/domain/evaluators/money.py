from decimal import Decimal, ROUND_CEILING

from ..constants import ACTION_NONE, CONDITION_LABELS, CONDITION_TYPE_MONEY, STATUS_GRANTED, STATUS_INSUFFICIENT_MONEY, STATUS_PURCHASE_REQUIRED
from ..registry import register
from .base import BaseConditionEvaluator


def _apply_discount(value: int, discount: Decimal):
    if value <= 0 or discount <= 0:
        return value
    discounted = (Decimal(value) * (Decimal("1") - discount)).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return max(int(discounted), 0)


class MoneyEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_MONEY
    label = CONDITION_LABELS[CONDITION_TYPE_MONEY]
    icon = "coins"
    tone = "money"

    def evaluate(self, *, rule, subject, identity, context, unlock_state):
        discounted_requirement = _apply_discount(int(rule.value), identity.money_discount)
        if unlock_state.has_purchase:
            return {"status": STATUS_GRANTED, "action": ACTION_NONE, "requirement": str(discounted_requirement), "original_requirement": int(rule.value), "discounted_requirement": discounted_requirement, "discount_applied": discounted_requirement != int(rule.value), "discount_rate": str(identity.money_discount)}
        if identity.money_balance < discounted_requirement:
            return {"status": STATUS_INSUFFICIENT_MONEY, "action": ACTION_NONE, "requirement": str(discounted_requirement), "original_requirement": int(rule.value), "discounted_requirement": discounted_requirement, "discount_applied": discounted_requirement != int(rule.value), "discount_rate": str(identity.money_discount)}
        return {"status": STATUS_PURCHASE_REQUIRED, "action": ACTION_NONE, "requirement": str(discounted_requirement), "original_requirement": int(rule.value), "discounted_requirement": discounted_requirement, "discount_applied": discounted_requirement != int(rule.value), "discount_rate": str(identity.money_discount)}


register(MoneyEvaluator())
