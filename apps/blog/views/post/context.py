from django.db.models import Count, Q
from django.utils.translation import gettext_lazy as _

from apps.blog.forms import CommentForm
from apps.blog.models import Post
from apps.blog.presentation import decorate_post_tags_for_display
from apps.blog.utils.markdown import render_markdown
from apps.blog.utils.site import build_share_expiry_options, check_comment_permission
from apps.blog.visibility import get_post_access_icon_presentation, get_post_condition_summary_items, get_post_visibility_presentation
from apps.blog.views.comment.utils import build_comment_tree
from apps.blog.views.post.utils import get_visible_post_queryset


def annotate_post_feedback(post, user):
    counts = post.feedback_entries.aggregate(
        up_count=Count("id", filter=Q(value=1)),
        down_count=Count("id", filter=Q(value=-1)),
    )
    post.up_count = counts["up_count"] or 0
    post.down_count = counts["down_count"] or 0
    post.feedback_value = 0
    if getattr(user, "is_authenticated", False):
        post.feedback_value = post.feedback_entries.filter(user=user).values_list("value", flat=True).first() or 0
    return post


def build_post_detail_context(
    post,
    user,
    *,
    comment_form=None,
    reply_parent_id=None,
    reply_form=None,
    edit_comment_id=None,
    edit_form=None,
    is_share_view=False,
    request=None,
    book=None,
    share_link=None,
):
    decorate_post_tags_for_display([post])
    annotate_post_feedback(post, user)
    page = 1
    if request is not None:
        try:
            page = int(request.GET.get("page", "1"))
        except (ValueError, TypeError):
            page = 1
    pagination_base_query = ""
    if request is not None:
        params = request.GET.copy()
        params.pop("page", None)
    pagination_base_query = params.urlencode()
    can_interact = bool(getattr(user, "is_authenticated", False) and not is_share_view)
    can_comment = bool(can_interact and check_comment_permission(user))
    top_level_comments, pagination = build_comment_tree(
        post,
        user,
        request=request,
        book=book,
        is_share_view=is_share_view,
        share_link=share_link,
        page=page,
        paginate_by=5,
        can_comment=can_comment,
    )
    active_reply_parent_id = str(reply_parent_id or "")
    active_edit_comment_id = str(edit_comment_id or "")
    active_share_link = None

    if not is_share_view and getattr(user, "is_authenticated", False) and post.author_id == getattr(user, "pk", None):
        active_share_link = post.share_links.order_by("-created_at", "-pk").first()

    for comment in top_level_comments:
        comment.reply_count = len(comment.replies_list)
        comment.thread_is_expanded = active_reply_parent_id == str(comment.pk) or any(
            active_reply_parent_id == str(reply.pk) or active_edit_comment_id == str(reply.pk) for reply in comment.replies_list
        )
        comment.edit_form = None
        if not can_interact:
            comment.reply_form = None
            for reply in comment.replies_list:
                reply.reply_form = None
                reply.edit_form = None
            continue
        if reply_form is not None and active_reply_parent_id == str(comment.pk):
            current_reply_form = reply_form
        else:
            current_reply_form = CommentForm(prefix=f"reply-{comment.pk}")
        current_reply_form.fields["content"].label = _("Reply")
        current_reply_form.fields["content"].widget.attrs["placeholder"] = _("Write a reply")
        comment.reply_form = current_reply_form
        if edit_form is not None and active_edit_comment_id == str(comment.pk):
            comment.edit_form = edit_form
        else:
            comment.edit_form = CommentForm(instance=comment, prefix=f"edit-{comment.pk}")
        comment.edit_form.fields["content"].label = _("Edit comment")
        comment.edit_form.fields["content"].widget.attrs["placeholder"] = _("Update your comment")
        for reply in comment.replies_list:
            if reply_form is not None and active_reply_parent_id == str(reply.pk):
                nested_reply_form = reply_form
            else:
                nested_reply_form = CommentForm(prefix=f"reply-{reply.pk}")
            nested_reply_form.fields["content"].label = _("Reply")
            nested_reply_form.fields["content"].widget.attrs["placeholder"] = _("Write a reply")
            reply.reply_form = nested_reply_form
            if edit_form is not None and active_edit_comment_id == str(reply.pk):
                reply.edit_form = edit_form
            else:
                reply.edit_form = CommentForm(instance=reply, prefix=f"edit-{reply.pk}")
            reply.edit_form.fields["content"].label = _("Edit comment")
            reply.edit_form.fields["content"].widget.attrs["placeholder"] = _("Update your comment")

    return {
        "rendered_content": render_markdown(post.content),
        "condition_summary_items": get_post_condition_summary_items(post),
        "access_icon_presentation": get_post_access_icon_presentation(post),
        "visibility_presentation": get_post_visibility_presentation(post),
        "related_posts": (
            decorate_post_tags_for_display(list(get_visible_post_queryset(user).filter(status=Post.STATUS_PUBLISHED).exclude(pk=post.pk).order_by("-published_at")[:3]))
            if not is_share_view and getattr(user, "is_authenticated", False)
            else Post.objects.none()
        ),
        "comment_form": comment_form if can_comment else None,
        "comments": top_level_comments,
        "comment_count": post.comments.count(),
        "pagination": pagination,
        "pagination_base_query": pagination_base_query,
        "reply_parent_id": active_reply_parent_id,
        "edit_comment_id": active_edit_comment_id,
        "can_interact": can_interact,
        "can_comment": can_comment,
        "show_related_posts": bool(not is_share_view and getattr(user, "is_authenticated", False)),
        "is_share_view": is_share_view,
        "detail_tags_clickable": not is_share_view,
        "can_generate_share_link": bool(
            getattr(user, "is_authenticated", False)
            and not is_share_view
            and post.author_id == getattr(user, "pk", None)
            and post.status == Post.STATUS_PUBLISHED
            and post.visibility == Post.VISIBILITY_PUBLIC
        ),
        "active_share_link": active_share_link,
        "share_expiry_options": build_share_expiry_options(),
    }


__all__ = ["annotate_post_feedback", "build_post_detail_context"]
