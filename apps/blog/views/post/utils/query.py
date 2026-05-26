from django.db.models import Case, CharField, Count, F, Q, When

from apps.blog.models import Post


def get_visible_post_queryset(user):
    queryset = Post.objects.select_related("author").prefetch_related("tags", "books")
    if user.is_staff or user.is_superuser:
        return queryset
    if not user.is_authenticated:
        return queryset.filter(status=Post.STATUS_PUBLISHED, visibility=Post.VISIBILITY_PUBLIC)
    return queryset.filter(status=Post.STATUS_PUBLISHED).filter(
        Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_ENCRYPTED]) | Q(author=user)
    )


def with_post_feedback_counts(queryset):
    return queryset.annotate(
        up_count=Count("feedback_entries", filter=Q(feedback_entries__value=1), distinct=True),
        down_count=Count("feedback_entries", filter=Q(feedback_entries__value=-1), distinct=True),
    )


def get_detail_post_queryset(user):
    queryset = Post.objects.select_related("author").prefetch_related("tags", "books")
    if user.is_staff or user.is_superuser:
        return queryset.filter(status=Post.STATUS_PUBLISHED)
    if not user.is_authenticated:
        return queryset.filter(status=Post.STATUS_PUBLISHED, visibility=Post.VISIBILITY_PUBLIC)
    return queryset.filter(status=Post.STATUS_PUBLISHED).filter(
        Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_BOOK_ONLY, Post.VISIBILITY_PRIVATE, Post.VISIBILITY_ENCRYPTED], author=user)
        | Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_ENCRYPTED])
    ).distinct()


def get_author_display_name_sort_expression(prefix="author__"):
    return Case(
        When(**{f"{prefix}first_name": ""}, then=F(f"{prefix}username")),
        default=F(f"{prefix}first_name"),
        output_field=CharField(),
    )


__all__ = ["get_author_display_name_sort_expression", "get_detail_post_queryset", "get_visible_post_queryset", "with_post_feedback_counts"]
