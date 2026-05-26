from django.urls import path

from apps.blog.views.comment import CommentCreateView, CommentDeleteView, CommentFeedbackToggleView, CommentUpdateView

urlpatterns = [
    path("blog/<slug:slug>/comments/", CommentCreateView.as_view(), name="comment-create"),
    path("comments/<int:pk>/edit/", CommentUpdateView.as_view(), name="comment-update"),
    path("comments/<int:pk>/feedback/", CommentFeedbackToggleView.as_view(), name="comment-feedback-toggle"),
    path("comments/<int:pk>/delete/", CommentDeleteView.as_view(), name="comment-delete"),
]
