import os

from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.utils.translation import gettext_lazy as _
from django.views import View

from apps.blog.utils import editor_image_upload_path, editor_video_upload_path, get_setting, is_ajax_request
from apps.blog.utils.site import check_comment_permission, check_video_upload_permission


MEDIA_UPLOAD_CONTEXT_COMMENT = "comment"
MEDIA_UPLOAD_CONTEXT_POST = "post"
MEDIA_UPLOAD_CONTEXT_CHOICES = {MEDIA_UPLOAD_CONTEXT_COMMENT, MEDIA_UPLOAD_CONTEXT_POST}
IMAGE_UPLOAD_ALLOWED_TYPES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".avif"}
VIDEO_UPLOAD_ALLOWED_TYPES = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".ogg"}


def get_media_upload_context(request):
    context = (request.POST.get("context") or request.GET.get("context") or "").strip().lower()
    if context in MEDIA_UPLOAD_CONTEXT_CHOICES:
        return context
    return ""


def check_media_context_permission(user, context):
    normalized = str(context or "").strip().lower()
    if normalized == MEDIA_UPLOAD_CONTEXT_COMMENT:
        return check_comment_permission(user)
    if normalized == MEDIA_UPLOAD_CONTEXT_POST:
        return bool(getattr(user, "is_authenticated", False))
    return False


class FrontendMediaUploadMixin(LoginRequiredMixin, View):
    login_url = None

    def dispatch(self, request, *args, **kwargs):
        if not getattr(request.user, "is_authenticated", False) and is_ajax_request(request):
            return JsonResponse({"ok": False, "message": str(_("Please sign in and try uploading again."))}, status=401)
        return super().dispatch(request, *args, **kwargs)

    def get_upload_context(self, request):
        return get_media_upload_context(request)

    def check_upload_permission(self, request, context):
        return check_media_context_permission(request.user, context)

    def get_permission_denied_message(self):
        return str(_("You do not have permission to upload files in this editor."))

    def reject_invalid_context(self):
        return JsonResponse({"ok": False, "message": str(_("Unknown upload context."))}, status=400)


class FrontendImageUploadView(FrontendMediaUploadMixin):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        context = self.get_upload_context(request)
        image = request.FILES.get("image")
        if context not in MEDIA_UPLOAD_CONTEXT_CHOICES:
            return self.reject_invalid_context()
        if not self.check_upload_permission(request, context):
            return JsonResponse({"success": 0, "message": self.get_permission_denied_message()}, status=403)
        if image is None:
            return JsonResponse({"success": 0, "message": str(_("No image uploaded."))}, status=400)
        extension = os.path.splitext(image.name or "")[1].lower()
        if extension not in IMAGE_UPLOAD_ALLOWED_TYPES:
            return JsonResponse({"success": 0, "message": str(_("Please choose a valid image file."))}, status=400)
        image_name = default_storage.save(editor_image_upload_path(request.user, image.name), image)
        image_url = default_storage.url(image_name)
        return JsonResponse({"success": 1, "file": {"url": image_url}})


class FrontendVideoUploadView(FrontendMediaUploadMixin):
    http_method_names = ["post"]

    def check_upload_permission(self, request, context):
        return check_media_context_permission(request.user, context) and check_video_upload_permission(request.user)

    def get_permission_denied_message(self):
        return str(_("You do not have permission to upload videos."))

    def post(self, request, *args, **kwargs):
        context = self.get_upload_context(request)
        video = request.FILES.get("video")
        max_size_mb = get_setting("video_max_size_mb") or 100
        max_size_bytes = int(max_size_mb * 1024 * 1024)
        if context not in MEDIA_UPLOAD_CONTEXT_CHOICES:
            return self.reject_invalid_context()
        if not self.check_upload_permission(request, context):
            return JsonResponse({"ok": False, "message": self.get_permission_denied_message()}, status=403)
        if video is None:
            return JsonResponse({"ok": False, "message": str(_("No video uploaded."))}, status=400)
        extension = os.path.splitext(video.name or "")[1].lower()
        if extension not in VIDEO_UPLOAD_ALLOWED_TYPES:
            return JsonResponse({"ok": False, "message": str(_("Please choose a valid video file."))}, status=400)
        if not video.size:
            return JsonResponse({"ok": False, "message": str(_("The uploaded video is empty."))}, status=400)
        if video.size > max_size_bytes:
            return JsonResponse({"ok": False, "message": str(_("The video exceeds the maximum size of %(size)s MB.")) % {"size": max_size_mb}}, status=400)
        video_name = default_storage.save(editor_video_upload_path(request.user, video.name), video)
        video_url = default_storage.url(video_name)
        return JsonResponse({"ok": True, "file": {"url": video_url}})


__all__ = [
    "FrontendImageUploadView",
    "FrontendVideoUploadView",
    "MEDIA_UPLOAD_CONTEXT_COMMENT",
    "MEDIA_UPLOAD_CONTEXT_POST",
    "check_media_context_permission",
    "get_media_upload_context",
]
