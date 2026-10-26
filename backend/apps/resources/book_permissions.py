from rest_framework.exceptions import PermissionDenied

from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.site_settings.application.settings_service import SiteSettingsService

from .models import Book


def require_book_write_permission(user):
    """Apply the current book policy to every non-manager write."""
    if user.is_staff or user.is_superuser:
        return

    settings = SiteSettingsService.get_all()["content.book"]
    if not settings["allow_non_admin_create"]:
        raise PermissionDenied("Book writing is disabled for non-administrators.")
    if settings["vip_only"] and not UserIdentityService.resolve(user).is_vip:
        raise PermissionDenied("Book writing is limited to VIP users.")
    limit = int(settings["non_admin_max_count"])
    if limit > 0 and Book.objects.filter(created_by=user).count() >= limit:
        raise PermissionDenied("Your book limit has been reached.")
