import secrets

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import DetailView

from apps.blog.models import Book, BookShareLink, Post
from apps.blog.utils import record_book_view
from apps.blog.utils.site import SHARE_LINK_EXPIRY_OPTIONS
from apps.blog.visibility import book_has_any_conditions, get_book_access_icon_presentation, get_book_visibility_presentation, post_is_book_only
from apps.blog.views.book.utils import (
    build_book_navigation_tree,
    dump_book_navigation_tree,
    get_book_structure_post_ids,
    get_first_visible_book_post,
    rewrite_book_content_internal_links,
)
from apps.blog.views.post.context import build_post_detail_context


class BookShareDetailView(DetailView):
    template_name = "blog/book_detail.html"
    context_object_name = "book"

    def get_object(self, queryset=None):
        share_link = get_object_or_404(BookShareLink.objects.select_related("book", "book__created_by"), token=self.kwargs["token"])
        if share_link.is_expired:
            raise Http404
        book = share_link.book
        if book.visibility != Book.VISIBILITY_PUBLIC or book_has_any_conditions(book):
            raise Http404
        self.share_link = share_link
        return book

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if not getattr(self, "_view_recorded", False):
            record_book_view(self.request, self.object)
            self.object.refresh_from_db(fields=["view_count"])
            self._view_recorded = True
        requested_slug = (self.request.GET.get("post") or "").strip()
        current_post = None
        structure_post_ids = get_book_structure_post_ids(self.object.structure)
        available_posts = Post.objects.filter(
            pk__in=structure_post_ids,
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
        ).select_related("author").prefetch_related("tags", "books")
        available_posts = [post for post in available_posts if not post_is_book_only(post)]
        if requested_slug:
            current_post = next((post for post in available_posts if post.slug == requested_slug), None)
            if current_post is None:
                raise Http404
        if current_post is None:
            current_post = get_first_visible_book_post(self.object, self.request, is_share_view=True)
        if current_post is None:
            raise Http404
        context.update(
            build_post_detail_context(
                current_post,
                self.request.user,
                is_share_view=True,
                request=self.request,
                book=self.object,
                share_link=self.share_link,
            )
        )
        context["rendered_content"] = rewrite_book_content_internal_links(
            context.get("rendered_content", ""),
            book=self.object,
            request=self.request,
            is_share_view=True,
            share_link=self.share_link,
        )
        context["post"] = current_post
        context["current_book"] = self.object
        context["is_book_view"] = True
        context["book_access_icon_presentation"] = get_book_access_icon_presentation(self.object)
        context["book_visibility_presentation"] = get_book_visibility_presentation(self.object)
        context["book_navigation"] = build_book_navigation_tree(
            self.object,
            self.request,
            current_post=current_post,
            is_share_view=True,
            base_url=self.share_link.get_absolute_url(),
        )
        context["book_navigation_json"] = dump_book_navigation_tree(context["book_navigation"])
        context["active_share_link"] = self.share_link
        context["show_related_posts"] = False
        context["detail_timestamp"] = current_post.published_at
        context["detail_timestamp_label"] = _("Published")
        return context


class BookShareLinkCreateView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        book = get_object_or_404(Book.objects.select_related("created_by"), slug=kwargs["slug"])
        if not (request.user.is_staff or request.user.is_superuser or book.created_by_id == request.user.pk):
            return JsonResponse({"ok": False, "message": str(_("You do not have permission to generate a share link."))}, status=403)
        if book.visibility != Book.VISIBILITY_PUBLIC or book_has_any_conditions(book):
            return JsonResponse({"ok": False, "message": str(_("Only public books can generate share links."))}, status=400)

        expiry_key = (request.POST.get("expiry") or "7d").strip()
        option = SHARE_LINK_EXPIRY_OPTIONS.get(expiry_key)
        if option is None:
            return JsonResponse({"ok": False, "message": str(_("Invalid expiry option."))}, status=400)

        expires_at = timezone.now() + option["delta"] if option["delta"] is not None else None
        with transaction.atomic():
            BookShareLink.objects.filter(book=book).delete()
            share_link = BookShareLink.objects.create(
                book=book,
                token=secrets.token_urlsafe(24),
                created_by=request.user,
                expires_at=expires_at,
            )
        absolute_url = request.build_absolute_uri(share_link.get_absolute_url())
        return JsonResponse(
            {
                "ok": True,
                "url": absolute_url,
                "expires_at": timezone.localtime(expires_at).isoformat() if expires_at is not None else None,
                "expires_label": str(option["label"]),
                "expires_display": timezone.localtime(expires_at).strftime("%Y-%m-%d %H:%M") if expires_at is not None else str(_("Never expires")),
            }
        )


__all__ = ["BookShareDetailView", "BookShareLinkCreateView"]
