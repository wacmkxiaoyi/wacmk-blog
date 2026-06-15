from urllib.parse import urlencode

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.db.models import Count, Q
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import DetailView, ListView

from apps.blog.access import build_access_check
from apps.blog.forms.comment import CommentForm
from apps.blog.models import Book, BookStar, Post
from apps.blog.services.author_rewards import grant_author_reward_once
from apps.blog.utils import get_safe_next_url, record_book_view
from apps.blog.utils.site import SHARE_LINK_EXPIRY_OPTIONS
from apps.blog.visibility import (
    book_has_vip_standalone,
    get_book_access_icon_presentation,
    get_book_condition_summary_items,
    get_book_vip_condition_summary_items,
    get_book_vip_visibility_presentation,
    get_book_visibility_presentation,
)
from apps.blog.views.book.utils import (
    build_book_navigation_tree,
    build_book_share_editor_context,
    can_display_post_in_book_navigation,
    dump_book_navigation_tree,
    get_book_structure_post_ids,
    get_detail_book_queryset,
    get_first_visible_book_post,
    get_visible_book_queryset,
    order_books_by_user_stars,
    rewrite_book_content_internal_links,
)
from apps.blog.views.post.context import build_post_detail_context


class BookListView(LoginRequiredMixin, ListView):
    template_name = "blog/book_list.html"
    context_object_name = "books"
    paginate_by = 12

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = get_visible_book_queryset(self.request.user)
        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(summary__icontains=query))
        queryset = queryset.annotate(post_count=Count("posts", distinct=True))
        books = list(order_books_by_user_stars(queryset, self.request.user, "name", "pk"))
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
        query = (self.request.GET.get("q") or "").strip()
        context["query"] = query
        context["pagination_query"] = urlencode({"q": query}) if query else ""
        return context


class BookDetailView(LoginRequiredMixin, DetailView):
    template_name = "blog/book_detail.html"
    context_object_name = "book"

    def get_queryset(self):
        return get_detail_book_queryset(self.request.user)

    def dispatch(self, request, *args, **kwargs):
        self.object = self.get_object()
        access_check = build_access_check(self.object, request.user)

        if access_check["all_granted"]:
            grant_author_reward_once(self.object, request.user)
            return super().dispatch(request, *args, **kwargs)

        self._access_check = access_check
        self.template_name = "blog/access_gate.html"
        return self.render_to_response(self.get_context_data(is_access_gate=True))

    def get_current_post(self):
        if hasattr(self, "_current_post"):
            return self._current_post
        requested_slug = (self.request.GET.get("post") or "").strip()
        navigation_posts = get_book_structure_post_ids(self.object.structure)
        queryset = Post.objects.filter(pk__in=navigation_posts, status=Post.STATUS_PUBLISHED).select_related("author").prefetch_related("tags", "books")
        post = None
        if requested_slug:
            post = queryset.filter(slug=requested_slug).first()
            if post is None:
                raise Http404
            if not can_display_post_in_book_navigation(post, self.request.user, is_share_view=False):
                raise Http404
        if post is None:
            post = get_first_visible_book_post(self.object, self.request, is_share_view=False)
        self._current_post = post
        return post

    def get_context_data(self, **kwargs):
        if kwargs.get("is_access_gate"):
            return {
                "is_access_gate": True,
                "access_object": self.object,
                "current_book": self.object,
                "object_name": self.object.name,
                "access_check": self._access_check,
                "object_type": "book",
                "check_url": reverse("access-check", kwargs={"object_type": "book", "object_id": self.object.pk}),
            }

        requires_password = kwargs.get("requires_password", False)
        requires_condition = kwargs.get("requires_condition", False)
        post = None if requires_password or requires_condition else self.get_current_post()
        context = super().get_context_data(**kwargs)
        if not requires_password and not requires_condition and not getattr(self, "_view_recorded", False):
            record_book_view(self.request, self.object)
            self.object.refresh_from_db(fields=["view_count"])
            self._view_recorded = True
        if post is not None:
            post_access_check = build_access_check(post, self.request.user, in_book_context=True)
            if post_access_check["all_granted"]:
                context.update(
                    build_post_detail_context(
                        post,
                        self.request.user,
                        comment_form=kwargs.get("comment_form") or CommentForm(user=self.request.user),
                        reply_parent_id=kwargs.get("reply_parent_id"),
                        reply_form=kwargs.get("reply_form"),
                        edit_comment_id=kwargs.get("edit_comment_id"),
                        edit_form=kwargs.get("edit_form"),
                        request=self.request,
                        book=self.object,
                    )
                )
                context["rendered_content"] = rewrite_book_content_internal_links(
                    context.get("rendered_content", ""),
                    book=self.object,
                    request=self.request,
                    is_share_view=False,
                )
            context["post"] = post
            context["post_access_check"] = post_access_check
            if not post_access_check["all_granted"]:
                context["post_gate_check_url"] = reverse("access-check", kwargs={"object_type": "post", "object_id": post.pk})
            context["detail_timestamp"] = post.published_at
            context["detail_timestamp_label"] = _("Published")
            context["book_navigation"] = build_book_navigation_tree(
                self.object,
                self.request,
                current_post=post,
                is_share_view=False,
                base_url=self.object.get_absolute_url(),
            )
            context["book_navigation_json"] = dump_book_navigation_tree(context["book_navigation"])
            context["book_post_url_template"] = self.object.get_absolute_url()
            context["requires_post_password"] = False
            context["requires_post_condition"] = False
        else:
            context.setdefault("book_navigation", [])
            context.setdefault("book_navigation_json", "[]")
            context.setdefault("post", None)
            context.setdefault("requires_post_password", False)
            context.setdefault("requires_post_condition", False)
            context.setdefault("comment_form", None)
            context.setdefault("comments", [])
            context.setdefault("comment_count", 0)
            context.setdefault("reply_parent_id", "")
            context.setdefault("can_interact", False)
            context.setdefault("show_related_posts", False)
            context.setdefault("empty_book_message", _("No accessible articles in this book yet."))
        context["current_book"] = self.object
        context["is_book_view"] = True
        context["requires_password"] = requires_password
        context["requires_condition"] = requires_condition
        context["book_condition_summary_items"] = get_book_condition_summary_items(self.object)
        context["book_access_icon_presentation"] = get_book_access_icon_presentation(self.object)
        context["book_visibility_presentation"] = get_book_visibility_presentation(self.object)
        context["show_book_vip_badge"] = book_has_vip_standalone(self.object)
        if context["show_book_vip_badge"]:
            context["book_vip_condition_summary_items"] = get_book_vip_condition_summary_items(self.object)
            context["book_vip_visibility_presentation"] = get_book_vip_visibility_presentation(self.object)
        context["can_generate_share_link"] = bool(
            self.request.user.is_authenticated
            and self.object.visibility == Book.VISIBILITY_PUBLIC
            and (self.request.user.is_staff or self.request.user.is_superuser or self.object.created_by_id == self.request.user.pk)
        )
        if context["can_generate_share_link"]:
            context["active_share_link"] = self.object.share_links.order_by("-created_at", "-pk").first()
        else:
            context["active_share_link"] = None
        context["share_expiry_options"] = [{"value": key, "label": str(option["label"])} for key, option in SHARE_LINK_EXPIRY_OPTIONS.items()]
        context.update(build_book_share_editor_context(self.object, self.request))
        return context


class BookStarToggleView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        book = get_object_or_404(get_detail_book_queryset(request.user), slug=kwargs["slug"])
        if not build_access_check(book, request.user)["all_granted"]:
            raise Http404

        with transaction.atomic():
            existing_star = BookStar.objects.select_for_update().filter(book=book, user=request.user).first()
            if existing_star is not None:
                existing_star.delete()
                starred = False
            else:
                BookStar.objects.create(book=book, user=request.user)
                starred = True

        return JsonResponse({"ok": True, "starred": starred, "book_id": book.pk})


__all__ = ["BookDetailView", "BookListView", "BookStarToggleView"]
