from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View

from apps.blog.forms.comment import CommentForm
from apps.blog.models import AuditLog, Comment, CommentFeedback
from apps.blog.services.comment_rewards import grant_first_comment_reward_once
from apps.blog.utils import get_safe_next_url, with_fragment, write_audit_log
from apps.blog.utils.request import get_feedback_value_from_request
from apps.blog.utils.site import check_comment_permission
from apps.blog.views.media import MEDIA_UPLOAD_CONTEXT_COMMENT
from apps.blog.views.post.utils import can_access_post, get_detail_post_queryset

from .utils import get_comment_delete_allowed, get_comment_edit_allowed, is_comment_rate_limited, toggle_feedback


def get_comment_detail_view(post, request):
    from apps.blog.views.book.public import BookDetailView
    from apps.blog.views.book.external import BookShareDetailView
    from apps.blog.views.post.public import BlogDetailView
    from apps.blog.models import BookShareLink
    from apps.blog.views.book.utils import get_detail_book_queryset

    next_url = (request.GET.get("next") or request.POST.get("next") or "").strip()

    if next_url.startswith("/book-share/"):
        detail_view = BookShareDetailView()
        detail_view.setup(request, token=getattr(request.resolver_match, "kwargs", {}).get("token"))
        detail_view.share_link = get_object_or_404(BookShareLink.objects.select_related("book", "book__created_by"), token=request.resolver_match.kwargs["token"])
        if detail_view.share_link.is_expired:
            raise Http404
        detail_view.object = detail_view.share_link.book
        detail_view._current_post = post
        return detail_view

    if next_url.startswith("/book/"):
        detail_view = BookDetailView()
        detail_view.setup(request, slug=getattr(request.resolver_match, "kwargs", {}).get("slug"))
        detail_view.object = get_object_or_404(get_detail_book_queryset(request.user), slug=request.resolver_match.kwargs["slug"])
        detail_view._current_post = post
        return detail_view
    detail_view = BlogDetailView()
    detail_view.setup(request, slug=post.slug)
    detail_view.object = post
    return detail_view


class CommentCreateView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        post = get_object_or_404(get_detail_post_queryset(request.user), slug=kwargs["slug"])
        if not can_access_post(request, post):
            raise Http404

        if not check_comment_permission(request.user):
            messages.error(request, _("You do not have permission to post comments."))
            return redirect(f"{post.get_absolute_url()}#comments")

        parent_id = (request.POST.get("parent_id") or "").strip()
        target_comment = None
        parent = None
        form_prefix = None
        if parent_id:
            target_comment = get_object_or_404(Comment.objects.select_related("post", "parent"), pk=parent_id, post=post)
            parent = target_comment if target_comment.parent_id is None else target_comment.parent
            form_prefix = f"reply-{target_comment.pk}"

        form = CommentForm(
            request.POST,
            prefix=form_prefix,
            user=request.user,
            editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT,
            image_upload_url=reverse("frontend-upload-image"),
        )

        if not form.is_valid():
            detail_view = get_comment_detail_view(post, request)
            return detail_view.render_to_response(
                detail_view.get_context_data(
                    comment_form=form if parent is None else CommentForm(user=request.user, editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT, image_upload_url=reverse("frontend-upload-image")),
                    reply_parent_id=parent_id,
                    reply_form=form if parent is not None else None,
                )
            )

        if is_comment_rate_limited(request.user, post):
            form.add_error(None, _("You are commenting too frequently. Please try again later."))
            detail_view = get_comment_detail_view(post, request)
            return detail_view.render_to_response(
                detail_view.get_context_data(
                    comment_form=form if parent is None else CommentForm(user=request.user, editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT, image_upload_url=reverse("frontend-upload-image")),
                    reply_parent_id=parent_id,
                    reply_form=form if parent is not None else None,
                )
            )

        comment = form.save(commit=False)
        comment.post = post
        comment.author = request.user
        comment.parent = parent
        comment.reply_to = target_comment if target_comment is not None else None
        try:
            comment.full_clean()
        except ValidationError:
            messages.error(request, _("Replies can only target a top-level comment or one of its direct replies."))
            return redirect(f"{post.get_absolute_url()}#comments")

        with transaction.atomic():
            comment.save()
            reward_result = grant_first_comment_reward_once(comment)
        action_message = _("Reply posted successfully.") if parent else _("Comment posted successfully.")
        audit_message = _("Comment created on %(title)s") % {"title": post.title}
        write_audit_log(request, AuditLog.ACTION_COMMENT_CREATE, str(audit_message), user=request.user)
        if reward_result["granted"]:
            base_money = reward_result.get("base_reward_money", 0)
            base_points = reward_result.get("base_reward_points", 0)
            vip_money = reward_result.get("vip_reward_money", 0)
            vip_points = reward_result.get("vip_reward_points", 0)
            vip_display_name = reward_result.get("vip_display_name") or _("VIP")
            reward_message = _("%(action)s First comment reward: +%(money)s money, +%(points)s points.") % {
                "action": action_message,
                "money": reward_result["reward_money"],
                "points": reward_result["reward_points"],
            }
            if vip_money > 0 or vip_points > 0:
                reward_message += " " + _("Base: +%(base_money)s money, +%(base_points)s points; %(vip_name)s bonus: +%(vip_money)s money, +%(vip_points)s points.") % {
                    "base_money": base_money,
                    "base_points": base_points,
                    "vip_name": vip_display_name,
                    "vip_money": vip_money,
                    "vip_points": vip_points,
                }
            messages.success(
                request,
                reward_message,
            )
        else:
            messages.success(request, action_message)
        return redirect(with_fragment(get_safe_next_url(request) or post.get_absolute_url(), f"comment-{comment.pk}"))


class CommentDeleteView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        comment = get_object_or_404(Comment.objects.select_related("post", "author"), pk=kwargs["pk"])
        if not get_comment_delete_allowed(comment, request.user):
            messages.error(request, _("You do not have permission to delete this comment."))
            return redirect(with_fragment(get_safe_next_url(request) or comment.post.get_absolute_url(), "comments"))

        audit_message = _("Comment deleted on %(title)s") % {"title": comment.post.title}
        comment.delete()
        write_audit_log(request, AuditLog.ACTION_COMMENT_DELETE, str(audit_message), user=request.user)
        messages.success(request, _("Comment deleted successfully."))
        return redirect(with_fragment(get_safe_next_url(request) or comment.post.get_absolute_url(), "comments"))


class CommentUpdateView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        comment = get_object_or_404(Comment.objects.select_related("post", "author", "parent", "reply_to"), pk=kwargs["pk"])
        if not get_comment_edit_allowed(comment, request.user):
            messages.error(request, _("You do not have permission to edit this comment."))
            return redirect(with_fragment(get_safe_next_url(request) or comment.post.get_absolute_url(), f"comment-{comment.pk}"))

        if not check_comment_permission(request.user):
            messages.error(request, _("You do not have permission to edit comments."))
            return redirect(with_fragment(get_safe_next_url(request) or comment.post.get_absolute_url(), f"comment-{comment.pk}"))

        form = CommentForm(
            request.POST,
            instance=comment,
            prefix=f"edit-{comment.pk}",
            user=request.user,
            editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT,
            image_upload_url=reverse("frontend-upload-image"),
        )
        if not form.is_valid():
            detail_view = get_comment_detail_view(comment.post, request)
            return detail_view.render_to_response(
                detail_view.get_context_data(
                    comment_form=CommentForm(user=request.user, editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT, image_upload_url=reverse("frontend-upload-image")),
                    reply_parent_id="",
                    edit_comment_id=comment.pk,
                    edit_form=form,
                )
            )

        updated_comment = form.save()
        audit_message = _("Comment updated on %(title)s") % {"title": updated_comment.post.title}
        write_audit_log(request, AuditLog.ACTION_COMMENT_UPDATE, str(audit_message), user=request.user)
        messages.success(request, _("Comment updated successfully."))
        return redirect(with_fragment(get_safe_next_url(request) or updated_comment.post.get_absolute_url(), f"comment-{updated_comment.pk}"))


class CommentFeedbackToggleView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        comment = get_object_or_404(
            Comment.objects.select_related("post"),
            pk=kwargs["pk"],
            post__in=get_detail_post_queryset(request.user),
        )
        if not can_access_post(request, comment.post):
            raise Http404
        try:
            value = get_feedback_value_from_request(request)
        except ValidationError as exc:
            return JsonResponse({"ok": False, "message": exc.message_dict["value"][0]}, status=400)

        active_value = toggle_feedback(CommentFeedback, {"comment": comment}, request.user, value)
        counts = comment.feedback_entries.aggregate(
            up_count=Count("id", filter=Q(value=1)),
            down_count=Count("id", filter=Q(value=-1)),
        )
        return JsonResponse(
            {
                "ok": True,
                "active_value": active_value,
                "up_count": counts["up_count"] or 0,
                "down_count": counts["down_count"] or 0,
            }
        )


__all__ = ["CommentCreateView", "CommentDeleteView", "CommentFeedbackToggleView", "CommentUpdateView", "get_comment_detail_view"]
