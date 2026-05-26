from django.contrib.auth.models import AnonymousUser

from apps.blog.models import AuditLog

from .request import get_client_ip


def write_audit_log(request, action, message, user=None):
    actor = user if user is not None else getattr(request, "user", None)
    if isinstance(actor, AnonymousUser):
        actor = None
    AuditLog.objects.create(
        user=actor,
        action=action,
        message=message,
        ip_address=get_client_ip(request),
    )
