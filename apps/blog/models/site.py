from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class SiteSetting(TimeStampedModel):
    DASHBOARD_VISIT_TREND_DAYS_7 = 7
    DASHBOARD_VISIT_TREND_DAYS_14 = 14
    DASHBOARD_VISIT_TREND_DAYS_30 = 30
    DASHBOARD_VISIT_TREND_DAY_CHOICES = [
        (DASHBOARD_VISIT_TREND_DAYS_7, _("7 days")),
        (DASHBOARD_VISIT_TREND_DAYS_14, _("14 days")),
        (DASHBOARD_VISIT_TREND_DAYS_30, _("30 days")),
    ]

    site_title = models.CharField(max_length=120, blank=True)
    site_icon = models.ImageField(upload_to="site/", blank=True)
    auth_background = models.ImageField(upload_to="site/", blank=True)
    app_background = models.ImageField(upload_to="site/", blank=True)
    post_editor_autosave_enabled = models.BooleanField(default=True)
    post_editor_autosave_interval_minutes = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
    )
    audit_log_cleanup_enabled = models.BooleanField(default=True)
    audit_log_retention_days = models.PositiveSmallIntegerField(
        default=30,
        validators=[MinValueValidator(1), MaxValueValidator(3650)],
    )
    dashboard_visit_trend_days = models.PositiveSmallIntegerField(
        default=DASHBOARD_VISIT_TREND_DAYS_7,
        choices=DASHBOARD_VISIT_TREND_DAY_CHOICES,
    )

    class Meta:
        verbose_name = _("Site setting")
        verbose_name_plural = _("Site settings")

    def __str__(self):
        return self.site_title or "Site settings"
