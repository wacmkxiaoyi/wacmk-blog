from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.blog.models import Comment, CommentFeedback
from apps.blog.utils.markdown import render_markdown
from apps.blog.views.book.utils import rewrite_book_content_internal_links


def get_comment_delete_allowed(comment, user):
    if not getattr(user, "is_authenticated", False):
        return False
    return user.is_staff or user.is_superuser or comment.author_id == user.pk


def get_comment_edit_allowed(comment, user):
    if not getattr(user, "is_authenticated", False):
        return False
    return comment.author_id == user.pk


def get_comment_rate_limit_window_start():
    return timezone.now() - timedelta(minutes=1)


def is_comment_rate_limited(user, post):
    limit = settings.COMMENT_RATE_LIMIT_PER_MINUTE
    if limit == 0:
        return False
    recent_count = Comment.objects.filter(
        author=user,
        post=post,
        created_at__gte=get_comment_rate_limit_window_start(),
    ).count()
    return recent_count >= limit


def build_comment_feedback_maps(post, user):
    counts = {
        row["comment_id"]: {"up": row["up_count"] or 0, "down": row["down_count"] or 0}
        for row in CommentFeedback.objects.filter(comment__post=post)
        .values("comment_id")
        .annotate(
            up_count=Count("id", filter=Q(value=1)),
            down_count=Count("id", filter=Q(value=-1)),
        )
    }
    user_feedback = {}
    if getattr(user, "is_authenticated", False):
        user_feedback = dict(
            CommentFeedback.objects.filter(comment__post=post, user=user).values_list("comment_id", "value")
        )
    return counts, user_feedback


def toggle_feedback(model, filter_kwargs, user, value):
    with transaction.atomic():
        entry = model.objects.select_for_update().filter(user=user, **filter_kwargs).first()
        active_value = 0
        if entry is None:
            entry = model(user=user, value=value, **filter_kwargs)
            entry.full_clean()
            entry.save()
            active_value = value
        elif entry.value == value:
            entry.delete()
        else:
            entry.value = value
            entry.full_clean()
            entry.save(update_fields=["value", "updated_at"])
            active_value = value
    return active_value


def build_comment_tree(post, user, *, request=None, book=None, is_share_view=False, share_link=None):
    feedback_counts, user_feedback = build_comment_feedback_maps(post, user)
    comment_list = list(
        post.comments.select_related("author", "parent", "reply_to", "reply_to__author")
        .order_by("created_at", "pk")
    )
    top_level_comments = []
    comments_by_parent_id = {}

    def render_comment_content(comment):
        rendered_content = render_markdown(comment.content)
        if request is None or book is None:
            return rendered_content
        return rewrite_book_content_internal_links(
            rendered_content,
            book=book,
            request=request,
            is_share_view=is_share_view,
            share_link=share_link,
        )

    for comment in comment_list:
        comment.rendered_content = render_comment_content(comment)
        comment.can_delete = get_comment_delete_allowed(comment, user)
        comment.can_edit = get_comment_edit_allowed(comment, user)
        comment.is_post_author = comment.author_id == post.author_id
        comment.is_admin = comment.author.is_staff or comment.author.is_superuser
        comment.reply_form = None
        comment.edit_form = None
        comment.reply_target = comment.reply_to or comment.parent
        comment.reply_target_is_post_author = bool(comment.reply_target and comment.reply_target.author_id == post.author_id)
        comment.reply_target_is_admin = bool(comment.reply_target and (comment.reply_target.author.is_staff or comment.reply_target.author.is_superuser))
        comment.up_count = feedback_counts.get(comment.pk, {}).get("up", 0)
        comment.down_count = feedback_counts.get(comment.pk, {}).get("down", 0)
        comment.feedback_value = user_feedback.get(comment.pk, 0)
        comments_by_parent_id.setdefault(comment.parent_id, []).append(comment)

    for comment in comments_by_parent_id.get(None, []):
        comment.replies_list = comments_by_parent_id.get(comment.pk, [])
        top_level_comments.append(comment)

    return top_level_comments


__all__ = [name for name in globals() if not name.startswith("_")]
