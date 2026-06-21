from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0047_rename_blog_userpo_user_id_117e13_idx_blog_userpo_user_id_3e1dac_idx_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MediaCleanupJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("running", "Running"), ("succeeded", "Succeeded"), ("failed", "Failed")], default="pending", max_length=16)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("scanned_file_count", models.PositiveIntegerField(default=0)),
                ("kept_file_count", models.PositiveIntegerField(default=0)),
                ("deleted_file_count", models.PositiveIntegerField(default=0)),
                ("deleted_directory_count", models.PositiveIntegerField(default=0)),
                ("referenced_path_count", models.PositiveIntegerField(default=0)),
                ("error_message", models.TextField(blank=True, default="")),
                ("result_summary", models.TextField(blank=True, default="")),
                ("requested_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="requested_media_cleanup_jobs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Media cleanup job",
                "verbose_name_plural": "Media cleanup jobs",
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddIndex(
            model_name="mediacleanupjob",
            index=models.Index(fields=["status", "created_at"], name="blog_mediac_status_29e1e8_idx"),
        ),
        migrations.AddIndex(
            model_name="mediacleanupjob",
            index=models.Index(fields=["requested_by", "created_at"], name="blog_mediac_request_958ee4_idx"),
        ),
    ]
