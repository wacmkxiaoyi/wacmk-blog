from django.contrib import messages
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import ListView

from apps.blog.forms.comment import CommentForm
from apps.blog.models import AuditLog, Comment
from apps.blog.utils import write_audit_log
from apps.blog.views.media import MEDIA_UPLOAD_CONTEXT_COMMENT
from apps.blog.views.comment.utils import get_comment_edit_allowed
from apps.blog.views.manage.base import ManageBaseMixin


class ManageCommentListView(ManageBaseMixin, ListView):
    template_name = "blog/manage/comment_list.html"
    context_object_name = "comments"
    paginate_by = 20
    default_sort = "created_at"
    sortable_fields = {
        "author": ("author__username", "pk"),
        "created_at": ("created_at", "pk"),
    }

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = Comment.objects.select_related("author", "post")
        if query:
            queryset = queryset.filter(
                Q(content__icontains=query)
                | Q(author__username__icontains=query)
                | Q(author__first_name__icontains=query)
            )
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        context.update(self.get_manage_context(section="comments", query=query))
        context["edit_form"] = CommentForm(user=self.request.user, editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT, image_upload_url=reverse("manage-upload-image"))
        return context


class ManageCommentUpdateView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        comment = get_object_or_404(Comment.objects.select_related("post"), pk=kwargs["pk"])
        if not get_comment_edit_allowed(comment, request.user):
            messages.error(request, _("You do not have permission to edit this comment."))
            return redirect("manage-comments")

        form = CommentForm(request.POST, instance=comment, user=request.user, editor_context=MEDIA_UPLOAD_CONTEXT_COMMENT, image_upload_url=reverse("manage-upload-image"))
        if not form.is_valid():
            messages.error(request, _("Comment content cannot be empty."))
            return redirect("manage-comments")

        updated_comment = form.save()
        audit_message = _("Comment updated on %(title)s") % {"title": updated_comment.post.title}
        write_audit_log(request, AuditLog.ACTION_COMMENT_UPDATE, str(audit_message), user=request.user)
        messages.success(request, _("Comment updated successfully."))
        return redirect(self.get_success_url())

    def get_success_url(self):
        next_url = self.get_next_url()
        return next_url or reverse("manage-comments")


class ManageCommentDeleteView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        comment = get_object_or_404(Comment.objects.select_related("post"), pk=kwargs["pk"])
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
        next_url = self.get_next_url()
        return next_url or reverse("manage-comments")


__all__ = ["ManageCommentListView", "ManageCommentUpdateView", "ManageCommentDeleteView"]
