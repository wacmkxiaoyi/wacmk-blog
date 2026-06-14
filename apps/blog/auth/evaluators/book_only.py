from django.utils.translation import gettext_lazy as _

from apps.blog.auth.constants import ACCESS_STATUS_GRANTED
from apps.blog.auth.registry import register
from apps.blog.permissions import CONDITION_TYPE_BOOK_ONLY
from .base import BaseConditionEvaluator


class BookOnlyEvaluator(BaseConditionEvaluator):
    type = CONDITION_TYPE_BOOK_ONLY
    label = str(_("Book only"))
    icon = "book-open-reader"
    tone = "book-only"
    value_kind = "none"
    allowed_on_book = False
    allowed_on_attachment = False

    def evaluate(self, user, value, *, has_purchase=False, profile=None):
        return {"status": ACCESS_STATUS_GRANTED}


register(BookOnlyEvaluator())
__all__ = ["BookOnlyEvaluator"]
