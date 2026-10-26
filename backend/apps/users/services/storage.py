from pathlib import Path

from django.conf import settings

from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.site_settings.application.settings_service import SiteSettingsService


BYTES_PER_MB = 1024 * 1024


def get_user_media_size(user):
    """Return bytes physically stored in the user's avatar and content-asset folders."""
    total = 0
    for directory in (
        Path(settings.MEDIA_ROOT) / "avatars" / f"user-{user.pk}",
        Path(settings.MEDIA_ROOT) / "content-assets" / f"user-{user.pk}",
    ):
        if not directory.is_dir():
            continue
        for path in directory.rglob("*"):
            try:
                if path.is_file():
                    total += path.stat().st_size
            except OSError:
                continue
    return total


def get_user_storage_capacity_mb(user):
    values = SiteSettingsService.get_all()
    identity = UserIdentityService.resolve(user)
    if identity.vip_level:
        configs = values["vip"].get("vip_configs", [])
        if identity.vip_level <= len(configs):
            return int(configs[identity.vip_level - 1].get("storage_capacity_mb", 0) or 0)
    return int(values["user.rewards"].get("storage_capacity_mb", 10) or 0)


def ensure_user_storage_capacity(user, upload_size):
    if user.is_staff or user.is_superuser or not upload_size:
        return
    used_bytes = get_user_media_size(user)
    limit_mb = get_user_storage_capacity_mb(user)
    if used_bytes + upload_size > limit_mb * BYTES_PER_MB:
        from rest_framework.exceptions import ValidationError

        raise ValidationError({
            "code": "storage_quota_exceeded",
            "detail": "Personal storage capacity has been exceeded.",
            "limit_mb": limit_mb,
            "used_bytes": used_bytes,
            "upload_bytes": upload_size,
        })
