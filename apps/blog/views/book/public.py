from urllib.parse import urlencode

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Count, Q
from django.http import Http404, JsonResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import DetailView, ListView

from apps.blog.access import ACCESS_STATUS_GRANTED, ACCESS_STATUS_INSUFFICIENT_MONEY, ACCESS_STATUS_INSUFFICIENT_POINTS, ACCESS_STATUS_PURCHASE_REQUIRED, purchase_book_access
from apps.blog.forms import CommentForm
from apps.blog.models import Book, Post
from apps.blog.permissions import check_condition_password
from apps.blog.utils import get_safe_next_url, is_ajax_request, record_book_view
from apps.blog.utils.site import SHARE_LINK_EXPIRY_OPTIONS
from apps.blog.visibility import book_has_encrypted_access, book_has_value_conditions, get_book_access_icon_presentation, get_book_condition_summary_items, get_book_visibility_presentation
from apps.blog.views.book.utils import (
    BookAccessForm,
    build_book_navigation_tree,
    book_requires_password,
    build_book_share_editor_context,
    can_access_book,
    can_bypass_book_password,
    can_display_post_in_book_navigation,
    dump_book_navigation_tree,
    get_book_condition_access_state,
    get_book_structure_post_ids,
    get_detail_book_queryset,
    get_first_visible_book_post,
    get_visible_book_queryset,
    mark_book_unlocked,
    rewrite_book_content_internal_links,
)
from apps.blog.views.post.context import build_post_detail_context
from apps.blog.views.post.utils import get_post_condition_access_state, post_requires_condition, post_requires_password


class BookListView(LoginRequiredMixin, ListView):
    template_name = "blog/book_list.html"
    context_object_name = "books"
    paginate_by = 12

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = get_visible_book_queryset(self.request.user)
        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(summary__icontains=query))
        books = list(queryset.annotate(post_count=Count("posts", distinct=True)).order_by("name"))
        for book in books:
            book.condition_summary_items = get_book_condition_summary_items(book)
            book.visibility_presentation = get_book_visibility_presentation(book)
            book.has_encrypted_access = book_has_encrypted_access(book)
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
        if request.method.lower() == "post" and book_has_encrypted_access(self.object):
            return super().dispatch(request, *args, **kwargs)
        if request.method.lower() == "post" and book_has_value_conditions(self.object):
            return super().dispatch(request, *args, **kwargs)
        if can_access_book(request, self.object):
            return super().dispatch(request, *args, **kwargs)
        if book_requires_password(request, self.object):
            self.access_form = BookAccessForm()
            return self.render_to_response(self.get_context_data(access_form=self.access_form, requires_password=True))
        if book_has_value_conditions(self.object):
            return self.render_to_response(self.get_context_data(requires_condition=True))
        raise Http404

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
        requires_password = kwargs.get("requires_password", False)
        requires_condition = kwargs.get("requires_condition", False)
        post = None if requires_password or requires_condition else self.get_current_post()
        context = super().get_context_data(**kwargs)
        if not requires_password and not getattr(self, "_view_recorded", False):
            record_book_view(self.request, self.object)
            self.object.refresh_from_db(fields=["view_count"])
            self._view_recorded = True
        active_gate = "password" if requires_password else ("condition" if requires_condition else "")
        if post is not None:
            requires_post_password = post_requires_password(self.request, post)
            requires_post_condition = False
            if not requires_post_password:
                requires_post_condition = post_requires_condition(self.request, post)
            if not requires_post_password and not requires_post_condition:
                context.update(
                    build_post_detail_context(
                        post,
                        self.request.user,
                        comment_form=kwargs.get("comment_form") or CommentForm(),
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
            context["requires_post_password"] = requires_post_password and not active_gate
            context["requires_post_condition"] = requires_post_condition and not active_gate and not requires_post_password
            if context["requires_post_password"]:
                current_book_url = f"{self.object.get_absolute_url()}?{urlencode({'post': post.slug})}"
                context["comment_form"] = None
                context["comments"] = []
                context["comment_count"] = 0
                context["reply_parent_id"] = ""
                context["can_interact"] = False
                context["show_related_posts"] = False
                context["active_share_link"] = None
                context["password_submit_url"] = f"{post.get_absolute_url()}?{urlencode({'next': current_book_url})}"
                context["password_modal_title"] = _("Enter password to view this article")
                context["password_modal_kicker"] = _("Encrypted")
                context["password_modal_confirm"] = _("Unlock article")
                context["password_modal_cancel"] = _("Cancel")
            if context["requires_post_condition"]:
                current_book_url = f"{self.object.get_absolute_url()}?{urlencode({'post': post.slug})}"
                post_condition_access = get_post_condition_access_state(self.request, post)
                context["comment_form"] = None
                context["comments"] = []
                context["comment_count"] = 0
                context["reply_parent_id"] = ""
                context["can_interact"] = False
                context["show_related_posts"] = False
                context["active_share_link"] = None
                context["condition_access"] = post_condition_access
                context["condition_modal_title"] = _("Content access check")
                context["condition_modal_kicker"] = _("Conditional")
                context["condition_modal_confirm"] = _("Purchase now")
                context["condition_modal_cancel"] = _("Cancel")
                context["condition_modal_insufficient_money"] = _("Insufficient balance")
                context["condition_modal_insufficient_points"] = _("Insufficient points")
                context["condition_return_url"] = current_book_url
                context["condition_submit_url"] = f"{post.get_absolute_url()}?{urlencode({'next': current_book_url})}"
        else:
            context.setdefault("book_navigation", [])
            context.setdefault("book_navigation_json", "[]")
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
        context["access_form"] = kwargs.get("access_form") or BookAccessForm()
        context.setdefault("condition_access", get_book_condition_access_state(self.request, self.object))
        context["book_condition_summary_items"] = get_book_condition_summary_items(self.object)
        context["book_access_icon_presentation"] = get_book_access_icon_presentation(self.object)
        context["book_visibility_presentation"] = get_book_visibility_presentation(self.object)
        context.setdefault("condition_modal_title", _("Content access check"))
        context.setdefault("condition_modal_kicker", _("Conditional"))
        context.setdefault("condition_modal_confirm", _("Purchase now"))
        context.setdefault("condition_modal_cancel", _("Cancel"))
        context.setdefault("condition_modal_insufficient_money", _("Insufficient balance"))
        context.setdefault("condition_modal_insufficient_points", _("Insufficient points"))
        context.setdefault("condition_return_url", get_safe_next_url(self.request) or self.request.META.get("HTTP_REFERER") or reverse("book-list"))
        context.setdefault("condition_submit_url", self.object.get_absolute_url())
        if context["requires_password"]:
            context["password_submit_url"] = self.object.get_absolute_url()
            context["password_modal_title"] = _("Enter password to view this book")
            context["password_modal_kicker"] = _("Encrypted")
            context["password_modal_confirm"] = _("Unlock book")
            context["password_modal_cancel"] = _("Cancel")
        if context["requires_condition"]:
            context["condition_submit_url"] = self.object.get_absolute_url()
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

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if not book_has_encrypted_access(self.object) and not book_has_value_conditions(self.object):
            raise Http404
        next_url = get_safe_next_url(request) or self.object.get_absolute_url()
        has_encrypted_access = book_has_encrypted_access(self.object)
        has_value_conditions = book_has_value_conditions(self.object)
        password_submitted = has_encrypted_access and "password" in request.POST
        requires_password = book_requires_password(request, self.object)

        if password_submitted and can_bypass_book_password(request.user, self.object):
            if is_ajax_request(request):
                return JsonResponse({"ok": True, "redirect_url": next_url})
            return redirect(next_url)

        if password_submitted:
            form = BookAccessForm(request.POST)
            if not form.is_valid():
                if is_ajax_request(request):
                    return JsonResponse({"ok": False, "message": str(form.errors.get("password", [_("Password is required.")])[0])}, status=400)
                return self.render_to_response(self.get_context_data(access_form=form, requires_password=True))
            if not check_condition_password(self.object.condition_rules, form.cleaned_data["password"]):
                form.add_error("password", _("Incorrect password."))
                if is_ajax_request(request):
                    return JsonResponse({"ok": False, "message": str(_("Incorrect password."))}, status=400)
                return self.render_to_response(self.get_context_data(access_form=form, requires_password=True))
            mark_book_unlocked(request, self.object)
            if has_value_conditions:
                access_state = get_book_condition_access_state(request, self.object)
                if access_state["status"] != ACCESS_STATUS_GRANTED:
                    if is_ajax_request(request):
                        return JsonResponse({"ok": True, "redirect_url": next_url})
                    return redirect(next_url)
            if is_ajax_request(request):
                return JsonResponse({"ok": True, "redirect_url": next_url})
            return redirect(next_url)

        if requires_password:
            form = BookAccessForm(request.POST or None)
            if is_ajax_request(request):
                return JsonResponse({"ok": False, "message": str(_("Password is required."))}, status=400)
            return self.render_to_response(self.get_context_data(access_form=form, requires_password=True))

        if has_value_conditions:
            access_state = get_book_condition_access_state(request, self.object)
            if access_state["status"] == ACCESS_STATUS_PURCHASE_REQUIRED:
                purchase_result = purchase_book_access(request.user, self.object)
                if not purchase_result["ok"]:
                    if is_ajax_request(request):
                        return JsonResponse({"ok": False, "status": ACCESS_STATUS_INSUFFICIENT_MONEY, "message": purchase_result["message"]}, status=400)
                    return self.render_to_response(self.get_context_data(requires_condition=True))
                if is_ajax_request(request):
                    return JsonResponse({"ok": True, "redirect_url": next_url})
                return redirect(next_url)
            if access_state["status"] in [ACCESS_STATUS_INSUFFICIENT_MONEY, ACCESS_STATUS_INSUFFICIENT_POINTS]:
                if is_ajax_request(request):
                    return JsonResponse({"ok": False, "status": access_state["status"]}, status=400)
                return self.render_to_response(self.get_context_data(requires_condition=True))
            return redirect(next_url)
        if can_bypass_book_password(request.user, self.object):
            if is_ajax_request(request):
                return JsonResponse({"ok": True, "redirect_url": next_url})
            return redirect(next_url)
        form = BookAccessForm(request.POST)
        if is_ajax_request(request):
            return JsonResponse({"ok": False, "message": str(form.errors.get("password", [_("Password is required.")])[0])}, status=400)
        return self.render_to_response(self.get_context_data(access_form=form, requires_password=True))
