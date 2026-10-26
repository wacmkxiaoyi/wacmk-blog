from decimal import Decimal, ROUND_CEILING

from ..constants import ACTION_NONE, CONDITION_LABELS, CONDITION_TYPE_POINTS, STATUS_GRANTED, STATUS_INSUFFICIENT_POINTS
from ..registry import register
from .base import BaseConditionEvaluator


def _apply_discount(value: int, discount: Decimal):
    if value <= 0 or discount <= 0:
        return value
    discounted = (Decimal(value) * (Decimal("1") - discount)).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return max(int(discounted), 0)


class PointsEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_POINTS
    label = CONDITION_LABELS[CONDITION_TYPE_POINTS]
    icon = "gem"
    tone = "points"

    def evaluate(self, *, rule, subject, identity, context, unlock_state):
        discounted_requirement = _apply_discount(int(rule.value), identity.points_discount)
        status = STATUS_GRANTED if identity.points_balance >= discounted_requirement else STATUS_INSUFFICIENT_POINTS
        return {"status": status, "action": ACTION_NONE, "requirement": str(discounted_requirement), "original_requirement": int(rule.value), "discounted_requirement": discounted_requirement, "discount_applied": discounted_requirement != int(rule.value), "discount_rate": str(identity.points_discount)}


register(PointsEvaluator())
