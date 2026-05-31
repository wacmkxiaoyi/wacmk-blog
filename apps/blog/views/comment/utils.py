from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.blog.constants import LEGACY_VIP_GROUP_NAME, get_default_business_group_name, get_vip_group_name
from apps.blog.forms.comment import normalize_comment_content
from apps.blog.models import Comment, CommentFeedback
from apps.blog.utils.markdown import render_markdown
from apps.blog.utils.site import get_normalized_vip_level_names, get_or_create_site_setting
from apps.blog.views.book.utils import rewrite_book_content_internal_links


def get_comment_delete_allowed(comment, user):
    if not getattr(user, "is_authenticated", False):
        return False
    return user.is_staff or user.is_superuser or comment.author_id == user.pk


def get_comment_edit_allowed(comment, user):
    if not getattr(user, "is_authenticated", False):
        return False
    return user.is_staff or user.is_superuser or comment.author_id == user.pk


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


def _build_author_vip_map(comment_list):
    author_ids = set()
    for c in comment_list:
        author_ids.add(c.author_id)
        if c.reply_to_id:
            author_ids.add(c.reply_to.author_id)
        if c.parent_id:
            author_ids.add(c.parent.author_id)

    if not author_ids:
        return {}

    from django.contrib.auth.models import User
    group_rows = User.groups.through.objects.filter(
        user_id__in=author_ids,
    ).select_related("group").values_list("user_id", "group__name")

    author_group_names = {}
    for user_id, group_name in group_rows:
        author_group_names.setdefault(user_id, set()).add(group_name)

    site_setting = get_or_create_site_setting()
    vip_level_names = get_normalized_vip_level_names(site_setting)
    max_level = len(vip_level_names)
    default_group = get_default_business_group_name()

    vip_map = {}
    for author_id in author_ids:
        group_names = author_group_names.get(author_id, set())
        vip_label = ""
        for level in range(max_level, 0, -1):
            if get_vip_group_name(level) in group_names:
                vip_label = vip_level_names[level - 1]
                break
        if not vip_label and max_level > 0 and LEGACY_VIP_GROUP_NAME in group_names:
            vip_label = vip_level_names[max_level - 1]
        is_vip = bool(vip_label)

        # 作者/管理员优先级高于VIP, 但先计算出原始值, 模板中再判断
        vip_map[author_id] = (is_vip, vip_label)

    return vip_map


def build_comment_tree(post, user, *, request=None, book=None, is_share_view=False, share_link=None, page=1, paginate_by=5, can_comment=True):
    feedback_counts, user_feedback = build_comment_feedback_maps(post, user)
    comment_list = list(
        post.comments.select_related(
            "author", "author__profile",
            "parent", "parent__author", "parent__author__profile",
            "reply_to", "reply_to__author", "reply_to__author__profile",
        )
        .annotate(
            up_count=Count("feedback_entries", filter=Q(feedback_entries__value=1)),
        )
        .order_by("-up_count", "created_at", "pk")
    )
    top_level_comments = []
    comments_by_parent_id = {}

    author_vip_map = _build_author_vip_map(comment_list)

    def render_comment_content(comment):
        rendered_content = render_markdown(normalize_comment_content(comment.content))
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
        comment.can_edit = get_comment_edit_allowed(comment, user) and can_comment
        comment.is_post_author = comment.author_id == post.author_id
        comment.is_admin = comment.author.is_staff or comment.author.is_superuser
        comment.author_is_vip, comment.author_vip_label = author_vip_map.get(comment.author_id, (False, ""))
        comment.reply_form = None
        comment.edit_form = None
        comment.reply_target = comment.reply_to or comment.parent
        comment.reply_target_is_post_author = bool(comment.reply_target and comment.reply_target.author_id == post.author_id)
        comment.reply_target_is_admin = bool(comment.reply_target and (comment.reply_target.author.is_staff or comment.reply_target.author.is_superuser))
        _reply_target_vip = author_vip_map.get(comment.reply_target.author_id, (False, "")) if comment.reply_target else (False, "")
        comment.reply_target_is_vip, comment.reply_target_vip_label = _reply_target_vip
        comment.up_count = feedback_counts.get(comment.pk, {}).get("up", 0)
        comment.down_count = feedback_counts.get(comment.pk, {}).get("down", 0)
        comment.feedback_value = user_feedback.get(comment.pk, 0)
        comments_by_parent_id.setdefault(comment.parent_id, []).append(comment)

    for comment in comments_by_parent_id.get(None, []):
        comment.replies_list = comments_by_parent_id.get(comment.pk, [])
        top_level_comments.append(comment)

    pinned_comment = None
    if getattr(user, "is_authenticated", False):
        pin_window_start = timezone.now() - timedelta(minutes=5)
        for comment in top_level_comments:
            if comment.author_id == user.pk and comment.created_at >= pin_window_start:
                pinned_comment = comment
                break

    pagination = None
    if paginate_by:
        remaining = [c for c in top_level_comments if c != pinned_comment]
        total = len(remaining)
        total_pages = max(1, (total + paginate_by - 1) // paginate_by)
        page = max(1, min(page, total_pages))
        start = (page - 1) * paginate_by
        end = start + paginate_by
        paginated = remaining[start:end]

        if page == 1 and pinned_comment:
            paginated.insert(0, pinned_comment)

        top_level_comments = paginated

        pagination = {
            "page": page,
            "total_pages": total_pages,
            "has_previous": page > 1,
            "has_next": page < total_pages,
            "previous_page_number": page - 1 if page > 1 else None,
            "next_page_number": page + 1 if page < total_pages else None,
            "total_count": total,
            "paginate_by": paginate_by,
            "is_paginated": total_pages > 1,
        }

    return top_level_comments, pagination


__all__ = [name for name in globals() if not name.startswith("_")]
