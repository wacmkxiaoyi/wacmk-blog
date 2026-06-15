from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("blog", "0044_rename_blog_comment_user_id_5cdbfa_idx_blog_commen_user_id_5768bb_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserPointsHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("change_amount", models.IntegerField()),
                ("balance_after", models.IntegerField()),
                ("reason_type", models.CharField(choices=[("daily_login_reward", "Daily login reward"), ("first_comment_reward", "First comment reward"), ("author_reward", "Author reward"), ("admin_adjustment", "Admin adjustment")], max_length=32)),
                ("reason_text", models.CharField(max_length=255)),
                ("related_object_type", models.CharField(blank=True, choices=[("post", "Post"), ("book", "Book"), ("attachment", "Attachment"), ("comment", "Comment"), ("user", "User")], default="", max_length=16)),
                ("related_object_id", models.PositiveIntegerField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="points_histories", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddIndex(
            model_name="userpointshistory",
            index=models.Index(fields=["user", "created_at"], name="blog_userpo_user_id_117e13_idx"),
        ),
        migrations.AddIndex(
            model_name="userpointshistory",
            index=models.Index(fields=["reason_type", "created_at"], name="blog_userpo_reason__0c55ec_idx"),
        ),
        migrations.AddIndex(
            model_name="userpointshistory",
            index=models.Index(fields=["related_object_type", "related_object_id"], name="blog_userpo_related_9a80fe_idx"),
        ),
    ]
