from django.conf import settings
from django.db import models


class ResourcePurchased(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="authorized_resource_purchase_records")
    resource_type = models.CharField(max_length=64)
    object_id = models.PositiveBigIntegerField()
    cost_money = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "resource_purchased"
        ordering = ["-created_at", "-pk"]
        constraints = [models.UniqueConstraint(fields=["user", "resource_type", "object_id"], name="resource_purchased_user_resource_unique")]
        indexes = [models.Index(fields=["resource_type", "object_id", "created_at"], name="res_purchased_type_obj_idx")]


class ResourceGranted(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="authorized_resource_password_grants")
    resource_type = models.CharField(max_length=64)
    object_id = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "resource_granted"
        ordering = ["-created_at", "-pk"]
        constraints = [models.UniqueConstraint(fields=["user", "resource_type", "object_id"], name="resource_granted_user_resource_unique")]
