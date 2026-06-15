from django.db import models
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class SiteSetting(TimeStampedModel):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = _("Site setting")
        verbose_name_plural = _("Site settings")
        ordering = ["key"]

    def __str__(self):
        return self.key
