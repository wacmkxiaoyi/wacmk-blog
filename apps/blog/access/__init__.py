from apps.blog.auth.constants import (
    ACCESS_STATUS_GRANTED,
    ACCESS_STATUS_INSUFFICIENT_MONEY,
    ACCESS_STATUS_INSUFFICIENT_POINTS,
    ACCESS_STATUS_INVALID_CONDITION,
    ACCESS_STATUS_PURCHASE_REQUIRED,
)

from .base import BaseAccessHandler
from .common import CommonAccess, evaluate_condition_access
from .display import (
    annotate_vip_badge,
    get_book_vip_condition_summary_items,
    get_book_vip_visibility_presentation,
    get_post_vip_condition_summary_items,
    get_post_vip_visibility_presentation,
)
from .queryset import (
    build_vip_standalone_q,
    build_visible_queryset_q,
    get_detail_book_queryset,
    get_detail_post_queryset,
    get_reference_post_queryset,
    get_visible_book_queryset,
    get_visible_post_queryset,
)
from .check import build_access_check
from .resolver import (
    STANDALONE_SCOPE,
    get_access_handler,
    object_has_vip_standalone,
)
from .vip import VipAccessHandler
from .vip_check import check_is_vip_user


def evaluate_article_access(user, article):
    return get_access_handler(article, user).evaluate(user)


def evaluate_book_access(user, book):
    return get_access_handler(book, user).evaluate(user)


def purchase_article_access(user, article):
    return get_access_handler(article, user).purchase(user)


def purchase_book_access(user, book):
    return get_access_handler(book, user).purchase(user)


def user_has_article_purchase(user, article):
    from .common import _check_has_purchase
    return _check_has_purchase(user, article)


def user_has_book_purchase(user, book):
    from .common import _check_has_purchase
    return _check_has_purchase(user, book)


__all__ = [
    "ACCESS_STATUS_GRANTED",
    "ACCESS_STATUS_INSUFFICIENT_MONEY",
    "ACCESS_STATUS_INSUFFICIENT_POINTS",
    "ACCESS_STATUS_INVALID_CONDITION",
    "ACCESS_STATUS_PURCHASE_REQUIRED",
    "BaseAccessHandler",
    "CommonAccess",
    "STANDALONE_SCOPE",
    "VipAccessHandler",
    "annotate_vip_badge",
    "build_access_check",
    "build_vip_standalone_q",
    "build_visible_queryset_q",
    "check_is_vip_user",
    "evaluate_article_access",
    "evaluate_book_access",
    "evaluate_condition_access",
    "get_access_handler",
    "get_book_vip_condition_summary_items",
    "get_book_vip_visibility_presentation",
    "get_detail_book_queryset",
    "get_detail_post_queryset",
    "get_post_vip_condition_summary_items",
    "get_post_vip_visibility_presentation",
    "get_reference_post_queryset",
    "get_visible_book_queryset",
    "get_visible_post_queryset",
    "object_has_vip_standalone",
    "purchase_article_access",
    "purchase_book_access",
    "user_has_article_purchase",
    "user_has_book_purchase",
]
