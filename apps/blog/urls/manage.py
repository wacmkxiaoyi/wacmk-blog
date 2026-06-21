from django.urls import path

from apps.blog.views.book import ManageBookCreateView, ManageBookDeleteView, ManageBookListView, ManageBookUpdateView
from apps.blog.views.manage import BlogHomeView, ManageAttachmentCleanupStartView, ManageAttachmentCleanupStatusView, ManageAttachmentDeleteView, ManageAttachmentListView, ManageAttachmentUpdateView, ManageAuditClearView, ManageAuditListView, ManageCommentDeleteView, ManageCommentListView, ManageCommentUpdateView, ManageSiteSettingView, ManageUserCreateView, ManageUserDeleteView, ManageUserListView, ManageUserUpdateView
from apps.blog.views.post import ImageUploadView

urlpatterns = [
    path("", BlogHomeView.as_view(), name="blog-home"),
    path("home/", BlogHomeView.as_view(), name="dashboard"),
    path("manage/", ManageSiteSettingView.as_view(), name="manage-home"),
    path("manage/books/", ManageBookListView.as_view(), name="manage-books"),
    path("manage/books/new/", ManageBookCreateView.as_view(), name="manage-book-create"),
    path("manage/books/<int:pk>/edit/", ManageBookUpdateView.as_view(), name="manage-book-update"),
    path("manage/books/<int:pk>/delete/", ManageBookDeleteView.as_view(), name="manage-book-delete"),
    path("manage/attachments/", ManageAttachmentListView.as_view(), name="manage-attachments"),
    path("manage/attachments/cleanup/start/", ManageAttachmentCleanupStartView.as_view(), name="manage-attachment-cleanup-start"),
    path("manage/attachments/cleanup/<int:pk>/status/", ManageAttachmentCleanupStatusView.as_view(), name="manage-attachment-cleanup-status"),
    path("manage/attachments/<int:pk>/edit/", ManageAttachmentUpdateView.as_view(), name="manage-attachment-update"),
    path("manage/attachments/<int:pk>/delete/", ManageAttachmentDeleteView.as_view(), name="manage-attachment-delete"),
    path("manage/comments/", ManageCommentListView.as_view(), name="manage-comments"),
    path("manage/comments/<int:pk>/edit/", ManageCommentUpdateView.as_view(), name="manage-comment-update"),
    path("manage/comments/<int:pk>/delete/", ManageCommentDeleteView.as_view(), name="manage-comment-delete"),
    path("manage/users/", ManageUserListView.as_view(), name="manage-users"),
    path("manage/users/create/", ManageUserCreateView.as_view(), name="manage-user-create"),
    path("manage/users/<int:pk>/", ManageUserUpdateView.as_view(), name="manage-user-update"),
    path("manage/users/<int:pk>/delete/", ManageUserDeleteView.as_view(), name="manage-user-delete"),
    path("manage/basic/", ManageSiteSettingView.as_view(), name="manage-site-settings"),
    path("manage/audit/clear/", ManageAuditClearView.as_view(), name="manage-audit-clear"),
    path("manage/audit/", ManageAuditListView.as_view(), name="manage-audit"),
    path("manage/upload-image/", ImageUploadView.as_view(), name="manage-upload-image"),
]
