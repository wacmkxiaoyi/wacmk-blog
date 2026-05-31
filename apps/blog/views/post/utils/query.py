from django.db.models import Case, CharField, Count, F, Q, When

from apps.blog.models import Post
from apps.blog.presentation import decorate_post_tags_for_display
from apps.blog.permissions import CONDITION_TYPE_BOOK_ONLY, has_condition_rule
from apps.blog.visibility import get_post_condition_summary_items, get_post_visibility_presentation, post_has_encrypted_access


def get_visible_post_queryset(user):
    queryset = Post.objects.select_related("author").prefetch_related("tags", "books")
    if user.is_staff or user.is_superuser:
        return queryset
    if not user.is_authenticated:
        return queryset.filter(status=Post.STATUS_PUBLISHED, visibility=Post.VISIBILITY_PUBLIC)
    posts = list(queryset.filter(status=Post.STATUS_PUBLISHED).filter(Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_CONDITIONAL]) | Q(author=user)).distinct())
    visible_ids = []
    for post in posts:
        if has_condition_rule(post.condition_rules, CONDITION_TYPE_BOOK_ONLY):
            if post.author_id != getattr(user, "pk", None):
                continue
        visible_ids.append(post.pk)
    return queryset.filter(pk__in=visible_ids)


def get_reference_post_queryset(user):
    queryset = Post.objects.select_related("author").prefetch_related("tags", "books")
    if user.is_staff or user.is_superuser:
        return queryset
    if not user.is_authenticated:
        return queryset.none()
    return queryset.filter(status=Post.STATUS_PUBLISHED).filter(
        Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_CONDITIONAL]) | Q(author=user)
    ).distinct()


def with_post_feedback_counts(queryset):
    return queryset.annotate(
        up_count=Count("feedback_entries", filter=Q(feedback_entries__value=1), distinct=True),
        down_count=Count("feedback_entries", filter=Q(feedback_entries__value=-1), distinct=True),
    )


def prepare_post_cards(posts):
    prepared_posts = decorate_post_tags_for_display(list(posts))
    for post in prepared_posts:
        post.condition_summary_items = get_post_condition_summary_items(post)
        post.visibility_presentation = get_post_visibility_presentation(post)
        post.has_encrypted_access = post_has_encrypted_access(post)
    return prepared_posts


def get_detail_post_queryset(user):
    queryset = Post.objects.select_related("author").prefetch_related("tags", "books")
    if user.is_staff or user.is_superuser:
        return queryset.filter(status=Post.STATUS_PUBLISHED)
    if not user.is_authenticated:
        return queryset.filter(status=Post.STATUS_PUBLISHED, visibility=Post.VISIBILITY_PUBLIC)
    return queryset.filter(status=Post.STATUS_PUBLISHED).filter(
        Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_PRIVATE, Post.VISIBILITY_CONDITIONAL], author=user)
        | Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_CONDITIONAL])
    ).distinct()


def get_author_display_name_sort_expression(prefix="author__"):
    return Case(
        When(**{f"{prefix}first_name": ""}, then=F(f"{prefix}username")),
        default=F(f"{prefix}first_name"),
        output_field=CharField(),
    )


__all__ = ["get_author_display_name_sort_expression", "get_detail_post_queryset", "get_reference_post_queryset", "get_visible_post_queryset", "prepare_post_cards", "with_post_feedback_counts"]
