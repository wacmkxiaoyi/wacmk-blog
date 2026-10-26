from django.urls import path

from .views import ResourceAccessCheckView, ResourceAccessFinalizeView, ResourceAccessPasswordView

urlpatterns = [
    path("check/<str:resource_type>/<int:resource_id>/", ResourceAccessCheckView.as_view(), name="resource-access-check"),
    path("check/<str:resource_type>/<int:resource_id>/password/", ResourceAccessPasswordView.as_view(), name="resource-access-password"),
    path("check/<str:resource_type>/<int:resource_id>/finalize/", ResourceAccessFinalizeView.as_view(), name="resource-access-finalize"),
]
