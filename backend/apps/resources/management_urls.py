from django.urls import path

from .views import ManagedArticleExternalLinkDetailView, ManagedArticleExternalLinkListView, ManagedArticleListView, ManagedArticleTagCleanupView, ManagedAttachmentDetailView, ManagedAttachmentListView, ManagedBookDetailView, ManagedBookExternalLinkDetailView, ManagedBookExternalLinkListView, ManagedBookListView


urlpatterns = [
    path("articles/", ManagedArticleListView.as_view(), name="manage-article-list"),
    path("articles/tags/cleanup/", ManagedArticleTagCleanupView.as_view(), name="manage-article-tag-cleanup"),
    path("books/", ManagedBookListView.as_view(), name="manage-book-list"),
    path("books/<slug:slug>/", ManagedBookDetailView.as_view(), name="manage-book-detail"),
    path("article-external-links/", ManagedArticleExternalLinkListView.as_view(), name="manage-article-external-link-list"),
    path("article-external-links/<int:pk>/", ManagedArticleExternalLinkDetailView.as_view(), name="manage-article-external-link-detail"),
    path("book-external-links/", ManagedBookExternalLinkListView.as_view(), name="manage-book-external-link-list"),
    path("book-external-links/<int:pk>/", ManagedBookExternalLinkDetailView.as_view(), name="manage-book-external-link-detail"),
    path("attachments/", ManagedAttachmentListView.as_view(), name="manage-attachment-list"),
    path("attachments/<int:pk>/", ManagedAttachmentDetailView.as_view(), name="manage-attachment-detail"),
]
