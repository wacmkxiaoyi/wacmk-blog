from django.contrib import messages
from django.db.models import Q
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import ListView
import json

from apps.blog.models import Attachment
from apps.blog.forms.attachment import AttachmentUpdateForm
from apps.blog.utils import get_setting
from apps.blog.utils.attachments import build_attachment_render_context
from apps.blog.views.attachment import AttachmentDeleteView, AttachmentUpdateView
from apps.blog.views.manage.base import ManageBaseMixin


class ManageAttachmentListView(ManageBaseMixin, ListView):
    template_name = "blog/manage/attachment_list.html"
    context_object_name = "attachments"
    paginate_by = 15
    default_sort = "updated_at"
    sortable_fields = {
        "title": ("title", "pk"),
        "uploaded_by": ("uploaded_by__first_name", "uploaded_by__username", "pk"),
        "updated_at": ("updated_at", "pk"),
    }

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = Attachment.objects.select_related("uploaded_by")
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(original_filename__icontains=query)
                | Q(uploaded_by__username__icontains=query)
                | Q(uploaded_by__first_name__icontains=query)
            )
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        context.update(self.get_manage_context(section="attachments", query=query))
        context["attachment_max_size_mb"] = get_setting("attachment_max_size_mb")
        for attachment in context["attachments"]:
            edit_form = AttachmentUpdateForm(instance=attachment, user=self.request.user)
            attachment.render_context = build_attachment_render_context(attachment, self.request.user)
            attachment.edit_initial = {
                "visibility": edit_form.initial.get("visibility", attachment.visibility),
                "access_scope": edit_form.initial.get("access_scope", attachment.access_scope),
                "vip_access_permission": edit_form.initial.get("vip_access_permission", attachment.vip_access_permission),
                "condition_rules": edit_form.initial.get("condition_rules", "[]"),
                "vip_condition_rules": edit_form.initial.get("vip_condition_rules", "[]"),
                "condition_rules_json": json.dumps(json.loads(edit_form.initial.get("condition_rules", "[]")), ensure_ascii=True),
                "vip_condition_rules_json": json.dumps(json.loads(edit_form.initial.get("vip_condition_rules", "[]")), ensure_ascii=True),
                "existing_password_rule_types": ",".join(getattr(edit_form, "existing_password_rule_types", [])),
                "existing_vip_password_rule_types": ",".join(getattr(edit_form, "existing_vip_password_rule_types", [])),
            }
        context["show_uploaded_by"] = True
        return context


class ManageAttachmentUpdateView(ManageBaseMixin, AttachmentUpdateView):
    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        return next_url or reverse("manage-attachments")


class ManageAttachmentDeleteView(ManageBaseMixin, AttachmentDeleteView):
    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        return next_url or reverse("manage-attachments")

    def handle_forbidden(self):
        messages.error(self.request, _("You do not have permission to manage this attachment."))
        return redirect(self.get_success_url())


__all__ = ["ManageAttachmentDeleteView", "ManageAttachmentListView", "ManageAttachmentUpdateView"]
