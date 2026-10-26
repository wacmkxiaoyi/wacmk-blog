from datetime import timedelta
from hashlib import sha256

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import ContentViewLog


VIEW_COOLDOWN = timedelta(minutes=30)


def visitor_key_for(request):
    if getattr(request.user, "is_authenticated", False):
        source = f"user:{request.user.pk}"
    else:
        source = f"ip:{request.META.get('REMOTE_ADDR', '')}"
    return sha256(source.encode("utf-8")).hexdigest()


def record_content_view(request, resource, resource_type):
    """Persist one view per visitor/resource within the cooldown window."""
    now = timezone.now()
    visitor_key = visitor_key_for(request)
    with transaction.atomic():
        # Serialize records for this resource so concurrent requests cannot both
        # pass the cooldown check before either one creates its view log.
        resource = resource.__class__.objects.select_for_update().get(pk=resource.pk)
        exists = ContentViewLog.objects.filter(
            resource_type=resource_type,
            resource_id=resource.pk,
            visitor_key=visitor_key,
            viewed_at__gte=now - VIEW_COOLDOWN,
        ).exists()
        if exists:
            return False
        ContentViewLog.objects.create(
            resource_type=resource_type,
            resource_id=resource.pk,
            user=request.user if getattr(request.user, "is_authenticated", False) else None,
            visitor_key=visitor_key,
        )
        resource.__class__.objects.filter(pk=resource.pk).update(view_count=F("view_count") + 1)
    return True
