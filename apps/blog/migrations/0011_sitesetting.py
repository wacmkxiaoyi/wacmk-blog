from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0010_post_encrypted_access"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("site_title", models.CharField(blank=True, max_length=120)),
                ("site_icon", models.ImageField(blank=True, upload_to="site/")),
                ("auth_background", models.ImageField(blank=True, upload_to="site/")),
                ("app_background", models.ImageField(blank=True, upload_to="site/")),
            ],
            options={
                "verbose_name": "Site setting",
                "verbose_name_plural": "Site settings",
            },
        ),
    ]
