from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0014_sitesetting_post_editor_autosave"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="book",
            name="view_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="post",
            name="view_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name="ContentViewLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("content_type", models.CharField(choices=[("post", "Post"), ("book", "Book")], max_length=16)),
                ("object_id", models.PositiveBigIntegerField()),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("session_key", models.CharField(blank=True, max_length=40)),
                ("viewed_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="content_view_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-viewed_at", "-pk"],
            },
        ),
        migrations.AddIndex(
            model_name="contentviewlog",
            index=models.Index(fields=["content_type", "object_id", "viewed_at"], name="blog_conten_content_0386da_idx"),
        ),
        migrations.AddIndex(
            model_name="contentviewlog",
            index=models.Index(fields=["content_type", "viewed_at"], name="blog_conten_content_938775_idx"),
        ),
        migrations.AddIndex(
            model_name="contentviewlog",
            index=models.Index(fields=["user", "viewed_at"], name="blog_conten_user_id_9d0553_idx"),
        ),
        migrations.AddIndex(
            model_name="contentviewlog",
            index=models.Index(fields=["ip_address", "viewed_at"], name="blog_conten_ip_addr_bbb905_idx"),
        ),
        migrations.AddIndex(
            model_name="contentviewlog",
            index=models.Index(fields=["session_key", "viewed_at"], name="blog_conten_session_7b3302_idx"),
        ),
    ]
