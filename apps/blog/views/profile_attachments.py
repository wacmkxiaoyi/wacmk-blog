from django.core.paginator import EmptyPage, Paginator
from django.db.models import Q
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import TemplateView
import json

from apps.blog.forms.attachment import AttachmentUpdateForm
from apps.blog.models import Attachment
from apps.blog.utils import get_setting
from apps.blog.utils.attachments import build_attachment_render_context
from apps.blog.views.attachment import AttachmentDeleteView, AttachmentUpdateView
from apps.blog.views.profile_posts import ProfilePostAccessMixin


class ProfileAttachmentListView(ProfilePostAccessMixin, TemplateView):
    template_name = "blog/profile_attachments.html"
    paginate_by = 15
    default_sort = "updated_at"
    sortable_fields = {
        "title": ("title", "pk"),
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
        sort_fields = list(self.sortable_fields[sort])
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
        queryset = Attachment.objects.select_related("uploaded_by").filter(uploaded_by=self.request.user)
        if query:
            queryset = queryset.filter(Q(title__icontains=query) | Q(original_filename__icontains=query))
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_profile_context(current_section="attachments"))
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        for attachment in page_obj.object_list:
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
        context["attachments"] = page_obj.object_list
        context["page_obj"] = page_obj
        context["paginator"] = paginator
        context["is_paginated"] = paginator.num_pages > 1
        context["current_sort"] = self.get_current_sort() or ""
        context["current_sort_direction"] = self.get_current_sort_direction() if self.get_current_sort() else ""
        context["sort_headers"] = self.get_sort_headers()
        context["pagination_query"] = self.build_query()
        context["query"] = (self.request.GET.get("q") or "").strip()
        context["attachment_max_size_mb"] = get_setting("attachment_max_size_mb")
        return context


class ProfileAttachmentUpdateView(AttachmentUpdateView):
    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        return next_url or reverse("profile-attachments")


class ProfileAttachmentDeleteView(AttachmentDeleteView):
    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        return next_url or reverse("profile-attachments")


__all__ = ["ProfileAttachmentDeleteView", "ProfileAttachmentListView", "ProfileAttachmentUpdateView"]
