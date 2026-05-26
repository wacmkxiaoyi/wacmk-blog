from django.urls import path

from apps.blog.views.profile import ProfileView

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
]
