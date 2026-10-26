from django.urls import path

from .views import AuditLogClearView, AuditLogDetailView, AuditLogListView, BasicAssetView, BasicSettingsView, Live2DBundleView

urlpatterns = [
    path("basic/", BasicSettingsView.as_view(), name="manage-basic-site-settings"),
    path("basic/assets/<str:field>/", BasicAssetView.as_view(), name="manage-basic-site-asset"),
    path("basic/live2d/bundles/<str:field>/", Live2DBundleView.as_view(), name="manage-basic-live2d-bundle"),
    path("audit-logs/", AuditLogListView.as_view(), name="manage-audit-log-list"),
    path("audit-logs/clear/", AuditLogClearView.as_view(), name="manage-audit-log-clear"),
    path("audit-logs/<int:pk>/", AuditLogDetailView.as_view(), name="manage-audit-log-detail"),
]
