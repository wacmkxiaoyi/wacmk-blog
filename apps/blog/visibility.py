from apps.blog.models import Book, Post
from apps.blog.permissions import (
    CONDITION_TYPE_BOOK_ONLY,
    CONDITION_TYPE_ENCRYPTED,
    build_condition_summary_items,
    get_access_presentation,
    has_condition_rule,
    has_value_condition_rules,
)


POST_CONDITION_TYPES = ["money", "points", CONDITION_TYPE_ENCRYPTED, CONDITION_TYPE_BOOK_ONLY]
BOOK_CONDITION_TYPES = ["money", "points", CONDITION_TYPE_ENCRYPTED]


def post_has_encrypted_access(post):
    return bool(has_condition_rule(post.condition_rules, CONDITION_TYPE_ENCRYPTED, allowed_types=POST_CONDITION_TYPES))


def post_is_book_only(post):
    return bool(has_condition_rule(post.condition_rules, CONDITION_TYPE_BOOK_ONLY, allowed_types=POST_CONDITION_TYPES))


def post_has_value_conditions(post):
    return bool(has_value_condition_rules(post.condition_rules, allowed_types=POST_CONDITION_TYPES))


def post_has_any_conditions(post):
    return bool(post_is_book_only(post) or post_has_encrypted_access(post) or post_has_value_conditions(post))


def book_has_encrypted_access(book):
    return bool(has_condition_rule(book.condition_rules, CONDITION_TYPE_ENCRYPTED, allowed_types=BOOK_CONDITION_TYPES))


def book_has_value_conditions(book):
    return bool(has_value_condition_rules(book.condition_rules, allowed_types=BOOK_CONDITION_TYPES))


def book_has_any_conditions(book):
    return bool(book_has_encrypted_access(book) or book_has_value_conditions(book))


def get_post_condition_summary_items(post):
    return build_condition_summary_items(post.condition_rules, allowed_types=POST_CONDITION_TYPES)


def get_book_condition_summary_items(book):
    return build_condition_summary_items(book.condition_rules, allowed_types=BOOK_CONDITION_TYPES)


def get_visibility_presentation(visibility, *, fallback_label=""):
    return get_access_presentation(visibility, fallback_label=fallback_label)


def get_post_visibility_presentation(post):
    return get_visibility_presentation(post.visibility, fallback_label=getattr(post, "get_visibility_display", lambda: "")())


def get_book_visibility_presentation(book):
    return get_visibility_presentation(book.visibility, fallback_label=getattr(book, "get_visibility_display", lambda: "")())


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


def get_post_access_icon_presentation(post):
    if post_has_encrypted_access(post):
        return get_access_presentation(CONDITION_TYPE_ENCRYPTED)
    if post_is_book_only(post):
        return get_access_presentation(CONDITION_TYPE_BOOK_ONLY)
    return get_post_visibility_presentation(post)


def get_book_access_icon_presentation(book):
    if book_has_encrypted_access(book):
        return get_access_presentation(CONDITION_TYPE_ENCRYPTED)
    return get_book_visibility_presentation(book)


__all__ = [name for name in globals() if not name.startswith("_")]
