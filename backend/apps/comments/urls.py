from django.urls import path

from .views import ArticleCommentAssetManifestView, ArticleCommentAttachmentDownloadView, ArticleCommentDetailView, ArticleCommentsView, CommentReactionView


urlpatterns = [
    path("articles/<slug:slug>/comments/", ArticleCommentsView.as_view(), name="article-comments"),
    path("articles/<slug:slug>/comments/asset-manifest/", ArticleCommentAssetManifestView.as_view(), name="article-comment-asset-manifest"),
    path("articles/<slug:slug>/comments/assets/<uuid:asset_id>/download/", ArticleCommentAttachmentDownloadView.as_view(), name="article-comment-attachment-download"),
    path("articles/<slug:slug>/comments/<int:comment_id>/", ArticleCommentDetailView.as_view(), name="article-comment-detail"),
    path("articles/<slug:slug>/comments/<int:comment_id>/reaction/", CommentReactionView.as_view(), name="article-comment-reaction"),
]
