from ..constants import ACTION_NONE, CONDITION_LABELS, CONDITION_TYPE_BOOK_ONLY, STATUS_GRANTED, STATUS_PENDING
from ..registry import register
from .base import BaseConditionEvaluator


class BookOnlyEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_BOOK_ONLY
    label = CONDITION_LABELS[CONDITION_TYPE_BOOK_ONLY]
    icon = "book-open-reader"
    tone = "book-only"

    def evaluate(self, *, rule, subject, identity, context, unlock_state):
        status = STATUS_GRANTED if context.book_context else STATUS_PENDING
        return {"status": status, "action": ACTION_NONE, "requirement": "-", "original_requirement": None, "discounted_requirement": None, "discount_applied": False, "discount_rate": ""}


register(BookOnlyEvaluator())
