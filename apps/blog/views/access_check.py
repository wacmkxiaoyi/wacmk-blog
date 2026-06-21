from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from django.views import View

from apps.blog.access import get_access_handler, build_access_check
from apps.blog.models.attachment import Attachment, AttachmentPasswordRecord
from apps.blog.models.book import Book, BookPasswordRecord
from apps.blog.models.post import Post, PostPasswordRecord
from apps.blog.permissions import CONDITION_TYPE_ENCRYPTED, CONDITION_TYPE_MONEY, has_condition_rule


class AccessCheckView(View):
    http_method_names = ["get", "post"]

    def _get_object(self, object_type, object_id):
        if object_type == "post":
            return get_object_or_404(Post.objects.select_related("author"), pk=object_id)
        if object_type == "book":
            return get_object_or_404(Book.objects.select_related("created_by"), pk=object_id)
        if object_type == "attachment":
            return get_object_or_404(Attachment.objects.select_related("uploaded_by"), pk=object_id)
        raise Http404

    def get(self, request, object_type, object_id):
        obj = self._get_object(object_type, object_id)
        in_book_context = (request.GET.get("in_book_context") or "").strip() == "1"
        result = build_access_check(obj, request.user, in_book_context=in_book_context)
        return JsonResponse(result)

    def post(self, request, object_type, object_id):
        obj = self._get_object(object_type, object_id)
        action = (request.POST.get("action") or "").strip().lower()

        if action == "password":
            return self._handle_password(request, obj, object_type)
        if action == "purchase":
            return self._handle_purchase(request, obj)
        return JsonResponse({"ok": False, "message": str(_("Unknown action."))}, status=400)

    def _handle_password(self, request, obj, object_type):
        handler = get_access_handler(obj, request.user)
        handler_result = build_access_check(obj, request.user)

        has_encrypted_condition = any(
            c["type"] == CONDITION_TYPE_ENCRYPTED and c["status"] != "granted"
            for c in handler_result["conditions"]
        )
        if not has_encrypted_condition:
            return JsonResponse({"ok": False, "message": str(_("No password required."))}, status=400)

        raw_password = (request.POST.get("password") or "").strip()
        if not raw_password:
            return JsonResponse({"ok": False, "message": str(_("Password is required."))}, status=400)

        if not handler.check_password(raw_password):
            return JsonResponse({"ok": False, "message": str(_("Incorrect password."))}, status=400)

        if handler.is_author_or_staff(request.user):
            result = build_access_check(obj, request.user)
            return JsonResponse({"ok": True, "access_check": result})

        if object_type == "post":
            PostPasswordRecord.objects.get_or_create(user=request.user, post=obj)
        elif object_type == "attachment":
            AttachmentPasswordRecord.objects.get_or_create(user=request.user, attachment=obj)
        else:
            BookPasswordRecord.objects.get_or_create(user=request.user, book=obj)

        result = build_access_check(obj, request.user)
        return JsonResponse({"ok": True, "access_check": result})

    def _handle_purchase(self, request, obj):
        handler = get_access_handler(obj, request.user)
        handler_result = build_access_check(obj, request.user)

        has_purchase_required = any(
            c["type"] == CONDITION_TYPE_MONEY and c["status"] == "purchase_required"
            for c in handler_result["conditions"]
        )
        if not has_purchase_required:
            return JsonResponse({"ok": False, "message": str(_("No purchase required."))}, status=400)

        purchase_result = handler.purchase(request.user)
        if not purchase_result["ok"]:
            return JsonResponse(
                {"ok": False, "status": "insufficient_money", "message": purchase_result["message"]},
                status=400,
            )

        result = build_access_check(obj, request.user)
        return JsonResponse({"ok": True, "access_check": result})


__all__ = ["AccessCheckView"]
