from apps.blog.models import Book, Post
from apps.blog.permissions import build_condition_summary_items, get_access_presentation

from .resolver import object_has_vip_standalone, get_access_handler


def get_post_vip_condition_summary_items(post):
    from apps.blog.visibility import POST_CONDITION_TYPES
    return build_condition_summary_items(
        getattr(post, "vip_condition_rules", []) or [], allowed_types=POST_CONDITION_TYPES
    )


def get_book_vip_condition_summary_items(book):
    from apps.blog.visibility import BOOK_CONDITION_TYPES
    return build_condition_summary_items(
        getattr(book, "vip_condition_rules", []) or [], allowed_types=BOOK_CONDITION_TYPES
    )


def get_post_vip_visibility_presentation(post):
    vip_perm = getattr(post, "vip_access_permission", "") or Post.VISIBILITY_PUBLIC
    return get_access_presentation(vip_perm, fallback_label=vip_perm.capitalize())


def get_book_vip_visibility_presentation(book):
    vip_perm = getattr(book, "vip_access_permission", "") or Book.VISIBILITY_PUBLIC
    return get_access_presentation(vip_perm, fallback_label=vip_perm.capitalize())


def annotate_vip_badge(obj):
    if not object_has_vip_standalone(obj):
        return
    obj.show_vip_badge = True
    if hasattr(obj, "vip_access_permission"):
        obj.vip_condition_summary_items = (
            get_post_vip_condition_summary_items(obj)
            if isinstance(obj, Post)
            else get_book_vip_condition_summary_items(obj)
        )
        obj.vip_visibility_presentation = (
            get_post_vip_visibility_presentation(obj)
            if isinstance(obj, Post)
            else get_book_vip_visibility_presentation(obj)
        )


__all__ = [
    "annotate_vip_badge",
    "get_book_vip_condition_summary_items",
    "get_book_vip_visibility_presentation",
    "get_post_vip_condition_summary_items",
    "get_post_vip_visibility_presentation",
]
