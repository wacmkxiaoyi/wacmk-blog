from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("i18n/", include("django.conf.urls.i18n")),
    path("api/", include("apps.users.urls")),
    path("api/tags/", include("apps.tags.urls")),
    path("api/resources/", include("apps.comments.urls")),
    path("api/resources/", include("apps.resources.urls")),
    path("api/manage/", include("apps.resources.management_urls")),
    path("api/dashboard/", include("apps.dashboard.urls")),
    path("api/manage/site-settings/", include("apps.site_settings.infrastructure.urls")),
]

if settings.DEBUG:
    urlpatterns += [path("", include("apps.playground.urls"))]
