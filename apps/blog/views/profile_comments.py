from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Q
from django.urls import reverse
from django.shortcuts import get_object_or_404, redirect
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import TemplateView

from apps.blog.forms.comment import CommentForm
from apps.blog.models import AuditLog, Comment
from apps.blog.utils import write_audit_log
from apps.blog.utils.site import check_comment_permission
from apps.blog.views.profile import build_profile_nav


class ProfileCommentListView(LoginRequiredMixin, TemplateView):
    template_name = "blog/profile_comments.html"
    paginate_by = 20
    default_sort = "created_at"
    sortable_fields = {
        "post": ("post__title", "pk"),
        "created_at": ("created_at", "pk"),
    }

    def get_current_sort(self):
        sort = (self.request.GET.get("sort") or "").strip()
        if sort in self.sortable_fields:
            return sort
        return self.default_sort

    def get_current_sort_direction(self, sort=None):
        current_sort = sort if sort is not None else self.get_current_sort()
        direction = (self.request.GET.get("dir") or "").strip().lower()
        if current_sort and direction in {"asc", "desc"}:
            return direction
        return "desc"

    def apply_sort(self, queryset):
        sort = self.get_current_sort()
        if not sort:
            return queryset
        sort_config = self.sortable_fields[sort]
        if isinstance(sort_config, str):
            sort_fields = [sort_config]
        else:
            sort_fields = list(sort_config)
        prefix = "-" if self.get_current_sort_direction(sort) == "desc" else ""
        return queryset.order_by(*[f"{prefix}{field}" for field in sort_fields])

    def build_query(self, **updates):
        params = self.request.GET.copy()
        params.pop("page", None)
        for key, value in updates.items():
            if value in (None, ""):
                params.pop(key, None)
            else:
                params[key] = value
        return params.urlencode()

    def get_header_sort_url(self, sort_key):
        is_active = self.get_current_sort() == sort_key
        next_direction = "asc"
        if is_active and self.get_current_sort_direction(sort_key) == "asc":
            next_direction = "desc"
        return f"?{self.build_query(sort=sort_key, dir=next_direction)}"

    def get_sort_headers(self):
        current_sort = self.get_current_sort()
        current_direction = self.get_current_sort_direction(current_sort)
        headers = {}
        for sort_key in self.sortable_fields:
            headers[sort_key] = {
                "url": self.get_header_sort_url(sort_key),
                "is_active": current_sort == sort_key,
                "direction": current_direction if current_sort == sort_key else "",
            }
        return headers

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = Comment.objects.select_related("post").filter(
            author=self.request.user
        )
        if query:
            queryset = queryset.filter(
                Q(content__icontains=query)
                | Q(post__title__icontains=query)
                | Q(post__summary__icontains=query)
            )
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["profile_nav"] = build_profile_nav()
        context["current_section"] = "comments"
        context["can_comment"] = check_comment_permission(self.request.user)
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        context["comments"] = page_obj.object_list
        context["page_obj"] = page_obj
        context["paginator"] = paginator
        context["is_paginated"] = paginator.num_pages > 1
        context["current_sort"] = self.get_current_sort() or ""
        context["current_sort_direction"] = self.get_current_sort_direction() if self.get_current_sort() else ""
        context["sort_headers"] = self.get_sort_headers()
        context["pagination_query"] = self.build_query()
        context["query"] = (self.request.GET.get("q") or "").strip()
        context["edit_form"] = CommentForm(user=self.request.user)
        return context


class ProfileCommentUpdateView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        comment = get_object_or_404(
            Comment.objects.select_related("post").filter(author=request.user),
            pk=kwargs["pk"],
        )
        if not check_comment_permission(request.user):
            messages.error(request, _("You do not have permission to edit comments."))
            return redirect(self.get_success_url())
        form = CommentForm(request.POST, instance=comment, user=request.user)
        if not form.is_valid():
            messages.error(request, _("Comment content cannot be empty."))
            return redirect(self.get_success_url())

        updated_comment = form.save()
        audit_message = _("Comment updated on %(title)s") % {"title": updated_comment.post.title}
        write_audit_log(request, AuditLog.ACTION_COMMENT_UPDATE, str(audit_message), user=request.user)
        messages.success(request, _("Comment updated successfully."))
        return redirect(self.get_success_url())

    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        return next_url or reverse("profile-comments")


class ProfileCommentDeleteView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        comment = get_object_or_404(
            Comment.objects.select_related("post").filter(author=request.user),
            pk=kwargs["pk"],
        )
        post_title = comment.post.title
        comment.delete()
        write_audit_log(
            request,
            AuditLog.ACTION_COMMENT_DELETE,
            str(_("Comment deleted on %(title)s")) % {"title": post_title},
            user=request.user,
        )
        messages.success(request, _("Comment deleted successfully."))
        return redirect(self.get_success_url())

    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        return next_url or reverse("profile-comments")


__all__ = ["ProfileCommentListView", "ProfileCommentUpdateView", "ProfileCommentDeleteView"]
