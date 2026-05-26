from django.contrib import messages
from django.db.models import Case, CharField, F, Q, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import redirect
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import ListView

from apps.blog.models import AuditLog
from apps.blog.views.manage.base import ManageBaseMixin


class ManageAuditClearView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        AuditLog.objects.all().delete()
        messages.success(request, _("Audit logs cleared successfully."))
        return redirect("manage-audit")


class ManageAuditListView(ManageBaseMixin, ListView):
    template_name = "blog/manage/audit_list.html"
    context_object_name = "logs"
    paginate_by = 30
    default_sort = "time"
    sortable_fields = {
        "action": ("action", "pk"),
        "user": ("user_display_name_sort", "pk"),
        "time": ("created_at", "pk"),
    }

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = AuditLog.objects.select_related("user").annotate(
            user_display_name_sort=Case(
                When(user__isnull=True, then=Value("")),
                When(user__first_name="", then=Coalesce(F("user__username"), Value(""))),
                default=F("user__first_name"),
                output_field=CharField(),
            )
        )
        if query:
            queryset = queryset.filter(Q(message__icontains=query) | Q(user__username__icontains=query) | Q(action__icontains=query))
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        context.update(self.get_manage_context(section="audit", query=query))
        return context


__all__ = ["ManageAuditClearView", "ManageAuditListView"]
