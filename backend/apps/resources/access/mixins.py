from django.db import models


class AccessControlledResourceMixin(models.Model):
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CONDITIONAL = "conditional"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, "Public"),
        (VISIBILITY_PRIVATE, "Private"),
        (VISIBILITY_CONDITIONAL, "Conditional"),
    ]

    ACCESS_SCOPE_UNIFIED = "unified"
    ACCESS_SCOPE_STANDALONE = "standalone"
    ACCESS_SCOPE_CHOICES = [
        (ACCESS_SCOPE_UNIFIED, "Unified"),
        (ACCESS_SCOPE_STANDALONE, "Standalone"),
    ]

    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    condition_rules = models.JSONField(default=list, blank=True)
    access_scope = models.CharField(max_length=16, choices=ACCESS_SCOPE_CHOICES, default=ACCESS_SCOPE_UNIFIED)
    vip_access_permission = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    vip_condition_rules = models.JSONField(default=list, blank=True)

    class Meta:
        abstract = True
