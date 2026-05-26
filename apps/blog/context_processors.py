from django.conf import settings

from apps.users.models import UserProfile

from .forms import SearchForm
from .utils.site import get_site_setting


def global_site_context(request):
    user = getattr(request, "user", None)
    profile = None
    if user and user.is_authenticated:
        profile, _created = UserProfile.objects.get_or_create(user=user)
    site_setting = get_site_setting()
    return {
        "nav_search_form": SearchForm(request.GET or None),
        "site_user_profile": profile,
        "site_setting": site_setting,
        "site_display_title": site_setting.site_title if site_setting and site_setting.site_title else settings.APP_NAME,
    }
