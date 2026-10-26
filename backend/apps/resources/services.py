from rest_framework.exceptions import ValidationError

from apps.site_settings.application.settings_service import SiteSettingsService


def max_upload_size(kind):
    if kind == "image":
        return 20 * 1024 * 1024
    setting_key = "upload.attachment" if kind == "attachment" else "upload.video"
    default_limit_mb = 20 if kind == "attachment" else 200
    limit_mb = int(SiteSettingsService.get_all()[setting_key].get("max_size_mb", default_limit_mb))
    return limit_mb * 1024 * 1024


def validate_upload(file, kind):
    if not file:
        raise ValidationError({"file": ["A file is required."]})
    limit_bytes = max_upload_size(kind)
    if file.size > limit_bytes:
        raise ValidationError({"file": [f"The uploaded file exceeds the {limit_bytes // 1024 // 1024} MB size limit."]})
    if kind == "image" and not (getattr(file, "content_type", "") or "").startswith("image/"):
        raise ValidationError({"file": ["The uploaded file must be an image."]})
    if kind == "video" and not (getattr(file, "content_type", "") or "").startswith("video/"):
        raise ValidationError({"file": ["The uploaded file must be a video."]})
