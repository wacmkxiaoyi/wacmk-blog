from django.utils.translation import gettext_lazy as _

from apps.blog.auth.constants import ACCESS_STATUS_GRANTED, ACCESS_STATUS_INSUFFICIENT_POINTS
from apps.blog.auth.registry import register
from apps.blog.permissions import CONDITION_TYPE_POINTS
from .base import BaseConditionEvaluator


class PointsEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_POINTS
    label = str(_("Points"))
    icon = "gem"
    tone = "points"
    value_kind = "integer"

    def evaluate(self, user, value, *, has_purchase=False, profile=None):
        if not profile or profile.points < value:
            return {"status": ACCESS_STATUS_INSUFFICIENT_POINTS, "points_required": value}
        return {"status": ACCESS_STATUS_GRANTED}


register(PointsEvaluator())
__all__ = ["PointsEvaluator"]
