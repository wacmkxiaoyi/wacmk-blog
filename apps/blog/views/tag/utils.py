from django.db.models import Count, Q

from apps.blog.models import Tag
from apps.blog.views.post.utils import get_visible_post_queryset
from apps.blog.presentation import decorate_post_tags_for_display, decorate_tag_for_display, decorate_tags_for_display


def get_visible_tag_queryset(user):
    visible_posts = get_visible_post_queryset(user)
    return (
        Tag.objects.annotate(post_count=Count("posts", filter=Q(posts__in=visible_posts), distinct=True))
        .filter(post_count__gt=0)
        .order_by("name")
    )
__all__ = ["decorate_post_tags_for_display", "decorate_tag_for_display", "decorate_tags_for_display", "get_visible_tag_queryset"]
