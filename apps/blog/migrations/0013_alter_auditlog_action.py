from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0012_book_access_and_structure"),
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
                    ("comment_create", "Create comment"),
                    ("comment_update", "Update comment"),
                    ("comment_delete", "Delete comment"),
                    ("profile_update", "Update profile"),
                    ("user_update", "Update user"),
                    ("user_delete", "Delete user"),
                ],
                max_length=32,
            ),
        ),
    ]
