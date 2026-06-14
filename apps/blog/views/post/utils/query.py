from django.db.models import BooleanField, Case, CharField, Count, DateTimeField, Exists, F, OuterRef, Q, Subquery, Value, When

from apps.blog.models import PostStar
from apps.blog.access.queryset import get_detail_post_queryset as _get_detail_post_queryset
from apps.blog.access.queryset import get_reference_post_queryset as _get_reference_post_queryset
from apps.blog.access.queryset import get_visible_post_queryset as _get_visible_post_queryset
from apps.blog.presentation import decorate_post_tags_for_display
from apps.blog.visibility import (
    get_post_condition_summary_items,
    get_post_vip_condition_summary_items,
    get_post_vip_visibility_presentation,
    get_post_visibility_presentation,
    post_has_vip_standalone,
)


def get_visible_post_queryset(user):
    return _get_visible_post_queryset(user)


def get_reference_post_queryset(user):
    return _get_reference_post_queryset(user)


def with_post_feedback_counts(queryset):
    return queryset.annotate(
        up_count=Count("feedback_entries", filter=Q(feedback_entries__value=1), distinct=True),
        down_count=Count("feedback_entries", filter=Q(feedback_entries__value=-1), distinct=True),
    )


def with_user_post_star_state(queryset, user):
    if not getattr(user, "is_authenticated", False):
        return queryset.annotate(
            is_starred=Value(False, output_field=BooleanField()),
            starred_at=Value(None, output_field=DateTimeField()),
        )

    user_star_queryset = PostStar.objects.filter(post_id=OuterRef("pk"), user=user)
    return queryset.annotate(
        is_starred=Exists(user_star_queryset),
        starred_at=Subquery(user_star_queryset.values("created_at")[:1]),
    )


def order_posts_by_user_stars(queryset, user, *fallback_ordering):
    ordered_queryset = with_user_post_star_state(queryset, user)
    if fallback_ordering:
        return ordered_queryset.order_by("-is_starred", "-starred_at", *fallback_ordering)
    return ordered_queryset.order_by("-is_starred", "-starred_at")


def prepare_post_cards(posts):
    prepared_posts = decorate_post_tags_for_display(list(posts))
    for post in prepared_posts:
        post.condition_summary_items = get_post_condition_summary_items(post)
        post.visibility_presentation = get_post_visibility_presentation(post)
        post.show_vip_badge = post_has_vip_standalone(post)
        if post.show_vip_badge:
            post.vip_condition_summary_items = get_post_vip_condition_summary_items(post)
            post.vip_visibility_presentation = get_post_vip_visibility_presentation(post)
    return prepared_posts


def get_detail_post_queryset(user):
    return _get_detail_post_queryset(user)


def get_author_display_name_sort_expression(prefix="author__"):
    return Case(
        When(**{f"{prefix}first_name": ""}, then=F(f"{prefix}username")),
        default=F(f"{prefix}first_name"),
        output_field=CharField(),
    )


__all__ = [
    "get_author_display_name_sort_expression",
    "get_detail_post_queryset",
    "get_reference_post_queryset",
    "get_visible_post_queryset",
    "order_posts_by_user_stars",
    "prepare_post_cards",
    "with_post_feedback_counts",
    "with_user_post_star_state",
]
