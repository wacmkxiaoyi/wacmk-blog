from django.db.models import Q

from apps.blog.models import Book


def get_visible_book_queryset(user):
    queryset = Book.objects.select_related("created_by")
    if user.is_staff or user.is_superuser:
        return queryset
    if not user.is_authenticated:
        return queryset.filter(visibility=Book.VISIBILITY_PUBLIC)
    return queryset.filter(Q(visibility__in=[Book.VISIBILITY_PUBLIC, Book.VISIBILITY_ENCRYPTED]) | Q(created_by=user)).distinct()


def get_detail_book_queryset(user):
    queryset = Book.objects.select_related("created_by")
    if user.is_staff or user.is_superuser:
        return queryset
    if not user.is_authenticated:
        return queryset.filter(visibility=Book.VISIBILITY_PUBLIC)
    return queryset.filter(Q(visibility__in=[Book.VISIBILITY_PUBLIC, Book.VISIBILITY_ENCRYPTED]) | Q(created_by=user)).distinct()


__all__ = ["get_detail_book_queryset", "get_visible_book_queryset"]
