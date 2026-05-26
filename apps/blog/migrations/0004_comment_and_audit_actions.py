from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0003_books_and_post_visibility"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("content", models.TextField()),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to=settings.AUTH_USER_MODEL)),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="replies", to="blog.comment")),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="blog.post")),
            ],
            options={
                "ordering": ["created_at", "pk"],
            },
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["post", "created_at"], name="blog_commen_post_id_5fee65_idx"),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["parent", "created_at"], name="blog_commen_parent__ffc1fe_idx"),
        ),
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
                    ("comment_delete", "Delete comment"),
                    ("profile_update", "Update profile"),
                    ("user_update", "Update user"),
                    ("user_delete", "Delete user"),
                ],
                max_length=32,
            ),
        ),
    ]
