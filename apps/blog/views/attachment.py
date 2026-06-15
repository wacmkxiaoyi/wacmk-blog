from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import F
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Q
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View

from apps.blog.access import build_access_check
from apps.blog.access.resolver import get_access_handler
from apps.blog.forms.attachment import AttachmentUpdateForm, AttachmentUploadForm
from apps.blog.models import Attachment, AttachmentPasswordRecord, AuditLog
from apps.blog.permissions import CONDITION_TYPE_ENCRYPTED, CONDITION_TYPE_MONEY
from apps.blog.services.author_rewards import grant_author_reward_once
from apps.blog.utils import is_ajax_request, write_audit_log
from apps.blog.utils.attachments import build_attachment_placeholder, build_attachment_render_context, format_file_size
from apps.blog.utils.site import check_attachment_upload_permission


class AttachmentUploadView(LoginRequiredMixin, View):
    http_method_names = ["post"]
    login_url = None

    def dispatch(self, request, *args, **kwargs):
        if not getattr(request.user, "is_authenticated", False):
            if is_ajax_request(request):
                return JsonResponse({"ok": False, "message": str(_("Please sign in and try uploading again."))}, status=401)
        return super().dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        if not check_attachment_upload_permission(request.user):
            return JsonResponse({"ok": False, "message": str(_("You do not have permission to upload attachments."))}, status=403)
        form = AttachmentUploadForm(request.POST, request.FILES, user=request.user)
        if not form.is_valid():
            error_data = form.errors.get_json_data() if hasattr(form.errors, "get_json_data") else {}
            message = str(_("Unable to upload attachment."))
            if error_data:
                first_group = next(iter(error_data.values()), [])
                if first_group:
                    message = first_group[0].get("message", message)
            return JsonResponse({"ok": False, "message": message, "errors": error_data}, status=400)

        attachment = form.save()
        context = build_attachment_render_context(attachment, request.user)
        return JsonResponse(
            {
                "ok": True,
                "attachment": {
                    "id": attachment.pk,
                    "title": attachment.title,
                    "placeholder": build_attachment_placeholder(attachment.pk),
                    "fileName": attachment.original_filename,
                    "fileSize": attachment.file_size,
                    "fileSizeLabel": context["attachment_size_label"],
                    "fileExt": attachment.file_ext,
                    "visibilityPresentation": context["attachment_access_icon_presentation"],
                    "conditionSummaryItems": context["attachment_condition_summary_items"],
                    "showVipBadge": context["show_attachment_vip_badge"],
                    "vipConditionSummaryItems": context["attachment_vip_condition_summary_items"],
                    "vipVisibilityPresentation": context["attachment_vip_visibility_presentation"],
                },
            }
        )


class UserAttachmentListView(LoginRequiredMixin, View):
    http_method_names = ["get"]
    login_url = None
    paginate_by = 8

    def dispatch(self, request, *args, **kwargs):
        if not getattr(request.user, "is_authenticated", False):
            if is_ajax_request(request):
                return JsonResponse({"ok": False, "message": str(_("Please sign in and try again."))}, status=401)
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = Attachment.objects.select_related("uploaded_by").filter(uploaded_by=self.request.user)
        if query:
            queryset = queryset.filter(Q(title__icontains=query) | Q(original_filename__icontains=query))
        return queryset.order_by("-updated_at", "-pk")

    def serialize_attachment(self, attachment):
        context = build_attachment_render_context(attachment, self.request.user)
        return {
            "id": attachment.pk,
            "title": attachment.title,
            "fileName": attachment.original_filename,
            "fileSizeLabel": format_file_size(attachment.file_size),
            "fileExt": str(attachment.file_ext or "").upper(),
            "updatedAt": attachment.updated_at.strftime("%Y-%m-%d %H:%M") if attachment.updated_at else "",
            "placeholder": build_attachment_placeholder(attachment.pk),
            "visibilityPresentation": context["attachment_access_icon_presentation"],
            "conditionSummaryItems": context["attachment_condition_summary_items"],
            "showVipBadge": context["show_attachment_vip_badge"],
            "vipConditionSummaryItems": context["attachment_vip_condition_summary_items"],
            "vipVisibilityPresentation": context["attachment_vip_visibility_presentation"],
        }

    def get(self, request, *args, **kwargs):
        if not check_attachment_upload_permission(request.user):
            return JsonResponse({"ok": False, "message": str(_("You do not have permission to view uploaded attachments."))}, status=403)
        query = (request.GET.get("q") or "").strip()
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        return JsonResponse(
            {
                "ok": True,
                "attachments": [self.serialize_attachment(attachment) for attachment in page_obj.object_list],
                "pagination": {
                    "page": page_obj.number,
                    "totalPages": paginator.num_pages,
                    "hasPrevious": page_obj.has_previous(),
                    "hasNext": page_obj.has_next(),
                    "previousPage": page_obj.previous_page_number() if page_obj.has_previous() else None,
                    "nextPage": page_obj.next_page_number() if page_obj.has_next() else None,
                    "count": paginator.count,
                },
                "query": query,
            }
        )


class AttachmentDownloadView(View):
    http_method_names = ["get"]

    def get(self, request, *args, **kwargs):
        attachment = get_object_or_404(Attachment.objects.select_related("uploaded_by"), pk=kwargs["pk"])
        handler = get_access_handler(attachment, request.user)
        if not handler.is_author_or_staff(request.user) and handler.effective_visibility == Attachment.VISIBILITY_PRIVATE:
            raise Http404
        if not build_access_check(attachment, request.user)["all_granted"]:
            raise Http404
        try:
            file_handle = attachment.file.open("rb")
        except FileNotFoundError as exc:
            raise Http404 from exc
        grant_author_reward_once(attachment, request.user)
        Attachment.objects.filter(pk=attachment.pk).update(download_count=F("download_count") + 1)
        response = FileResponse(file_handle, as_attachment=True, filename=attachment.original_filename or attachment.title)
        return response


class AttachmentAccessCheckView(View):
    http_method_names = ["get", "post"]

    def _get_attachment(self, pk):
        return get_object_or_404(Attachment.objects.select_related("uploaded_by"), pk=pk)

    def get(self, request, *args, **kwargs):
        attachment = self._get_attachment(kwargs["pk"])
        return JsonResponse(build_access_check(attachment, request.user))

    def post(self, request, *args, **kwargs):
        attachment = self._get_attachment(kwargs["pk"])
        action = (request.POST.get("action") or "").strip().lower()
        if action == "password":
            return self._handle_password(request, attachment)
        if action == "purchase":
            return self._handle_purchase(request, attachment)
        return JsonResponse({"ok": False, "message": str(_("Unknown action."))}, status=400)

    def _handle_password(self, request, attachment):
        access_check = build_access_check(attachment, request.user)
        has_encrypted_condition = any(
            c["type"] == CONDITION_TYPE_ENCRYPTED and c["status"] != "granted"
            for c in access_check["conditions"]
        )
        if not has_encrypted_condition:
            return JsonResponse({"ok": False, "message": str(_("No password required."))}, status=400)

        raw_password = (request.POST.get("password") or "").strip()
        if not raw_password:
            return JsonResponse({"ok": False, "message": str(_("Password is required."))}, status=400)

        handler = get_access_handler(attachment, request.user)
        if not handler.check_password(raw_password):
            return JsonResponse({"ok": False, "message": str(_("Incorrect password."))}, status=400)

        if not handler.is_author_or_staff(request.user):
            AttachmentPasswordRecord.objects.get_or_create(user=request.user, attachment=attachment)

        return JsonResponse({"ok": True, "access_check": build_access_check(attachment, request.user)})

    def _handle_purchase(self, request, attachment):
        access_check = build_access_check(attachment, request.user)
        has_purchase_required = any(
            c["type"] == CONDITION_TYPE_MONEY and c["status"] == "purchase_required"
            for c in access_check["conditions"]
        )
        if not has_purchase_required:
            return JsonResponse({"ok": False, "message": str(_("No purchase required."))}, status=400)

        purchase_result = get_access_handler(attachment, request.user).purchase(request.user)
        if not purchase_result["ok"]:
            return JsonResponse({"ok": False, "status": "insufficient_money", "message": purchase_result["message"]}, status=400)
        return JsonResponse({"ok": True, "access_check": build_access_check(attachment, request.user)})


class AttachmentOwnerOrStaffMixin(LoginRequiredMixin):
    def get_attachment_queryset(self):
        return Attachment.objects.select_related("uploaded_by")

    def get_attachment(self, pk):
        return get_object_or_404(self.get_attachment_queryset(), pk=pk)

    def can_manage_attachment(self, attachment):
        user = self.request.user
        return bool(user.is_staff or user.is_superuser or attachment.uploaded_by_id == user.id)

    def handle_forbidden(self):
        if is_ajax_request(self.request):
            return JsonResponse({"ok": False, "message": str(_("You do not have permission to manage this attachment."))}, status=403)
        messages.error(self.request, _("You do not have permission to manage this attachment."))
        return redirect(self.get_success_url())


class AttachmentUpdateView(AttachmentOwnerOrStaffMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        attachment = self.get_attachment(kwargs["pk"])
        if not self.can_manage_attachment(attachment):
            return self.handle_forbidden()

        form = AttachmentUpdateForm(request.POST, request.FILES, instance=attachment, user=request.user)
        if not form.is_valid():
            error_data = form.errors.get_json_data() if hasattr(form.errors, "get_json_data") else {}
            message = str(_("Unable to update attachment."))
            if error_data:
                first_group = next(iter(error_data.values()), [])
                if first_group:
                    message = first_group[0].get("message", message)
            return JsonResponse({"ok": False, "message": message, "errors": error_data}, status=400)

        attachment = form.save()
        context = build_attachment_render_context(attachment, request.user)
        write_audit_log(
            request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("Attachment updated: %(title)s")) % {"title": attachment.title},
            user=request.user,
        )
        return JsonResponse(
            {
                "ok": True,
                "attachment": {
                    "id": attachment.pk,
                    "title": attachment.title,
                    "fileName": attachment.original_filename,
                    "fileSize": attachment.file_size,
                    "fileSizeLabel": context["attachment_size_label"],
                    "fileExt": attachment.file_ext,
                    "updatedAt": attachment.updated_at.strftime("%Y-%m-%d %H:%M") if attachment.updated_at else "",
                    "visibilityPresentation": context["attachment_access_icon_presentation"],
                    "conditionSummaryItems": context["attachment_condition_summary_items"],
                    "showVipBadge": context["show_attachment_vip_badge"],
                    "vipConditionSummaryItems": context["attachment_vip_condition_summary_items"],
                    "vipVisibilityPresentation": context["attachment_vip_visibility_presentation"],
                },
            }
        )

    def get_success_url(self):
        return reverse("profile-attachments")


class AttachmentDeleteView(AttachmentOwnerOrStaffMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        attachment = self.get_attachment(kwargs["pk"])
        if not self.can_manage_attachment(attachment):
            return self.handle_forbidden()

        attachment_title = attachment.title
        file_name = attachment.file.name
        attachment.delete()
        if file_name:
            attachment.file.storage.delete(file_name)
        write_audit_log(
            request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("Attachment deleted: %(title)s")) % {"title": attachment_title},
            user=request.user,
        )
        messages.success(request, _("Attachment deleted successfully."))
        return redirect(self.get_success_url())

    def get_success_url(self):
        next_url = (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()
        return next_url or reverse("profile-attachments")


__all__ = [
    "AttachmentAccessCheckView",
    "AttachmentDeleteView",
    "AttachmentDownloadView",
    "AttachmentUpdateView",
    "AttachmentUploadView",
    "UserAttachmentListView",
]
