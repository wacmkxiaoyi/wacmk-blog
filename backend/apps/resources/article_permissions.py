from rest_framework.exceptions import PermissionDenied

from .models import Article, ArticleDraft
from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.site_settings.application.settings_service import SiteSettingsService


def is_site_manager(user):
    return bool(user.is_staff or user.is_superuser)


def require_article_write_permission(user, *, creating=False):
    """Apply the site writing policy; resource ownership is checked by callers."""
    if is_site_manager(user):
        return

    settings = SiteSettingsService.get_all()["content.article"]
    if not settings["allow_non_admin_create"]:
        raise PermissionDenied("Article writing is disabled for non-administrators.")
    if settings["vip_only"] and not UserIdentityService.resolve(user).is_vip:
        raise PermissionDenied("Article writing is limited to VIP users.")
    if not creating:
        return

    limit = int(settings["non_admin_max_count"])
    if limit <= 0:
        return
    published_count = Article.objects.filter(author=user).count()
    standalone_draft_count = ArticleDraft.objects.filter(author=user).exclude(
        article_id__in=Article.objects.values("pk"),
    ).count()
    if published_count + standalone_draft_count >= limit:
        raise PermissionDenied("Your article limit has been reached.")
