from django.conf import settings

from apps.users.models import UserProfile

from .forms import SearchForm
from .utils.site import build_user_business_identity_summary, get_setting_file_url, get_site_setting


def global_site_context(request):
    user = getattr(request, "user", None)
    profile = None
    user_business_identity = None
    if user and user.is_authenticated:
        profile, _created = UserProfile.objects.get_or_create(user=user)
    site_setting = get_site_setting()
    if user and user.is_authenticated:
        user_business_identity = build_user_business_identity_summary(user, site_setting)
    site_title = site_setting.get("site_title") or settings.APP_NAME
    return {
        "nav_search_form": SearchForm(request.GET or None),
        "site_user_profile": profile,
        "site_user_business_identity": user_business_identity,
        "site_setting": site_setting,
        "site_display_title": site_title,
        "site_icon_url": get_setting_file_url("site_icon"),
        "auth_background_url": get_setting_file_url("auth_background"),
        "app_background_url": get_setting_file_url("app_background"),
        "attachment_max_size_mb": site_setting.get("attachment_max_size_mb", 1),
        "post_editor_autosave_enabled": site_setting.get("post_editor_autosave_enabled", True),
        "post_editor_autosave_interval_minutes": site_setting.get("post_editor_autosave_interval_minutes", 5),
    }
