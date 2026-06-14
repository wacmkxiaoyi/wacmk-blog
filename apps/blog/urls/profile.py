from django.urls import path

from apps.blog.views.profile import ProfileView
from apps.blog.views.profile_attachments import ProfileAttachmentDeleteView, ProfileAttachmentListView, ProfileAttachmentUpdateView
from apps.blog.views.profile_books import (
    ProfileBookCreateView,
    ProfileBookDeleteView,
    ProfileBookListView,
    ProfileBookPostSearchView,
    ProfileBookUpdateView,
)
from apps.blog.views.profile_comments import (
    ProfileCommentDeleteView,
    ProfileCommentListView,
    ProfileCommentUpdateView,
)
from apps.blog.views.profile_posts import (
    ProfilePostCreateView,
    ProfilePostDraftDeleteView,
    ProfilePostDraftUpdateView,
    ProfilePostImportView,
    ProfilePostListView,
    ProfilePostMarkdownImportView,
)

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/posts/", ProfilePostListView.as_view(), name="profile-posts"),
    path("profile/posts/new/", ProfilePostCreateView.as_view(), name="profile-post-create"),
    path("profile/posts/import/", ProfilePostImportView.as_view(), name="profile-post-import"),
    path("profile/posts/import-markdown/", ProfilePostMarkdownImportView.as_view(), name="profile-post-import-markdown"),
    path("profile/posts/drafts/<int:pk>/edit/", ProfilePostDraftUpdateView.as_view(), name="profile-draft-update"),
    path("profile/posts/drafts/<int:pk>/delete/", ProfilePostDraftDeleteView.as_view(), name="profile-draft-delete"),
    path("profile/books/", ProfileBookListView.as_view(), name="profile-books"),
    path("profile/books/new/", ProfileBookCreateView.as_view(), name="profile-book-create"),
    path("profile/books/<int:pk>/edit/", ProfileBookUpdateView.as_view(), name="profile-book-update"),
    path("profile/books/<int:pk>/delete/", ProfileBookDeleteView.as_view(), name="profile-book-delete"),
    path("profile/attachments/", ProfileAttachmentListView.as_view(), name="profile-attachments"),
    path("profile/attachments/<int:pk>/edit/", ProfileAttachmentUpdateView.as_view(), name="profile-attachment-update"),
    path("profile/attachments/<int:pk>/delete/", ProfileAttachmentDeleteView.as_view(), name="profile-attachment-delete"),
    path("profile/books/post-search/", ProfileBookPostSearchView.as_view(), name="profile-book-post-search"),
    path("profile/comments/", ProfileCommentListView.as_view(), name="profile-comments"),
    path("profile/comments/<int:pk>/edit/", ProfileCommentUpdateView.as_view(), name="profile-comment-update"),
    path("profile/comments/<int:pk>/delete/", ProfileCommentDeleteView.as_view(), name="profile-comment-delete"),
]
