from urllib.parse import urlencode

from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import DetailView, ListView

from apps.blog.forms import CommentForm, SearchForm
from apps.blog.models import Post, PostFeedback
from apps.blog.utils import is_ajax_request, record_post_view
from apps.blog.views.post.context import annotate_post_feedback, build_post_detail_context
from apps.blog.views.post.utils import PostAccessForm, can_access_post, can_bypass_post_password, get_detail_post_queryset, get_visible_post_queryset, mark_post_unlocked, post_requires_password, with_post_feedback_counts
from apps.blog.views.tag.utils import decorate_post_tags_for_display


class BlogDetailView(LoginRequiredMixin, DetailView):
    template_name = "blog/detail.html"
    context_object_name = "post"

    def get_queryset(self):
        return get_detail_post_queryset(self.request.user)

    def dispatch(self, request, *args, **kwargs):
        self.object = self.get_object()
        if request.method.lower() == "post" and self.object.visibility == Post.VISIBILITY_ENCRYPTED:
            return super().dispatch(request, *args, **kwargs)
        if can_access_post(request, self.object):
            return super().dispatch(request, *args, **kwargs)
        if self.object.visibility == Post.VISIBILITY_ENCRYPTED:
            self.access_form = PostAccessForm()
            return self.render_to_response(self.get_context_data(access_form=self.access_form, requires_password=True))
        raise Http404

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if not kwargs.get("requires_password") and not getattr(self, "_view_recorded", False):
            record_post_view(self.request, self.object)
            self.object.refresh_from_db(fields=["view_count"])
            self._view_recorded = True
        context.update(
            build_post_detail_context(
                self.object,
                self.request.user,
                comment_form=kwargs.get("comment_form") or CommentForm(),
                reply_parent_id=kwargs.get("reply_parent_id"),
                reply_form=kwargs.get("reply_form"),
                edit_comment_id=kwargs.get("edit_comment_id"),
                edit_form=kwargs.get("edit_form"),
                request=self.request,
            )
        )
        context.setdefault("detail_timestamp", self.object.published_at)
        context.setdefault("detail_timestamp_label", _("Published"))
        context.setdefault("requires_password", False)
        context.setdefault("access_form", kwargs.get("access_form") or PostAccessForm())
        context.setdefault("password_submit_url", self.object.get_absolute_url())
        context.setdefault("password_modal_title", _("Enter password to view this article"))
        context.setdefault("password_modal_kicker", _("Encrypted"))
        context.setdefault("password_modal_confirm", _("Unlock article"))
        context.setdefault("password_modal_cancel", _("Cancel"))
        context.setdefault("post_requires_password", post_requires_password(self.request, self.object))
        return context

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if self.object.visibility != Post.VISIBILITY_ENCRYPTED:
            raise Http404
        if can_bypass_post_password(request.user, self.object):
            if is_ajax_request(request):
                return JsonResponse({"ok": True, "redirect_url": self.object.get_absolute_url()})
            return redirect(self.object.get_absolute_url())
        form = PostAccessForm(request.POST)
        if not form.is_valid():
            if is_ajax_request(request):
                return JsonResponse({"ok": False, "message": str(form.errors.get("password", [_("Password is required.")])[0])}, status=400)
            return self.render_to_response(self.get_context_data(access_form=form, requires_password=True))
        if not self.object.check_access_password(form.cleaned_data["password"]):
            form.add_error("password", _("Incorrect password."))
            if is_ajax_request(request):
                return JsonResponse({"ok": False, "message": str(_("Incorrect password."))}, status=400)
            return self.render_to_response(self.get_context_data(access_form=form, requires_password=True))
        mark_post_unlocked(request, self.object)
        if is_ajax_request(request):
            return JsonResponse({"ok": True, "redirect_url": self.object.get_absolute_url()})
        return redirect(self.object.get_absolute_url())


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
        return decorate_post_tags_for_display(list(with_post_feedback_counts(
            queryset
            .filter(status=Post.STATUS_PUBLISHED)
            .order_by("-published_at", "-updated_at")
        )))

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
        return decorate_post_tags_for_display(list(queryset.filter(
            Q(title__icontains=query)
            | Q(summary__icontains=query)
            | Q(content__icontains=query)
            | Q(books__name__icontains=query)
            | Q(tags__name__icontains=query)
            | Q(author__username__icontains=query)
            | Q(author__first_name__icontains=query)
        ).distinct()))

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
        if not can_access_post(request, post):
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


__all__ = ["ArticleListView", "BlogDetailView", "PostFeedbackToggleView", "SearchView"]
