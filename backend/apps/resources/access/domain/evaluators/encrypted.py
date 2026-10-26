from ..constants import ACTION_NONE, ACTION_PASSWORD, CONDITION_LABELS, CONDITION_TYPE_ENCRYPTED, STATUS_GRANTED, STATUS_PENDING
from ..registry import register
from .base import BaseConditionEvaluator


class EncryptedEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_ENCRYPTED
    label = CONDITION_LABELS[CONDITION_TYPE_ENCRYPTED]
    icon = "lock"
    tone = "encrypted"

    def evaluate(self, *, rule, subject, identity, context, unlock_state):
        if unlock_state.has_password_grant:
            return {"status": STATUS_GRANTED, "action": ACTION_NONE, "requirement": "Password", "original_requirement": None, "discounted_requirement": None, "discount_applied": False, "discount_rate": ""}
        return {"status": STATUS_PENDING, "action": ACTION_PASSWORD, "requirement": "Password", "original_requirement": None, "discounted_requirement": None, "discount_applied": False, "discount_rate": ""}


register(EncryptedEvaluator())
