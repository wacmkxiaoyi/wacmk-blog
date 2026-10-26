from django.core.paginator import Paginator
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.site_settings.application.settings_service import SiteSettingsService
from apps.site_settings.application.assets_service import SiteAssetsService
from apps.site_settings.application.audit_service import AuditLogService
from apps.site_settings.models import AuditLog
from .serializers import BasicSettingsSerializer


class IsSiteManager(permissions.BasePermission):
    message = "Site manager permission is required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser))


class BasicSettingsView(APIView):
    permission_classes = (IsSiteManager,)

    def get(self, request):
        return Response({"section": "basic", "values": SiteSettingsService.get_management_section("basic")})

    def patch(self, request):
        serializer = BasicSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        SiteSettingsService.update_section("basic", serializer.validated_data["values"], request.user, request)
        return Response({"section": "basic", "values": SiteSettingsService.get_management_section("basic")})

    def delete(self, request):
        return Response({"section": "basic", "values": SiteSettingsService.reset_section("basic", request.user, request)}, status=status.HTTP_200_OK)


class BasicAssetView(APIView):
    permission_classes = (IsSiteManager,)

    def post(self, request, field):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"detail": "An image file is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            SiteAssetsService.upload(field, upload, request.user, request)
            return Response({"assets": SiteSettingsService.get_management_section("basic")["basic.assets"]})
        except Exception as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, field):
        try:
            SiteAssetsService.remove(field, request.user, request)
            return Response({"assets": SiteSettingsService.get_management_section("basic")["basic.assets"]})
        except Exception as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)


class Live2DBundleView(APIView):
    permission_classes = (IsSiteManager,)

    def post(self, request, field):
        upload = request.FILES.get("file")
        try:
            SiteAssetsService.upload_bundle(field, upload, request.user, request)
            return Response({"live2d": SiteSettingsService.get_management_section("basic")["basic.live2d"]})
        except Exception as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, field):
        try:
            SiteAssetsService.remove_bundle(field, request.user, request)
            return Response({"live2d": SiteSettingsService.get_management_section("basic")["basic.live2d"]})
        except Exception as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)


class AuditLogListView(APIView):
    permission_classes = (IsSiteManager,)
    ordering_fields = {"created_at", "action", "actor"}

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 30))))
        except ValueError:
            return Response({"detail": "page and page_size must be integers."}, status=status.HTTP_400_BAD_REQUEST)
        ordering = request.query_params.get("ordering", "-created_at")
        if ordering.lstrip("-") not in self.ordering_fields:
            ordering = "-created_at"
        actor_order = "actor__username" if ordering.lstrip("-") == "actor" else ordering.lstrip("-")
        if ordering.startswith("-"):
            actor_order = f"-{actor_order}"
        created_after = self.parse_date(request.query_params.get("created_after"))
        created_before = self.parse_date(request.query_params.get("created_before"))
        if request.query_params.get("created_after") and created_after is None:
            return Response({"detail": "created_after must be an ISO 8601 datetime."}, status=status.HTTP_400_BAD_REQUEST)
        if request.query_params.get("created_before") and created_before is None:
            return Response({"detail": "created_before must be an ISO 8601 datetime."}, status=status.HTTP_400_BAD_REQUEST)
        logs = AuditLogService.filtered_queryset(
            query=request.query_params.get("query", "").strip(),
            action=request.query_params.get("action", "").strip(),
            actor_id=request.query_params.get("actor_id"),
            created_after=created_after,
            created_before=created_before,
        ).order_by(actor_order, "-id")
        result = Paginator(logs, page_size).get_page(page)
        return Response({"items": [self.serialize(log) for log in result.object_list], "total": result.paginator.count})

    @staticmethod
    def parse_date(value):
        return parse_datetime(value) if value else None

    @staticmethod
    def serialize(log):
        return {
            "id": log.id,
            "action": log.action,
            "summary": log.summary,
            "actor": {"id": log.actor_id, "username": log.actor.username, "email": log.actor.email} if log.actor else None,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }


class AuditLogDetailView(APIView):
    permission_classes = (IsSiteManager,)

    def get(self, request, pk):
        log = AuditLog.objects.select_related("actor").filter(pk=pk).first()
        if log is None:
            return Response({"detail": "Audit log not found."}, status=status.HTTP_404_NOT_FOUND)
        payload = AuditLogListView.serialize(log)
        payload.update({"metadata": log.metadata, "user_agent": log.user_agent})
        return Response(payload)


class AuditLogClearView(APIView):
    permission_classes = (IsSiteManager,)

    def post(self, request):
        logs = AuditLog.objects.all()
        deleted_count, _ = logs.delete()
        AuditLogService.record(
            action="audit_logs.cleared",
            summary="Audit logs cleared manually",
            actor=request.user,
            metadata={"deleted_count": deleted_count},
            request=request,
        )
        return Response({"deleted_count": deleted_count})
