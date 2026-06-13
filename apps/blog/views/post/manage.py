import os
from urllib.parse import parse_qs, urlencode, urlsplit

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.files.storage import default_storage
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Case, IntegerField, Q, Value, When
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.template.loader import render_to_string
from django.urls import Resolver404, resolve, reverse, reverse_lazy
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import CreateView, DetailView, TemplateView, UpdateView

from apps.blog.forms import PostDraftForm, PostForm, PostMarkdownImportForm
from apps.blog.models import AuditLog, Book, BookShareLink, Post, PostDraft, PostShareLink
from apps.blog.presentation import decorate_post_tags_for_display
from apps.blog.utils import get_or_create_site_setting, is_ajax_request, write_audit_log
from apps.blog.utils.markdown import render_markdown
from apps.blog.utils.site import SHARE_LINK_EXPIRY_OPTIONS
from apps.blog.visibility import (
    get_post_access_display,
    get_post_access_icon_presentation,
    get_post_condition_summary_items,
    get_post_vip_condition_summary_items,
    get_post_vip_visibility_presentation,
    get_post_visibility_presentation,
    post_has_vip_standalone,
)
from apps.blog.views.manage.base import ManageBaseMixin, get_manage_home_url
from apps.blog.views.book.utils import (
    can_access_book,
    can_display_post_in_book_navigation,
    get_book_structure_post_ids,
    get_detail_book_queryset,
    remove_post_from_book_structure,
)
from apps.blog.views.post.context import build_post_detail_context
from apps.blog.views.post.utils import (
    build_draft_preview_context,
    build_post_share_editor_context,
    can_access_post,
    clone_post_to_draft,
    create_markdown_import_draft,
    get_author_display_name_sort_expression,
    get_detail_post_queryset,
    get_reference_post_queryset,
    get_unique_post_slug,
    get_visible_post_queryset,
    prepare_post_cards,
    publish_post_draft,
    post_requires_password,
    with_post_feedback_counts,
)


class ManagePostReferenceSearchView(LoginRequiredMixin, View):
    http_method_names = ["get"]
    paginate_by = 12

    def get(self, request, *args, **kwargs):
        query = (request.GET.get("q") or "").strip()
        queryset = with_post_feedback_counts(get_reference_post_queryset(request.user))
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(summary__icontains=query)
                | Q(content__icontains=query)
                | Q(author__username__icontains=query)
                | Q(author__first_name__icontains=query)
            )
        paginator = Paginator(queryset.select_related("author").order_by("-published_at", "-updated_at"), self.paginate_by)
        page_number = (request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        posts = prepare_post_cards(page_obj.object_list)
        return JsonResponse(
            {
                "ok": True,
                "pagination": {
                    "page": page_obj.number,
                    "total_pages": paginator.num_pages,
                    "has_previous": page_obj.has_previous(),
                    "has_next": page_obj.has_next(),
                    "previous_page": page_obj.previous_page_number() if page_obj.has_previous() else None,
                    "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
                },
                "items": [
                    {
                        "id": post.pk,
                        "title": post.title,
                        "url": post.get_absolute_url(),
                        "author": post.author.first_name or post.author.username,
                        "accessDisplay": get_post_access_display(post),
                        "visibility": post.visibility,
                        "visibilityPresentation": get_post_access_icon_presentation(post),
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
                    }
                    for post in posts
                ],
            }
        )


class MarkdownPreviewView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        content = request.POST.get("content", "")
        return JsonResponse({"ok": True, "html": render_markdown(content)})


class PostLinkPreviewView(View):
    http_method_names = ["get"]

    def get_preview_post(self, request, match, requested_slug):
        if match.url_name == "blog-detail":
            post = get_object_or_404(get_detail_post_queryset(request.user), slug=match.kwargs.get("slug"))
            if not can_access_post(request, post):
                raise Http404()
            return post

        if match.url_name == "book-detail":
            if not requested_slug:
                raise Http404()
            book = get_object_or_404(get_detail_book_queryset(request.user), slug=match.kwargs.get("slug"))
            if not can_access_book(request, book):
                raise Http404()
            structure_post_ids = get_book_structure_post_ids(book.structure)
            post = get_object_or_404(Post.objects.filter(pk__in=structure_post_ids, status=Post.STATUS_PUBLISHED), slug=requested_slug)
            if not can_display_post_in_book_navigation(post, request.user, is_share_view=False):
                raise Http404()
            return post

        if match.url_name == "book-share-detail":
            if not requested_slug:
                raise Http404()
            share_link = get_object_or_404(BookShareLink.objects.select_related("book"), token=match.kwargs.get("token"))
            if share_link.is_expired:
                raise Http404()
            book = share_link.book
            if book.visibility != Book.VISIBILITY_PUBLIC:
                raise Http404()
            structure_post_ids = get_book_structure_post_ids(book.structure)
            post = get_object_or_404(Post.objects.filter(pk__in=structure_post_ids, status=Post.STATUS_PUBLISHED), slug=requested_slug)
            if not can_display_post_in_book_navigation(post, request.user, is_share_view=True):
                raise Http404()
            return post

        raise Http404()

    def get(self, request, *args, **kwargs):
        raw_path = (request.GET.get("path") or "").strip()
        parsed_path = urlsplit(raw_path) if raw_path else None
        normalized_path = parsed_path.path if parsed_path else ""
        requested_slug = ((parse_qs(parsed_path.query).get("post") or [""])[0] if parsed_path else "").strip()

        if not normalized_path.startswith("/"):
            raise Http404()

        try:
            match = resolve(normalized_path)
        except Resolver404 as exc:
            raise Http404() from exc

        post = self.get_preview_post(request, match, requested_slug)
        decorate_post_tags_for_display([post])

        return JsonResponse(
            {
                "ok": True,
                "title": post.title,
                "url": post.get_absolute_url(),
                "html": render_to_string(
                    "blog/includes/post_card.html",
                    {
                        "post": post,
                        "card_class": "compact-card reference-post-card post-card-tooltip-preview",
                        "summary_length": 110,
                        "post_requires_password": post_requires_password(request, post),
                    },
                    request=request,
                ),
            }
        )


class ManagePostListView(ManageBaseMixin, TemplateView):
    template_name = "blog/manage/post_list.html"
    paginate_by = 15
    default_sort = "updated_at"
    published_sortable_fields = {
        "title": ("title", "pk"),
        "visibility": ("visibility", "pk"),
        "author": ("author_display_name_sort", "pk"),
        "updated_at": ("updated_at", "pk"),
    }
    draft_sortable_fields = {
        "title": ("title", "pk"),
        "kind": ("draft_kind_rank", "pk"),
        "author": ("author_display_name_sort", "pk"),
        "updated_at": ("updated_at", "pk"),
    }
    share_link_sortable_fields = {
        "title": ("post__title", "pk"),
        "created_by": ("created_by_display_name_sort", "pk"),
        "expires_at": ("expires_at", "pk"),
        "updated_at": ("updated_at", "pk"),
    }

    def get_active_tab(self):
        tab = (self.request.GET.get("tab") or "published").strip().lower()
        if tab in {"published", "drafts", "external-links"}:
            return tab
        return "published"

    @property
    def sortable_fields(self):
        if self.get_active_tab() == "external-links":
            return self.share_link_sortable_fields
        if self.get_active_tab() == "drafts":
            return self.draft_sortable_fields
        return self.published_sortable_fields

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        active_tab = self.get_active_tab()
        if active_tab == "drafts":
            queryset = PostDraft.objects.select_related("author", "source_post").prefetch_related("tags", "books").annotate(
                author_display_name_sort=get_author_display_name_sort_expression(),
                draft_kind_rank=Case(
                    When(source_post__isnull=False, then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
            )
        elif active_tab == "external-links":
            queryset = PostShareLink.objects.select_related("post", "post__author", "created_by").annotate(
                created_by_display_name_sort=get_author_display_name_sort_expression(prefix="created_by__"),
            )
        else:
            queryset = Post.objects.select_related("author", "revision_draft").prefetch_related("tags", "books").annotate(
                author_display_name_sort=get_author_display_name_sort_expression()
            )
        if query:
            if active_tab == "external-links":
                queryset = queryset.filter(
                    Q(post__title__icontains=query)
                    | Q(post__slug__icontains=query)
                    | Q(created_by__username__icontains=query)
                    | Q(created_by__first_name__icontains=query)
                )
            else:
                queryset = queryset.filter(
                    Q(title__icontains=query)
                    | Q(summary__icontains=query)
                    | Q(content__icontains=query)
                    | Q(books__name__icontains=query)
                ).distinct()
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        active_tab = self.get_active_tab()
        context.update(self.get_manage_context(section="posts", query=query, active_tab=active_tab))
        context["site_setting"] = get_or_create_site_setting()
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
        if active_tab == "external-links":
            context["search_placeholder"] = _("Search external links...")
            context["search_label"] = _("Search external links")
        else:
            context["search_placeholder"] = _("Search articles...")
            context["search_label"] = _("Search articles")
        context["post_tabs"] = [
            {"key": "published", "label": _("Published articles"), "url": f"?{self.build_manage_query(tab='published', page=None)}"},
            {"key": "drafts", "label": "Drafts / Revisions", "url": f"?{self.build_manage_query(tab='drafts', page=None)}"},
            {"key": "external-links", "label": "External links", "url": f"?{self.build_manage_query(tab='external-links', page=None)}"},
        ]
        context["share_expiry_options"] = [{"value": key, "label": str(option["label"])} for key, option in SHARE_LINK_EXPIRY_OPTIONS.items()]
        return context


class ManagePostCreateView(ManageBaseMixin, CreateView):
    template_name = "blog/manage/post_form.html"
    form_class = PostDraftForm
    success_url = reverse_lazy("manage-posts")

    def form_valid(self, form):
        form.instance.author = self.request.user
        self.object = form.save()
        if (self.request.POST.get("status") or "").strip() == Post.STATUS_PUBLISHED:
            published_post = publish_post_draft(self.object)
            self.object = published_post
            write_audit_log(self.request, AuditLog.ACTION_POST_CREATE, str(_("Article created: %(title)s")) % {"title": published_post.title}, user=self.request.user)
            messages.success(self.request, _("Article published successfully."))
            return redirect(self.get_editor_return_url())

        write_audit_log(self.request, AuditLog.ACTION_POST_CREATE, str(_("Draft created: %(title)s")) % {"title": self.object.title}, user=self.request.user)
        messages.success(self.request, _("Draft saved successfully."))
        return redirect(self.get_editor_return_url(draft_tab=True))

    def get_success_url(self):
        return self.get_editor_return_url(draft_tab=True)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_manage_context(section="posts", page_title=_("Create article")))
        context["site_setting"] = get_or_create_site_setting()
        context["editor_mode"] = "draft"
        context["editor_object"] = self.object
        context["next_url"] = self.get_next_url()
        context.update(build_post_share_editor_context(context["editor_object"], self.request.user, self.request))
        return context


class ManagePostUpdateView(ManageBaseMixin, UpdateView):
    template_name = "blog/manage/post_form.html"
    form_class = PostForm
    queryset = Post.objects.prefetch_related("tags", "books")
    success_url = reverse_lazy("manage-posts")

    def get_object(self, queryset=None):
        post = super().get_object(queryset)
        self.revision_draft = getattr(post, "revision_draft", None)
        return post

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if (request.POST.get("status") or "").strip() == Post.STATUS_DRAFT:
            draft = self.revision_draft or clone_post_to_draft(self.object, request.user)
            saved_draft_form = PostDraftForm(request.POST, request.FILES, instance=draft)
            if not saved_draft_form.is_valid():
                return self.render_to_response(self.get_context_data(form=saved_draft_form))
            saved_draft_form.instance.author = request.user
            self.revision_draft = saved_draft_form.save()
            write_audit_log(request, AuditLog.ACTION_POST_UPDATE, str(_("Revision saved: %(title)s")) % {"title": draft.title}, user=request.user)
            messages.success(request, _("Revision saved successfully."))
            return redirect(self.get_editor_return_url(draft_tab=True))
        return super().post(request, *args, **kwargs)

    def form_valid(self, form):
        response = super().form_valid(form)
        if self.object.visibility != Post.VISIBILITY_PUBLIC or self.object.condition_rules:
            PostShareLink.objects.filter(post=self.object).delete()
        write_audit_log(self.request, AuditLog.ACTION_POST_UPDATE, str(_("Article updated: %(title)s")) % {"title": self.object.title}, user=self.request.user)
        messages.success(self.request, _("Article updated successfully."))
        return response

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_manage_context(section="posts", page_title=_("Edit article")))
        context["site_setting"] = get_or_create_site_setting()
        context["editor_mode"] = "published"
        context["editor_object"] = self.object
        context["revision_draft"] = self.revision_draft
        context["next_url"] = self.get_next_url()
        context.update(build_post_share_editor_context(self.object, self.request.user, self.request))
        return context

    def get_success_url(self):
        return self.get_editor_return_url()


class ManagePostDraftUpdateView(ManageBaseMixin, UpdateView):
    template_name = "blog/manage/post_form.html"
    form_class = PostDraftForm
    queryset = PostDraft.objects.select_related("source_post").prefetch_related("tags", "books")

    def form_valid(self, form):
        self.object = form.save()
        if (self.request.POST.get("status") or "").strip() == Post.STATUS_PUBLISHED:
            source_post_id = self.object.source_post_id
            published_post = publish_post_draft(self.object)
            if published_post.visibility != Post.VISIBILITY_PUBLIC or published_post.condition_rules:
                PostShareLink.objects.filter(post=published_post).delete()
            action = AuditLog.ACTION_POST_UPDATE if source_post_id else AuditLog.ACTION_POST_CREATE
            write_audit_log(self.request, action, str(_("Article published: %(title)s")) % {"title": published_post.title}, user=self.request.user)
            messages.success(self.request, _("Article published successfully."))
            return redirect(self.get_editor_return_url())

        is_revision = bool(self.object.source_post_id)
        message = _("Revision saved successfully.") if is_revision else _("Draft saved successfully.")
        audit_message = _("Revision saved: %(title)s") if is_revision else _("Draft saved: %(title)s")
        write_audit_log(self.request, AuditLog.ACTION_POST_UPDATE, str(audit_message) % {"title": self.object.title}, user=self.request.user)
        messages.success(self.request, message)
        return redirect(self.get_editor_return_url(draft_tab=True))

    def get_success_url(self):
        return self.get_editor_return_url(draft_tab=True)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        title = _("Edit revision") if self.object.source_post_id else _("Edit draft")
        context.update(self.get_manage_context(section="posts", page_title=title))
        context["site_setting"] = get_or_create_site_setting()
        context["editor_mode"] = "draft"
        context["editor_object"] = self.object
        context["revision_draft"] = self.object if self.object.source_post_id else None
        context["next_url"] = self.get_next_url()
        context.update(build_post_share_editor_context(self.object, self.request.user, self.request))
        return context


class ManagePostImportView(ManageBaseMixin, TemplateView):
    template_name = "blog/manage/post_import.html"
    paginate_by = 12

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = with_post_feedback_counts(get_visible_post_queryset(self.request.user).filter(status=Post.STATUS_PUBLISHED).select_related("author").prefetch_related("tags", "books"))
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(summary__icontains=query)
                | Q(content__icontains=query)
                | Q(author__username__icontains=query)
                | Q(author__first_name__icontains=query)
            )
        return queryset.order_by("-published_at", "-updated_at")

    def post(self, request, *args, **kwargs):
        source_post = get_object_or_404(get_visible_post_queryset(request.user).filter(status=Post.STATUS_PUBLISHED), pk=request.POST.get("source_post_id"))
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
        edit_url = reverse("manage-post-draft-update", args=[draft.pk])
        next_url = self.get_next_url()
        if next_url:
            return redirect(f"{edit_url}?{urlencode({'next': next_url})}")
        return redirect(edit_url)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        paginator = Paginator(self.get_queryset(), self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        context.update(self.get_manage_context(section="posts", page_title=_("Import from existing article"), query=query))
        context["posts"] = prepare_post_cards(page_obj.object_list)
        context["page_obj"] = page_obj
        context["is_paginated"] = paginator.num_pages > 1
        context["paginator"] = paginator
        context["pagination_query"] = urlencode({"q": query}) if query else ""
        context["query"] = query
        context["next_url"] = self.get_next_url()
        context["back_url"] = context["next_url"] or self.request.META.get("HTTP_REFERER") or context["manage_nav"][0]["url"]
        return context


class ManagePostMarkdownImportView(ManageBaseMixin, TemplateView):
    def get_error_message(self, form):
        if form.non_field_errors():
            return str(form.non_field_errors()[0])
        if form.errors.get("markdown_file"):
            return str(form.errors["markdown_file"][0])
        return str(_("Unable to import the selected markdown file."))

    def get_list_redirect_url(self):
        list_url = reverse("manage-posts")
        next_url = self.get_next_url()
        if next_url:
            return f"{list_url}?{urlencode({'next': next_url})}"
        return list_url

    def get_form(self):
        if self.request.method == "POST":
            return PostMarkdownImportForm(self.request.POST, self.request.FILES)
        return PostMarkdownImportForm()

    def get(self, request, *args, **kwargs):
        return redirect(self.get_list_redirect_url())

    def post(self, request, *args, **kwargs):
        form = self.get_form()
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
        edit_url = reverse("manage-post-draft-update", args=[draft.pk])
        next_url = self.get_next_url()
        if next_url:
            edit_url = f"{edit_url}?{urlencode({'next': next_url})}"
        if is_ajax_request(request):
            return JsonResponse({"ok": True, "redirect_url": edit_url, "message": success_message})
        return redirect(edit_url)


class ManagePostDraftPreviewView(ManageBaseMixin, DetailView):
    template_name = "blog/detail.html"
    context_object_name = "post"
    queryset = PostDraft.objects.select_related("author", "source_post").prefetch_related("tags", "books")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(build_draft_preview_context(self.object))
        return context


class ManagePostRevisionStartView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        post = get_object_or_404(Post.objects.select_related("revision_draft"), pk=kwargs["pk"])
        action = (request.POST.get("action") or request.GET.get("action") or "open").strip().lower()
        revision_draft = getattr(post, "revision_draft", None)

        if action == "reset" and revision_draft is not None:
            revision_draft.delete()
            revision_draft = None

        if revision_draft is None:
            revision_draft = clone_post_to_draft(post, request.user)

        return redirect("manage-post-draft-update", pk=revision_draft.pk)


class ManagePostDraftDeleteView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        draft = get_object_or_404(PostDraft, pk=kwargs["pk"])
        title = draft.title
        draft.delete()
        write_audit_log(request, AuditLog.ACTION_POST_DELETE, str(_("Draft deleted: %(title)s")) % {"title": title}, user=request.user)
        messages.success(request, _("Draft deleted successfully."))
        return redirect(get_manage_home_url(tab="drafts"))


class ManagePostDraftCoverDeleteView(ManageBaseMixin, View):
    def post(self, request, *args, **kwargs):
        draft = get_object_or_404(PostDraft, pk=kwargs["pk"])
        if draft.cover_image:
            draft.cover_image = ""
            draft.save(update_fields=["cover_image", "updated_at"])
            write_audit_log(
                request,
                AuditLog.ACTION_POST_UPDATE,
                str(_("Cover image removed: %(title)s")) % {"title": draft.title},
                user=request.user,
            )
        messages.success(request, _("Cover image removed successfully."))
        return redirect("manage-post-draft-update", pk=draft.pk)


class ManagePostCoverDeleteView(ManageBaseMixin, View):
    def post(self, request, *args, **kwargs):
        post = get_object_or_404(Post, pk=kwargs["pk"])
        if post.cover_image:
            post.cover_image = ""
            post.save(update_fields=["cover_image", "updated_at"])
            write_audit_log(
                request,
                AuditLog.ACTION_POST_UPDATE,
                str(_("Cover image removed: %(title)s")) % {"title": post.title},
                user=request.user,
            )
        messages.success(request, _("Cover image removed successfully."))
        return redirect("manage-post-update", pk=post.pk)


class ManagePostDeleteView(ManageBaseMixin, View):
    def post(self, request, *args, **kwargs):
        post = get_object_or_404(Post, pk=kwargs["pk"])
        title = post.title
        related_books = list(post.books.all())
        for book in related_books:
            pruned_structure, structure_changed = remove_post_from_book_structure(book.structure, post.pk)
            if structure_changed:
                book.structure = pruned_structure
                book.save(update_fields=["structure", "updated_at"])
        post.delete()
        write_audit_log(request, AuditLog.ACTION_POST_DELETE, str(_("Article deleted: %(title)s")) % {"title": title}, user=request.user)
        messages.success(request, _("Article deleted successfully."))
        return redirect(get_manage_home_url())


class ImageUploadView(ManageBaseMixin, View):
    def post(self, request, *args, **kwargs):
        image = request.FILES.get("image")
        if image is None:
            return JsonResponse({"success": 0, "message": str(_("No image uploaded."))}, status=400)

        image_name = default_storage.save(os.path.join("blog", "uploads", image.name), image)
        image_url = default_storage.url(image_name)
        return JsonResponse({"success": 1, "file": {"url": image_url}})


__all__ = [name for name in globals() if name.startswith("Manage") or name in {"MarkdownPreviewView", "PostLinkPreviewView", "ImageUploadView"}]
