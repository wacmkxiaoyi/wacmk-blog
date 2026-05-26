from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("login", "Login"),
                    ("logout", "Logout"),
                    ("post_create", "Create post"),
                    ("post_update", "Update post"),
                    ("post_delete", "Delete post"),
                    ("profile_update", "Update profile"),
                    ("user_update", "Update user"),
                    ("user_delete", "Delete user"),
                ],
                max_length=32,
            ),
        ),
    ]
