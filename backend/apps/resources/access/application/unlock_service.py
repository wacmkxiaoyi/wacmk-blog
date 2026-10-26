from dataclasses import dataclass

from django.contrib.auth.hashers import check_password
from ..infrastructure.models import ResourceGranted, ResourcePurchased


@dataclass(frozen=True)
class UnlockState:
    has_purchase: bool = False
    has_password_grant: bool = False


class UnlockService:
    @staticmethod
    def get_unlock_state(resource, identity, *, resource_type):
        if not identity.is_authenticated:
            return UnlockState()
        has_purchase = ResourcePurchased.objects.filter(user_id=identity.user_id, resource_type=resource_type, object_id=resource.pk).exists()
        has_password_grant = ResourceGranted.objects.filter(user_id=identity.user_id, resource_type=resource_type, object_id=resource.pk).exists()
        return UnlockState(has_purchase=has_purchase, has_password_grant=has_password_grant)

    @staticmethod
    def verify_password(resource, identity, password_hash, raw_password, *, resource_type):
        if not identity.is_authenticated:
            return False
        if not password_hash or not check_password(raw_password or "", password_hash):
            return False
        ResourceGranted.objects.get_or_create(user_id=identity.user_id, resource_type=resource_type, object_id=resource.pk)
        return True
