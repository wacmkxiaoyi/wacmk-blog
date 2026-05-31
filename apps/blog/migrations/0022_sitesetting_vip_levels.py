from django.core.validators import MaxValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0021_move_access_password_into_condition_rules"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="vip_level_names",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="vip_max_level",
            field=models.PositiveSmallIntegerField(default=3, validators=[MaxValueValidator(20)]),
        ),
    ]
