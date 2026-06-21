from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import CreateView, TemplateView, UpdateView

from apps.blog.forms.book import BookForm
from apps.blog.models import AuditLog, Book, BookShareLink, Post
from apps.blog.utils import build_user_business_identity_summary, get_or_create_site_setting, write_audit_log
from apps.blog.views.book.utils import build_book_share_editor_context
from apps.blog.views.profile import build_profile_nav
from apps.blog.visibility import (
    book_has_any_conditions,
    book_has_vip_standalone,
    get_book_condition_summary_items,
    get_book_vip_condition_summary_items,
    get_book_vip_visibility_presentation,
    get_book_visibility_presentation,
    get_post_access_display,
    get_post_access_icon_presentation,
)
from apps.blog.views.post.utils import (
    get_book_post_access_state,
    order_posts_by_user_stars,
    prepare_post_cards,
    with_post_feedback_counts,
)


class ProfileBookAccessMixin(LoginRequiredMixin):
    def get_profile_context(self, **kwargs):
        site_setting = get_or_create_site_setting()
        context = kwargs
        context["site_setting"] = site_setting
        context["profile_nav"] = build_profile_nav()
        context["current_section"] = context.get("current_section") or "books"
        return context


class ProfileBookWriteMixin(ProfileBookAccessMixin):
    enforce_book_limit = True

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_staff or request.user.is_superuser:
            return super().dispatch(request, *args, **kwargs)
        site_setting = get_or_create_site_setting()
        if not site_setting["allow_non_admin_create_book"]:
            raise PermissionDenied()
        if site_setting["vip_only_create_book"]:
            identity = build_user_business_identity_summary(request.user, site_setting)
            if not identity["is_vip"]:
                raise PermissionDenied()
        if self.enforce_book_limit and site_setting["non_admin_max_book_count"] > 0:
            book_count = Book.objects.filter(created_by=request.user).count()
            if book_count >= site_setting["non_admin_max_book_count"]:
                raise PermissionDenied()
        return super().dispatch(request, *args, **kwargs)


def _compute_can_create_book(request):
    site_setting = get_or_create_site_setting()
    if request.user.is_staff or request.user.is_superuser:
        return True
    if not site_setting["allow_non_admin_create_book"]:
        return False
    if site_setting["vip_only_create_book"]:
        identity = build_user_business_identity_summary(request.user, site_setting)
        if not identity["is_vip"]:
            return False
    if site_setting["non_admin_max_book_count"] > 0:
        book_count = Book.objects.filter(created_by=request.user).count()
        if book_count >= site_setting["non_admin_max_book_count"]:
            return False
    return True


class ProfileBookListView(ProfileBookAccessMixin, TemplateView):
    template_name = "blog/profile/books.html"
    paginate_by = 15
    default_sort = "updated_at"
    sortable_fields = {
        "name": ("name", "pk"),
        "post_count": ("post_count", "name", "pk"),
        "updated_at": ("updated_at", "pk"),
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
        queryset = Book.objects.annotate(post_count=Count("posts", distinct=True)).filter(
            created_by=self.request.user
        )
        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(slug__icontains=query))
        books = list(self.apply_sort(queryset))
        for book in books:
            book.condition_summary_items = get_book_condition_summary_items(book)
            book.visibility_presentation = get_book_visibility_presentation(book)
            book.show_vip_badge = book_has_vip_standalone(book)
            if book.show_vip_badge:
                book.vip_condition_summary_items = get_book_vip_condition_summary_items(book)
                book.vip_visibility_presentation = get_book_vip_visibility_presentation(book)
        return books

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context())
        context["can_create_book"] = _compute_can_create_book(self.request)
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        context["books"] = page_obj.object_list
        context["page_obj"] = page_obj
        context["paginator"] = paginator
        context["is_paginated"] = paginator.num_pages > 1
        context["current_sort"] = self.get_current_sort() or ""
        context["current_sort_direction"] = self.get_current_sort_direction() if self.get_current_sort() else ""
        context["sort_headers"] = self.get_sort_headers()
        context["pagination_query"] = self.build_query()
        context["query"] = (self.request.GET.get("q") or "").strip()
        return context


class ProfileBookCreateView(ProfileBookWriteMixin, CreateView):
    template_name = "blog/editor/book_form.html"
    form_class = BookForm

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        kwargs["request"] = self.request
        return kwargs

    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        if next_url:
            return next_url
        return reverse("profile-books")

    def form_valid(self, form):
        form.instance.created_by = self.request.user
        response = super().form_valid(form)
        write_audit_log(
            self.request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("Book created: %(name)s")) % {"name": self.object.name},
            user=self.request.user,
        )
        messages.success(self.request, _("Book created successfully."))
        return response

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context())
        context["page_title"] = _("Create book")
        context["next_url"] = (self.request.GET.get("next") or "").strip()
        context["is_profile_book_view"] = True
        context.update(build_book_share_editor_context(context["form"].instance, self.request))
        return context


class ProfileBookUpdateView(ProfileBookWriteMixin, UpdateView):
    enforce_book_limit = False
    template_name = "blog/editor/book_form.html"
    context_object_name = "book"
    form_class = BookForm

    def get_queryset(self):
        return Book.objects.select_related("created_by").prefetch_related("posts__author").filter(
            created_by=self.request.user
        )

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        kwargs["request"] = self.request
        return kwargs

    def form_valid(self, form):
        response = super().form_valid(form)
        if self.object.visibility != Book.VISIBILITY_PUBLIC or book_has_any_conditions(self.object):
            BookShareLink.objects.filter(book=self.object).delete()
        write_audit_log(
            self.request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("Book updated: %(name)s")) % {"name": self.object.name},
            user=self.request.user,
        )
        messages.success(self.request, _("Book updated successfully."))
        return response

    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        if next_url:
            return next_url
        return reverse("profile-books")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context())
        context["page_title"] = self.object.name
        context["next_url"] = (self.request.GET.get("next") or "").strip()
        context["is_profile_book_view"] = True
        context["posts"] = self.object.posts.select_related("author", "revision_draft").prefetch_related("tags", "books").order_by("-updated_at")
        selected_ids = {str(post.pk) for post in context["posts"]}
        context["form"].post_options = [option for option in context["form"].post_options if option["value"] in selected_ids]
        context.update(build_book_share_editor_context(self.object, self.request))
        return context


class ProfileBookDeleteView(ProfileBookWriteMixin, View):
    enforce_book_limit = False
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        book = get_object_or_404(Book.objects.filter(created_by=request.user), pk=kwargs["pk"])
        book_name = book.name
        book.delete()
        write_audit_log(
            request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("Book deleted: %(name)s")) % {"name": book_name},
            user=request.user,
        )
        messages.success(request, _("Book deleted successfully."))
        return redirect("profile-books")


def _compute_book_post_access(request, post):
    access_state = get_book_post_access_state(request, post)
    return {
        "can_access": access_state["can_add"],
        "requires_password": access_state["requires_password"],
        "requires_condition": access_state["requires_condition"],
        "condition_status": access_state["condition_status"],
        "condition_money": access_state["condition_money"],
        "condition_points": access_state["condition_points"],
    }


class ProfileBookPostSearchView(ProfileBookWriteMixin, View):
    enforce_book_limit = False
    http_method_names = ["get"]
    paginate_by = 12

    def get(self, request, *args, **kwargs):
        query = (request.GET.get("q") or "").strip()
        queryset = with_post_feedback_counts(
            Post.objects.filter(status=Post.STATUS_PUBLISHED).select_related("author")
        )
        if not request.user.is_staff and not request.user.is_superuser:
            queryset = queryset.filter(
                Q(author=request.user)
                | Q(visibility=Post.VISIBILITY_PUBLIC)
                | Q(visibility=Post.VISIBILITY_CONDITIONAL)
            )
            queryset = queryset.filter(Q(allow_quote=True) | Q(author=request.user))
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(summary__icontains=query)
                | Q(content__icontains=query)
                | Q(author__username__icontains=query)
                | Q(author__first_name__icontains=query)
            )
        queryset = order_posts_by_user_stars(queryset, request.user, "-published_at", "-updated_at")
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        posts = prepare_post_cards(page_obj.object_list)

        items = []
        for post in posts:
            access_info = _compute_book_post_access(request, post)
            if not access_info["can_access"]:
                continue
            items.append({
                "id": post.pk,
                "title": post.title,
                "url": post.get_absolute_url(),
                "author": post.author.first_name or post.author.username,
                "accessDisplay": get_post_access_display(post),
                "visibility": post.visibility,
                "visibilityPresentation": get_post_access_icon_presentation(post),
                "showVipBadge": getattr(post, "show_vip_badge", False),
                "vipConditionSummaryItems": getattr(post, "vip_condition_summary_items", []),
                "vipVisibilityPresentation": getattr(post, "vip_visibility_presentation", None),
                "requiresPassword": access_info["requires_password"],
                "requiresCondition": access_info["requires_condition"],
                "conditionStatus": access_info["condition_status"],
                "conditionMoney": access_info["condition_money"],
                "conditionPoints": access_info["condition_points"],
                "html": render_to_string(
                    "blog/includes/post_card.html",
                    {
                        "post": post,
                        "card_class": "compact-card reference-post-card",
                        "summary_length": 110,
                        "show_visibility": True,
                        "show_tags": True,
                        "post_card_button": True,
                        "post_card_url": post.get_absolute_url(),
                        "show_tag_links": False,
                        "disable_encrypted_modal": True,
                    },
                    request=request,
                ),
            })

        return JsonResponse({
            "ok": True,
            "pagination": {
                "page": page_obj.number,
                "total_pages": paginator.num_pages,
                "has_previous": page_obj.has_previous(),
                "has_next": page_obj.has_next(),
                "previous_page": page_obj.previous_page_number() if page_obj.has_previous() else None,
                "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
            },
            "items": items,
        })


__all__ = [
    "ProfileBookAccessMixin",
    "ProfileBookCreateView",
    "ProfileBookDeleteView",
    "ProfileBookListView",
    "ProfileBookPostSearchView",
    "ProfileBookUpdateView",
    "ProfileBookWriteMixin",
]
