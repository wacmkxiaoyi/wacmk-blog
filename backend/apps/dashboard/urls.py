from django.urls import path

from .views import HomeDashboardView


urlpatterns = [
    path("home/", HomeDashboardView.as_view(), name="home-dashboard"),
]
