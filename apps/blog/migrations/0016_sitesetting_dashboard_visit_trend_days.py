from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0015_post_book_view_counts"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="dashboard_visit_trend_days",
            field=models.PositiveSmallIntegerField(
                choices=[(7, "7 days"), (14, "14 days"), (30, "30 days")],
                default=7,
            ),
        ),
    ]
