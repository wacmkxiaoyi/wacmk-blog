from django.urls import path

from .views import TagDirectoryView


urlpatterns = [
    path("", TagDirectoryView.as_view(), name="tag-directory"),
]
