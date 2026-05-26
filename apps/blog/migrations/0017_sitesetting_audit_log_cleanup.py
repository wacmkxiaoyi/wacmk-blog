from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0016_sitesetting_dashboard_visit_trend_days"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="audit_log_cleanup_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="audit_log_retention_days",
            field=models.PositiveSmallIntegerField(
                default=30,
                validators=[MinValueValidator(1), MaxValueValidator(3650)],
            ),
        ),
    ]
