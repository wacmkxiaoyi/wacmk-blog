from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Case, IntegerField, Q, Value, When
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import CreateView, TemplateView, UpdateView

from apps.blog.forms.post import PostDraftForm, PostMarkdownImportForm
from apps.blog.models import AuditLog, Post, PostDraft
from apps.blog.utils import build_user_business_identity_summary, get_or_create_site_setting, is_ajax_request, write_audit_log
from apps.blog.views.post.utils import (
    can_access_post,
    create_markdown_import_draft,
    get_post_condition_access_state,
    get_unique_post_slug,
    get_visible_post_queryset,
    order_posts_by_user_stars,
    post_requires_condition,
    post_requires_password,
    prepare_post_cards,
    with_post_feedback_counts,
)
from apps.blog.visibility import (
    get_post_condition_summary_items,
    get_post_vip_condition_summary_items,
    get_post_vip_visibility_presentation,
    get_post_visibility_presentation,
    post_has_vip_standalone,
)
from apps.blog.views.profile import build_profile_nav


class ProfilePostAccessMixin(LoginRequiredMixin):
    def get_profile_context(self, **kwargs):
        site_setting = get_or_create_site_setting()
        context = kwargs
        context["site_setting"] = site_setting
        context["profile_nav"] = build_profile_nav()
        context["current_section"] = context.get("current_section") or "articles"
        return context


class ProfilePostWriteMixin(ProfilePostAccessMixin):
    enforce_post_limit = True

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_staff or request.user.is_superuser:
            return super().dispatch(request, *args, **kwargs)
        site_setting = get_or_create_site_setting()
        if not site_setting.allow_non_admin_create_post:
            raise PermissionDenied()
        if site_setting.vip_only_create_post:
            identity = build_user_business_identity_summary(request.user, site_setting)
            if not identity["is_vip"]:
                raise PermissionDenied()
        if self.enforce_post_limit and site_setting.non_admin_max_post_count > 0:
            post_count = Post.objects.filter(author=request.user).count()
            pure_draft_count = PostDraft.objects.filter(author=request.user, source_post__isnull=True).count()
            if post_count + pure_draft_count >= site_setting.non_admin_max_post_count:
                raise PermissionDenied()
        return super().dispatch(request, *args, **kwargs)


class ProfilePostListView(ProfilePostAccessMixin, TemplateView):
    template_name = "blog/profile_posts.html"
    paginate_by = 15
    default_sort = "updated_at"
    published_sortable_fields = {
        "title": ("title", "pk"),
        "visibility": ("visibility", "pk"),
        "updated_at": ("updated_at", "pk"),
    }
    draft_sortable_fields = {
        "title": ("title", "pk"),
        "kind": ("draft_kind_rank", "pk"),
        "updated_at": ("updated_at", "pk"),
    }

    def get_active_tab(self):
        tab = (self.request.GET.get("tab") or "published").strip().lower()
        if tab in {"published", "drafts"}:
            return tab
        return "published"

    @property
    def sortable_fields(self):
        if self.get_active_tab() == "drafts":
            return self.draft_sortable_fields
        return self.published_sortable_fields

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
        active_tab = self.get_active_tab()
        if active_tab == "drafts":
            queryset = PostDraft.objects.select_related("source_post").prefetch_related("tags", "books").filter(
                author=self.request.user
            ).annotate(
                draft_kind_rank=Case(
                    When(source_post__isnull=False, then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
            )
        else:
            queryset = Post.objects.select_related("author", "revision_draft").prefetch_related("tags", "books").filter(
                author=self.request.user
            )
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(summary__icontains=query)
                | Q(content__icontains=query)
                | Q(books__name__icontains=query)
            ).distinct()
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context())
        can_create = False
        site_setting = context.get("site_setting") or get_or_create_site_setting()
        if self.request.user.is_staff or self.request.user.is_superuser:
            can_create = True
        elif site_setting.allow_non_admin_create_post:
            if site_setting.vip_only_create_post:
                identity = build_user_business_identity_summary(self.request.user, site_setting)
                if identity["is_vip"]:
                    can_create = True
            else:
                can_create = True
            if can_create and site_setting.non_admin_max_post_count > 0:
                post_count = Post.objects.filter(author=self.request.user).count()
                pure_draft_count = PostDraft.objects.filter(author=self.request.user, source_post__isnull=True).count()
                can_create = (post_count + pure_draft_count) < site_setting.non_admin_max_post_count
        context["can_create_post"] = can_create
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        query = (self.request.GET.get("q") or "").strip()
        active_tab = self.get_active_tab()
        context["items"] = page_obj.object_list
        if active_tab == "published":
            for item in context["items"]:
                item.condition_summary_items = get_post_condition_summary_items(item)
                item.visibility_presentation = get_post_visibility_presentation(item)
                item.show_vip_badge = post_has_vip_standalone(item)
                if item.show_vip_badge:
                    item.vip_condition_summary_items = get_post_vip_condition_summary_items(item)
                    item.vip_visibility_presentation = get_post_vip_visibility_presentation(item)
        context["page_obj"] = page_obj
        context["paginator"] = paginator
        context["is_paginated"] = paginator.num_pages > 1
        context["active_tab"] = active_tab
        context["search_placeholder"] = _("Search articles...")
        context["search_label"] = _("Search articles")
        context["post_tabs"] = [
            {"key": "published", "label": _("Published articles"), "url": f"?{self.build_query(tab='published', page=None)}"},
            {"key": "drafts", "label": "Drafts / Revisions", "url": f"?{self.build_query(tab='drafts', page=None)}"},
        ]
        context["current_sort"] = self.get_current_sort() or ""
        context["current_sort_direction"] = self.get_current_sort_direction() if self.get_current_sort() else ""
        context["sort_headers"] = self.get_sort_headers()
        context["pagination_query"] = self.build_query()
        context["query"] = query
        return context


class ProfilePostCreateView(ProfilePostWriteMixin, CreateView):
    template_name = "blog/manage/post_form.html"
    form_class = PostDraftForm

    def form_valid(self, form):
        form.instance.author = self.request.user
        self.object = form.save()
        write_audit_log(self.request, AuditLog.ACTION_POST_CREATE, str(_("Draft created: %(title)s")) % {"title": self.object.title}, user=self.request.user)
        messages.success(self.request, _("Draft saved successfully."))
        return redirect(self.get_success_url())

    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        if next_url:
            return next_url
        return reverse("profile-posts") + "?tab=drafts"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context())
        context["site_setting"] = get_or_create_site_setting()
        context["editor_mode"] = "draft"
        context["editor_object"] = self.object
        context["hide_publish"] = True
        context["is_profile_post_view"] = True
        context["next_url"] = (self.request.GET.get("next") or "").strip()
        return context


class ProfilePostDraftUpdateView(ProfilePostWriteMixin, UpdateView):
    enforce_post_limit = False
    template_name = "blog/manage/post_form.html"
    form_class = PostDraftForm
    queryset = PostDraft.objects.select_related("source_post").prefetch_related("tags", "books")

    def get_queryset(self):
        return super().get_queryset().filter(author=self.request.user)

    def form_valid(self, form):
        self.object = form.save()
        write_audit_log(self.request, AuditLog.ACTION_POST_UPDATE, str(_("Draft saved: %(title)s")) % {"title": self.object.title}, user=self.request.user)
        messages.success(self.request, _("Draft saved successfully."))
        return redirect(self.get_success_url())

    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        if next_url:
            return next_url
        return reverse("profile-posts") + "?tab=drafts"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context())
        context["site_setting"] = get_or_create_site_setting()
        context["editor_mode"] = "draft"
        context["editor_object"] = self.object
        context["hide_publish"] = True
        context["is_profile_post_view"] = True
        context["page_title"] = _("Edit draft")
        context["next_url"] = (self.request.GET.get("next") or "").strip()
        return context


class ProfilePostDraftDeleteView(ProfilePostWriteMixin, View):
    enforce_post_limit = False
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        draft = get_object_or_404(PostDraft.objects.filter(author=request.user), pk=kwargs["pk"])
        title = draft.title
        draft.delete()
        write_audit_log(request, AuditLog.ACTION_POST_DELETE, str(_("Draft deleted: %(title)s")) % {"title": title}, user=request.user)
        messages.success(request, _("Draft deleted successfully."))
        return redirect(reverse("profile-posts") + "?tab=drafts")


class ProfilePostImportView(ProfilePostWriteMixin, TemplateView):
    template_name = "blog/profile_post_import.html"
    paginate_by = 12

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        user = self.request.user
        queryset = with_post_feedback_counts(
            get_visible_post_queryset(user).filter(status=Post.STATUS_PUBLISHED)
        )
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(Q(allow_reprint=True) | Q(author=user))
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(summary__icontains=query)
                | Q(content__icontains=query)
                | Q(author__username__icontains=query)
                | Q(author__first_name__icontains=query)
            )
        return order_posts_by_user_stars(queryset, user, "-published_at", "-updated_at")

    def post(self, request, *args, **kwargs):
        source_post = get_object_or_404(Post.objects.filter(status=Post.STATUS_PUBLISHED), pk=request.POST.get("source_post_id"))
        if not can_access_post(request, source_post):
            if is_ajax_request(request):
                return JsonResponse({
                    "ok": False,
                    "status": "access_denied",
                    "requires_password": post_requires_password(request, source_post),
                    "requires_condition": post_requires_condition(request, source_post),
                    "post_id": source_post.pk,
                }, status=403)
            messages.error(request, _("You do not have permission to import this article."))
            return redirect(request.path)

        imported_title = f"{source_post.title} (Copy)"
        draft = PostDraft.objects.create(
            source_post=None,
            title=imported_title,
            slug=get_unique_post_slug(slugify(imported_title)),
            summary=source_post.summary,
            content=source_post.content,
            visibility=source_post.visibility,
            condition_rules=source_post.condition_rules,
            author=request.user,
        )
        if source_post.cover_image:
            draft.cover_image = source_post.cover_image.name
            draft.save(update_fields=["cover_image", "updated_at"])
        draft.tags.set(source_post.tags.all())
        write_audit_log(request, AuditLog.ACTION_POST_CREATE, str(_("Draft imported from article: %(title)s")) % {"title": source_post.title}, user=request.user)
        messages.success(request, _("Article imported as draft successfully."))
        edit_url = reverse("profile-draft-update", args=[draft.pk])
        if is_ajax_request(request):
            return JsonResponse({"ok": True, "redirect_url": edit_url})
        return redirect(edit_url)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context())
        query = (self.request.GET.get("q") or "").strip()
        paginator = Paginator(self.get_queryset(), self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        posts = prepare_post_cards(page_obj.object_list)
        for post in posts:
            post.import_requires_password = post_requires_password(self.request, post)
            post.import_requires_condition = post_requires_condition(self.request, post)
            post.import_can_access = can_access_post(self.request, post)
            post.import_condition_status = ""
            post.import_condition_money = ""
            post.import_condition_points = ""
            if not post.import_can_access:
                ca = get_post_condition_access_state(self.request, post)
                post.import_condition_status = ca.get("status", "")
                post.import_condition_money = ca.get("money_required") or ""
                post.import_condition_points = ca.get("points_required") or ""
        context["posts"] = posts
        context["page_obj"] = page_obj
        context["is_paginated"] = paginator.num_pages > 1
        context["paginator"] = paginator
        context["query"] = query
        context["profile_mode"] = True
        return context


class ProfilePostMarkdownImportView(ProfilePostWriteMixin, TemplateView):
    def get_error_message(self, form):
        if form.non_field_errors():
            return str(form.non_field_errors()[0])
        if form.errors.get("markdown_file"):
            return str(form.errors["markdown_file"][0])
        return str(_("Unable to import the selected markdown file."))

    def get_list_redirect_url(self):
        list_url = reverse("profile-posts")
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        if next_url:
            return next_url
        return list_url

    def get(self, request, *args, **kwargs):
        return redirect(self.get_list_redirect_url())

    def post(self, request, *args, **kwargs):
        form = PostMarkdownImportForm(request.POST, request.FILES)
        if not form.is_valid():
            error_message = self.get_error_message(form)
            if is_ajax_request(request):
                return JsonResponse({"ok": False, "message": error_message}, status=400)
            messages.error(request, error_message)
            return redirect(self.get_list_redirect_url())

        draft = create_markdown_import_draft(
            form.cleaned_data["markdown_text"],
            form.cleaned_data["markdown_file"].name,
            request.user,
        )
        write_audit_log(request, AuditLog.ACTION_POST_CREATE, str(_("Draft imported from markdown file: %(title)s")) % {"title": draft.title}, user=request.user)
        success_message = str(_("Article imported from .md successfully."))
        messages.success(request, success_message)
        edit_url = reverse("profile-draft-update", args=[draft.pk])
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        if next_url:
            edit_url = f"{edit_url}?next={next_url}"
        if is_ajax_request(request):
            return JsonResponse({"ok": True, "redirect_url": edit_url, "message": success_message})
        return redirect(edit_url)


__all__ = [
    "ProfilePostAccessMixin",
    "ProfilePostCreateView",
    "ProfilePostDraftDeleteView",
    "ProfilePostDraftUpdateView",
    "ProfilePostImportView",
    "ProfilePostListView",
    "ProfilePostMarkdownImportView",
    "ProfilePostWriteMixin",
]
