import colorsys
import hashlib

from django.db.models import Count, Q

from apps.blog.models import Tag
from apps.blog.views.post.utils import get_visible_post_queryset


def get_visible_tag_queryset(user):
    visible_posts = get_visible_post_queryset(user)
    return (
        Tag.objects.annotate(post_count=Count("posts", filter=Q(posts__in=visible_posts), distinct=True))
        .filter(post_count__gt=0)
        .order_by("name")
    )


def decorate_tag_for_display(tag):
    digest = hashlib.sha256((tag.slug or tag.name).encode("utf-8")).digest()
    hue = digest[0] / 255
    saturation = 0.45 + ((digest[1] % 64) / 255)
    lightness = 0.46 + ((digest[2] % 32) / 255)
    red, green, blue = [round(channel * 255) for channel in colorsys.hls_to_rgb(hue, lightness, saturation)]
    text_red = max(red - 58, 0)
    text_green = max(green - 58, 0)
    text_blue = max(blue - 58, 0)
    tag.color_style = (
        f"--tag-rgb: {red}, {green}, {blue};"
        f"--tag-bg: rgba({red}, {green}, {blue}, 0.14);"
        f"--tag-border: rgba({red}, {green}, {blue}, 0.34);"
        f"--tag-color: rgb({text_red}, {text_green}, {text_blue});"
    )
    return tag


def decorate_tags_for_display(tags):
    return [decorate_tag_for_display(tag) for tag in tags]


def decorate_post_tags_for_display(posts):
    for post in posts:
        post.display_tags = decorate_tags_for_display(list(post.tags.all()))
    return posts


__all__ = ["decorate_post_tags_for_display", "decorate_tag_for_display", "decorate_tags_for_display", "get_visible_tag_queryset"]
