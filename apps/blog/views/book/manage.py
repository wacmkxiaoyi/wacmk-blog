from django.contrib import messages
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import CreateView, ListView, UpdateView

from apps.blog.forms.book import BookForm
from apps.blog.models import AuditLog, Book, BookShareLink
from apps.blog.utils import write_audit_log
from apps.blog.visibility import (
    book_has_any_conditions,
    book_has_vip_standalone,
    get_book_condition_summary_items,
    get_book_vip_condition_summary_items,
    get_book_vip_visibility_presentation,
    get_book_visibility_presentation,
)
from apps.blog.views.book.utils import build_book_share_editor_context
from apps.blog.views.manage.base import ManageBaseMixin


class ManageBookListView(ManageBaseMixin, ListView):
    template_name = "blog/manage/book_list.html"
    context_object_name = "books"
    paginate_by = 15
    default_sort = "updated_at"
    sortable_fields = {
        "name": ("name", "pk"),
        "post_count": ("post_count", "name", "pk"),
        "updated_at": ("updated_at", "pk"),
    }

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = Book.objects.annotate(post_count=Count("posts", distinct=True))
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
        query = (self.request.GET.get("q") or "").strip()
        context.update(self.get_manage_context(section="books", query=query))
        return context


class ManageBookCreateView(ManageBaseMixin, CreateView):
    template_name = "blog/editor/book_form.html"
    form_class = BookForm
    success_url = reverse_lazy("manage-books")

    def get_success_url(self):
        return self.get_next_url() or reverse("manage-books")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        kwargs["request"] = self.request
        return kwargs

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
        context.update(self.get_manage_context(section="books", page_title=_("Create book")))
        context["next_url"] = self.get_next_url()
        context.update(build_book_share_editor_context(context["form"].instance, self.request))
        return context


class ManageBookUpdateView(ManageBaseMixin, UpdateView):
    template_name = "blog/editor/book_form.html"
    context_object_name = "book"
    form_class = BookForm
    queryset = Book.objects.select_related("created_by").prefetch_related("posts__author")

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
        return self.get_next_url() or reverse("manage-books")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_manage_context(section="books", page_title=self.object.name))
        context["next_url"] = self.get_next_url()
        context["posts"] = self.object.posts.select_related("author", "revision_draft").prefetch_related("tags", "books").order_by("-updated_at")
        selected_ids = {str(post.pk) for post in context["posts"]}
        context["form"].post_options = [option for option in context["form"].post_options if option["value"] in selected_ids]
        context.update(build_book_share_editor_context(self.object, self.request))
        return context


class ManageBookDeleteView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        book = get_object_or_404(Book, pk=kwargs["pk"])
        book_name = book.name
        book.delete()
        write_audit_log(
            request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("Book deleted: %(name)s")) % {"name": book_name},
            user=request.user,
        )
        messages.success(request, _("Book deleted successfully."))
        return redirect("manage-books")


__all__ = ["ManageBookCreateView", "ManageBookDeleteView", "ManageBookListView", "ManageBookUpdateView"]
