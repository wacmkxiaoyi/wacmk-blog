from copy import deepcopy

from django.db.models import Q

from apps.site_settings.models import AuditLog


SENSITIVE_FIELD_NAMES = {"api_key", "password", "secret", "token"}


def request_metadata(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip_address = forwarded_for.split(",", 1)[0].strip() if forwarded_for else request.META.get("REMOTE_ADDR")
    return {
        "ip_address": ip_address or None,
        "user_agent": request.META.get("HTTP_USER_AGENT", "")[:512],
    }


def redact_value(value, field_name=""):
    if field_name.lower() in SENSITIVE_FIELD_NAMES:
        return "[redacted]" if value else ""
    if isinstance(value, dict):
        return {key: redact_value(item, key) for key, item in value.items()}
    if isinstance(value, list):
        return [redact_value(item, field_name) for item in value]
    return deepcopy(value)


class AuditLogService:
    @staticmethod
    def record(*, action, summary, actor=None, metadata=None, request=None):
        context = request_metadata(request) if request is not None else {}
        return AuditLog.objects.create(
            actor=actor,
            action=action,
            summary=summary,
            metadata=redact_value(metadata or {}),
            **context,
        )

    @staticmethod
    def filtered_queryset(*, query="", action="", actor_id=None, created_after=None, created_before=None):
        logs = AuditLog.objects.select_related("actor")
        if query:
            logs = logs.filter(
                Q(summary__icontains=query)
                | Q(action__icontains=query)
                | Q(actor__username__icontains=query)
                | Q(actor__email__icontains=query)
            )
        if action:
            logs = logs.filter(action=action)
        if actor_id:
            logs = logs.filter(actor_id=actor_id)
        if created_after:
            logs = logs.filter(created_at__gte=created_after)
        if created_before:
            logs = logs.filter(created_at__lte=created_before)
        return logs
