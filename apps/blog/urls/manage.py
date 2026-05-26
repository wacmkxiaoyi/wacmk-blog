from django.urls import path

from apps.blog.views.book import ManageBookCreateView, ManageBookDeleteView, ManageBookListView, ManageBookUpdateView
from apps.blog.views.manage import BlogHomeView, ManageAuditClearView, ManageAuditListView, ManageSiteSettingView, ManageUserDeleteView, ManageUserListView, ManageUserUpdateView
from apps.blog.views.post import ImageUploadView

urlpatterns = [
    path("", BlogHomeView.as_view(), name="blog-home"),
    path("home/", BlogHomeView.as_view(), name="dashboard"),
    path("manage/", ManageSiteSettingView.as_view(), name="manage-home"),
    path("manage/books/", ManageBookListView.as_view(), name="manage-books"),
    path("manage/books/new/", ManageBookCreateView.as_view(), name="manage-book-create"),
    path("manage/books/<int:pk>/edit/", ManageBookUpdateView.as_view(), name="manage-book-update"),
    path("manage/books/<int:pk>/delete/", ManageBookDeleteView.as_view(), name="manage-book-delete"),
    path("manage/users/", ManageUserListView.as_view(), name="manage-users"),
    path("manage/users/<int:pk>/", ManageUserUpdateView.as_view(), name="manage-user-update"),
    path("manage/users/<int:pk>/delete/", ManageUserDeleteView.as_view(), name="manage-user-delete"),
    path("manage/basic/", ManageSiteSettingView.as_view(), name="manage-site-settings"),
    path("manage/audit/clear/", ManageAuditClearView.as_view(), name="manage-audit-clear"),
    path("manage/audit/", ManageAuditListView.as_view(), name="manage-audit"),
    path("manage/upload-image/", ImageUploadView.as_view(), name="manage-upload-image"),
]
