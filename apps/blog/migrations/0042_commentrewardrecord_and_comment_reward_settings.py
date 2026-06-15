from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("blog", "0041_rename_allow_comment_setting_key"),
    ]

    operations = [
        migrations.CreateModel(
            name="CommentRewardRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reward_money", models.PositiveIntegerField(default=0)),
                ("reward_points", models.PositiveIntegerField(default=0)),
                ("comment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reward_records", to="blog.comment")),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comment_reward_records", to="blog.post")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comment_reward_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddConstraint(
            model_name="commentrewardrecord",
            constraint=models.UniqueConstraint(fields=("user", "post"), name="blog_commentreward_user_post_unique"),
        ),
        migrations.AddIndex(
            model_name="commentrewardrecord",
            index=models.Index(fields=["user", "post"], name="blog_comment_user_id_5cdbfa_idx"),
        ),
        migrations.AddIndex(
            model_name="commentrewardrecord",
            index=models.Index(fields=["post", "created_at"], name="blog_comment_post_id_f11192_idx"),
        ),
    ]
