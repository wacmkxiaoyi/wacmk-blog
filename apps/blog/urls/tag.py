from django.urls import path

from apps.blog.views.tag import TagDetailView, TagListView

urlpatterns = [
    path("tags/", TagListView.as_view(), name="blog-tags"),
    path("tags/<slug:slug>/", TagDetailView.as_view(), name="blog-tag-detail"),
]
