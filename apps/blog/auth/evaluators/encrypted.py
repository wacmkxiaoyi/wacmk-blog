from django.utils.translation import gettext_lazy as _

from apps.blog.auth.constants import ACCESS_STATUS_GRANTED
from apps.blog.auth.registry import register
from apps.blog.permissions import CONDITION_TYPE_ENCRYPTED
from .base import BaseConditionEvaluator


class EncryptedEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_ENCRYPTED
    label = str(_("Encrypted"))
    icon = "lock"
    tone = "encrypted"
    value_kind = "password"

    def evaluate(self, user, value, *, has_purchase=False, profile=None):
        return {"status": ACCESS_STATUS_GRANTED}


register(EncryptedEvaluator())
__all__ = ["EncryptedEvaluator"]
