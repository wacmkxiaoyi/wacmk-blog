from apps.blog.access.queryset import get_detail_book_queryset as _get_detail_book_queryset
from apps.blog.access.queryset import get_visible_book_queryset as _get_visible_book_queryset


def get_visible_book_queryset(user):
    return _get_visible_book_queryset(user)


def get_detail_book_queryset(user):
    return _get_detail_book_queryset(user)


__all__ = ["get_detail_book_queryset", "get_visible_book_queryset"]
