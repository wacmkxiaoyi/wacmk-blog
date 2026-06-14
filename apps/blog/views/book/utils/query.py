from django.db.models import BooleanField, DateTimeField, Exists, OuterRef, Subquery, Value

from apps.blog.access.queryset import get_detail_book_queryset as _get_detail_book_queryset
from apps.blog.access.queryset import get_visible_book_queryset as _get_visible_book_queryset
from apps.blog.models import BookStar


def get_visible_book_queryset(user):
    return _get_visible_book_queryset(user)


def get_detail_book_queryset(user):
    return _get_detail_book_queryset(user)


def with_user_book_star_state(queryset, user):
    if not getattr(user, "is_authenticated", False):
        return queryset.annotate(
            is_starred=Value(False, output_field=BooleanField()),
            starred_at=Value(None, output_field=DateTimeField()),
        )

    user_star_queryset = BookStar.objects.filter(book_id=OuterRef("pk"), user=user)
    return queryset.annotate(
        is_starred=Exists(user_star_queryset),
        starred_at=Subquery(user_star_queryset.values("created_at")[:1]),
    )


def order_books_by_user_stars(queryset, user, *fallback_ordering):
    ordered_queryset = with_user_book_star_state(queryset, user)
    if fallback_ordering:
        return ordered_queryset.order_by("-is_starred", "-starred_at", *fallback_ordering)
    return ordered_queryset.order_by("-is_starred", "-starred_at")


__all__ = [
    "get_detail_book_queryset",
    "get_visible_book_queryset",
    "order_books_by_user_stars",
    "with_user_book_star_state",
]
