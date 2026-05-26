from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0013_alter_auditlog_action"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="post_editor_autosave_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="post_editor_autosave_interval_minutes",
            field=models.PositiveSmallIntegerField(
                default=5,
                validators=[MinValueValidator(1), MaxValueValidator(60)],
            ),
        ),
    ]
