from django.utils.translation import gettext_lazy as _

from apps.blog.models import Post, PostDraft
from apps.blog.utils.site import build_share_expiry_options, format_share_link_expires_display
from apps.blog.visibility import post_has_any_conditions


def build_post_share_editor_context(post, user, request):
    source_post = None
    if isinstance(post, Post):
        source_post = post
    elif isinstance(post, PostDraft):
        source_post = getattr(post, "source_post", None)

    active_share_link = None
    if source_post is not None:
        active_share_link = source_post.share_links.order_by("-created_at", "-pk").first()

    visibility = getattr(post, "visibility", Post.VISIBILITY_PUBLIC) if post is not None else Post.VISIBILITY_PUBLIC
    status = getattr(post, "status", Post.STATUS_DRAFT) if post is not None else Post.STATUS_DRAFT
    is_public = bool(post is None or (visibility == Post.VISIBILITY_PUBLIC and not post_has_any_conditions(post)))
    is_published = bool(source_post and source_post.status == Post.STATUS_PUBLISHED)
    is_original_author = bool(source_post and source_post.author_id == getattr(user, "pk", None))
    can_generate = bool(is_public and is_published and is_original_author)

    if not is_public:
        disabled_message = ""
    elif not is_published or status != Post.STATUS_PUBLISHED:
        disabled_message = str(_("This article has not been published yet. Publish it before generating an external link."))
    elif not is_original_author:
        disabled_message = str(_("Only the original author can generate a new external link for this article."))
    else:
        disabled_message = ""

    current_url = ""
    current_expires = ""
    if active_share_link is not None:
        current_url = request.build_absolute_uri(active_share_link.get_absolute_url())
        current_expires = format_share_link_expires_display(active_share_link)

    return {
        "post_share_is_public": is_public,
        "post_share_can_generate": can_generate,
        "post_share_disabled_message": disabled_message,
        "post_share_is_original_author": is_original_author,
        "post_share_active_link": active_share_link,
        "post_share_current_url": current_url,
        "post_share_current_expires": current_expires,
        "post_share_expiry_options": build_share_expiry_options(),
    }


__all__ = ["build_post_share_editor_context"]
