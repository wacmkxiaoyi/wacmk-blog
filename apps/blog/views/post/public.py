from urllib.parse import urlencode

from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import DetailView, ListView

from apps.blog.access import build_access_check
from apps.blog.forms.comment import CommentForm
from apps.blog.forms.common import SearchForm
from apps.blog.models import Post, PostFeedback, PostStar
from apps.blog.services.author_rewards import grant_author_reward_once
from apps.blog.utils import record_post_view
from apps.blog.views.media import MEDIA_UPLOAD_CONTEXT_COMMENT
from apps.blog.views.post.context import annotate_post_feedback, build_post_detail_context
from apps.blog.views.post.utils import (
    get_detail_post_queryset,
    get_visible_post_queryset,
    order_posts_by_user_stars,
    prepare_post_cards,
    with_post_feedback_counts,
)


class BlogDetailView(LoginRequiredMixin, DetailView):
    template_name = "blog/detail.html"
    context_object_name = "post"

    def get_queryset(self):
        return get_detail_post_queryset(self.request.user)

    def dispatch(self, request, *args, **kwargs):
        self.object = self.get_object()
        access_check = build_access_check(self.object, request.user)

        if access_check["all_granted"]:
            grant_author_reward_once(self.object, request.user)
            return super().dispatch(request, *args, **kwargs)

        self._access_check = access_check
        self.template_name = "blog/access_gate.html"
        return self.render_to_response(self.get_context_data(is_access_gate=True))

    def get_context_data(self, **kwargs):
        if kwargs.get("is_access_gate"):
            return {
                "is_access_gate": True,
                "access_object": self.object,
                "post": self.object,
                "object_name": self.object.title,
                "access_check": self._access_check,
                "object_type": "post",
                "check_url": reverse("access-check", kwargs={"object_type": "post", "object_id": self.object.pk}),
            }

        context = super().get_context_data(**kwargs)
        if not getattr(self, "_view_recorded", False):
            record_post_view(self.request, self.object)
            self.object.refresh_from_db(fields=["view_count"])
            self._view_recorded = True
        context.update(
            build_post_detail_context(
                self.object,
                self.request.user,
                comment_form=kwargs.get("comment_form") or CommentForm(user=self.request.user, editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT, image_upload_url=reverse("frontend-upload-image")),
                reply_parent_id=kwargs.get("reply_parent_id"),
                reply_form=kwargs.get("reply_form"),
                edit_comment_id=kwargs.get("edit_comment_id"),
                edit_form=kwargs.get("edit_form"),
                request=self.request,
            )
        )
        context.setdefault("detail_timestamp", self.object.published_at)
        context.setdefault("detail_timestamp_label", _("Published"))
        return context


class ArticleListView(LoginRequiredMixin, ListView):
    template_name = "blog/article_list.html"
    context_object_name = "posts"
    paginate_by = 12

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = get_visible_post_queryset(self.request.user)
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(summary__icontains=query)
                | Q(content__icontains=query)
                | Q(tags__name__icontains=query)
            ).distinct()
        queryset = with_post_feedback_counts(queryset.filter(status=Post.STATUS_PUBLISHED))
        queryset = order_posts_by_user_stars(queryset, self.request.user, "-published_at", "-updated_at")
        return prepare_post_cards(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        context["query"] = query
        context["pagination_query"] = urlencode({"q": query}) if query else ""
        return context


class SearchView(LoginRequiredMixin, ListView):
    template_name = "blog/search.html"
    context_object_name = "posts"
    paginate_by = 12

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = with_post_feedback_counts(get_visible_post_queryset(self.request.user).filter(status=Post.STATUS_PUBLISHED))
        if not query:
            return queryset.none()
        queryset = queryset.filter(
            Q(title__icontains=query)
            | Q(summary__icontains=query)
            | Q(content__icontains=query)
            | Q(books__name__icontains=query)
            | Q(tags__name__icontains=query)
            | Q(author__username__icontains=query)
            | Q(author__first_name__icontains=query)
        ).distinct()
        queryset = order_posts_by_user_stars(queryset, self.request.user, "-published_at", "-updated_at")
        return prepare_post_cards(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        context["query"] = query
        context["pagination_query"] = urlencode({"q": query}) if query else ""
        context["search_form"] = SearchForm(self.request.GET or None)
        return context


class PostFeedbackToggleView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        from apps.blog.views.comment.utils import toggle_feedback
        from apps.blog.utils.request import get_feedback_value_from_request

        post = get_object_or_404(get_detail_post_queryset(request.user), slug=kwargs["slug"])
        if not build_access_check(post, request.user)["all_granted"]:
            raise Http404
        try:
            value = get_feedback_value_from_request(request)
        except ValidationError as exc:
            return JsonResponse({"ok": False, "message": exc.message_dict["value"][0]}, status=400)

        active_value = toggle_feedback(PostFeedback, {"post": post}, request.user, value)
        annotate_post_feedback(post, request.user)
        return JsonResponse(
            {
                "ok": True,
                "active_value": active_value,
                "up_count": post.up_count,
                "down_count": post.down_count,
            }
        )


class PostStarToggleView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        post = get_object_or_404(get_detail_post_queryset(request.user), slug=kwargs["slug"])
        if not build_access_check(post, request.user)["all_granted"]:
            raise Http404

        with transaction.atomic():
            existing_star = PostStar.objects.select_for_update().filter(post=post, user=request.user).first()
            if existing_star is not None:
                existing_star.delete()
                starred = False
            else:
                PostStar.objects.create(post=post, user=request.user)
                starred = True

        return JsonResponse({"ok": True, "starred": starred, "post_id": post.pk})


__all__ = ["ArticleListView", "BlogDetailView", "PostFeedbackToggleView", "PostStarToggleView", "SearchView"]
