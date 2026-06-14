from apps.blog.access.display import (
    get_attachment_vip_condition_summary_items,
    get_attachment_vip_visibility_presentation,
    get_book_vip_condition_summary_items,
    get_book_vip_visibility_presentation,
    get_post_vip_condition_summary_items,
    get_post_vip_visibility_presentation,
)
from apps.blog.access.resolver import get_access_handler, object_has_vip_standalone
from apps.blog.access.vip_check import check_is_vip_user
from apps.blog.auth import get_allowed_types_for_attachment, get_allowed_types_for_book, get_allowed_types_for_post
from apps.blog.models import Attachment, Book, Post
from apps.blog.permissions import (
    CONDITION_TYPE_BOOK_ONLY,
    CONDITION_TYPE_ENCRYPTED,
    build_condition_summary_items,
    get_access_presentation,
    has_condition_rule,
)


POST_CONDITION_TYPES = get_allowed_types_for_post()
BOOK_CONDITION_TYPES = get_allowed_types_for_book()
ATTACHMENT_CONDITION_TYPES = get_allowed_types_for_attachment()


def post_has_vip_standalone(post):
    return object_has_vip_standalone(post)


def book_has_vip_standalone(book):
    return object_has_vip_standalone(book)


def post_is_book_only(post):
    return bool(has_condition_rule(post.condition_rules, CONDITION_TYPE_BOOK_ONLY, allowed_types=POST_CONDITION_TYPES))


def post_has_any_conditions(post):
    return bool(post.condition_rules)


def book_has_any_conditions(book):
    return bool(book.condition_rules)


def attachment_has_any_conditions(attachment):
    return bool(attachment.condition_rules)


def get_post_condition_summary_items(post):
    return build_condition_summary_items(post.condition_rules, allowed_types=POST_CONDITION_TYPES)


def get_book_condition_summary_items(book):
    return build_condition_summary_items(book.condition_rules, allowed_types=BOOK_CONDITION_TYPES)


def get_attachment_condition_summary_items(attachment):
    return build_condition_summary_items(attachment.condition_rules, allowed_types=ATTACHMENT_CONDITION_TYPES)


def get_visibility_presentation(visibility, *, fallback_label=""):
    return get_access_presentation(visibility, fallback_label=fallback_label)


def get_post_visibility_presentation(post):
    return get_visibility_presentation(post.visibility, fallback_label=getattr(post, "get_visibility_display", lambda: "")())


def get_book_visibility_presentation(book):
    return get_visibility_presentation(book.visibility, fallback_label=getattr(book, "get_visibility_display", lambda: "")())


def get_attachment_visibility_presentation(attachment):
    return get_visibility_presentation(attachment.visibility, fallback_label=getattr(attachment, "get_visibility_display", lambda: "")())


def build_access_display(visibility_presentation, condition_summary_items):
    condition_items = list(condition_summary_items or [])

    if len(condition_items) == 1:
        return {
            "mode": "single",
            "presentation": condition_items[0],
            "condition_items": condition_items,
            "count": 1,
        }
    if len(condition_items) > 1:
        return {
            "mode": "multiple",
            "presentation": None,
            "condition_items": condition_items,
            "count": len(condition_items),
        }
    return {
        "mode": "single",
        "presentation": visibility_presentation,
        "condition_items": [],
        "count": 0,
    }


def get_post_access_display(post):
    return build_access_display(get_post_visibility_presentation(post), get_post_condition_summary_items(post))


def get_book_access_display(book):
    return build_access_display(get_book_visibility_presentation(book), get_book_condition_summary_items(book))


def get_attachment_access_display(attachment):
    return build_access_display(get_attachment_visibility_presentation(attachment), get_attachment_condition_summary_items(attachment))


def get_post_access_icon_presentation(post):
    if post.condition_rules:
        first = post.condition_rules[0] if isinstance(post.condition_rules, list) and post.condition_rules else None
        if first and isinstance(first, dict):
            return get_access_presentation(first.get("type", ""))
    if post_is_book_only(post):
        return get_access_presentation(CONDITION_TYPE_BOOK_ONLY)
    return get_post_visibility_presentation(post)


def get_book_access_icon_presentation(book):
    if book.condition_rules:
        first = book.condition_rules[0] if isinstance(book.condition_rules, list) and book.condition_rules else None
        if first and isinstance(first, dict):
            return get_access_presentation(first.get("type", ""))
    return get_book_visibility_presentation(book)


def get_attachment_access_icon_presentation(attachment):
    if attachment.condition_rules:
        first = attachment.condition_rules[0] if isinstance(attachment.condition_rules, list) and attachment.condition_rules else None
        if first and isinstance(first, dict):
            return get_access_presentation(first.get("type", ""))
    return get_attachment_visibility_presentation(attachment)


__all__ = [name for name in globals() if not name.startswith("_")]
