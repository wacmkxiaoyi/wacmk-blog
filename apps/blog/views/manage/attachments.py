import json
import os
import subprocess
import sys

from django.contrib import messages
from django.conf import settings
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import ListView

from apps.blog.models import Attachment, AuditLog, MediaCleanupJob
from apps.blog.forms.attachment import AttachmentUpdateForm
from apps.blog.utils import get_setting, write_audit_log
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
        context["active_cleanup_job"] = MediaCleanupJob.objects.select_related("requested_by").filter(status__in=[MediaCleanupJob.STATUS_PENDING, MediaCleanupJob.STATUS_RUNNING]).order_by("-created_at", "-pk").first()
        context["latest_cleanup_job"] = MediaCleanupJob.objects.select_related("requested_by").first()
        context["latest_cleanup_job_payload"] = serialize_media_cleanup_job(context["latest_cleanup_job"])
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


class ManageAttachmentCleanupStartView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        running_job = MediaCleanupJob.objects.filter(status__in=[MediaCleanupJob.STATUS_PENDING, MediaCleanupJob.STATUS_RUNNING]).order_by("-created_at", "-pk").first()
        if running_job is not None:
            return JsonResponse(
                {
                    "ok": False,
                    "message": str(_("A media cleanup task is already running.")),
                    "job": serialize_media_cleanup_job(running_job),
                },
                status=409,
            )

        job = MediaCleanupJob.objects.create(requested_by=request.user)
        command = [sys.executable, "manage.py", "cleanup_unused_media", "--job-id", str(job.pk)]
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.Popen(
            command,
            cwd=settings.BASE_DIR,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
        )
        write_audit_log(
            request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("Started media cleanup job #%(job_id)s.")) % {"job_id": job.pk},
            user=request.user,
        )
        return JsonResponse(
            {
                "ok": True,
                "message": str(_("Media cleanup has started in the background.")),
                "job": serialize_media_cleanup_job(job),
            }
        )


class ManageAttachmentCleanupStatusView(ManageBaseMixin, View):
    http_method_names = ["get"]

    def get(self, request, *args, **kwargs):
        job = MediaCleanupJob.objects.select_related("requested_by").filter(pk=kwargs["pk"]).first()
        if job is None:
            return JsonResponse({"ok": False, "message": str(_("Cleanup task not found."))}, status=404)
        return JsonResponse({"ok": True, "job": serialize_media_cleanup_job(job)})


def serialize_media_cleanup_job(job):
    if job is None:
        return None
    finished = job.status in {MediaCleanupJob.STATUS_SUCCEEDED, MediaCleanupJob.STATUS_FAILED}
    return {
        "id": job.pk,
        "status": job.status,
        "statusLabel": job.get_status_display(),
        "requestedBy": _get_media_cleanup_job_user_label(job),
        "createdAt": _format_media_cleanup_job_datetime(job.created_at),
        "startedAt": _format_media_cleanup_job_datetime(job.started_at),
        "finishedAt": _format_media_cleanup_job_datetime(job.finished_at),
        "scannedFileCount": job.scanned_file_count,
        "keptFileCount": job.kept_file_count,
        "deletedFileCount": job.deleted_file_count,
        "deletedDirectoryCount": job.deleted_directory_count,
        "referencedPathCount": job.referenced_path_count,
        "errorMessage": job.error_message,
        "resultSummary": job.result_summary,
        "statusUrl": reverse("manage-attachment-cleanup-status", kwargs={"pk": job.pk}),
        "isFinished": finished,
        "isRunning": job.status in {MediaCleanupJob.STATUS_PENDING, MediaCleanupJob.STATUS_RUNNING},
    }


def _format_media_cleanup_job_datetime(value):
    if value is None:
        return ""
    localized = timezone.localtime(value) if timezone.is_aware(value) else value
    return localized.strftime("%Y-%m-%d %H:%M")


def _get_media_cleanup_job_user_label(job):
    user = getattr(job, "requested_by", None)
    if user is None:
        return ""
    return user.first_name or user.username


__all__ = [
    "ManageAttachmentCleanupStartView",
    "ManageAttachmentCleanupStatusView",
    "ManageAttachmentDeleteView",
    "ManageAttachmentListView",
    "ManageAttachmentUpdateView",
]
