from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0005_comment_reply_to"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PostShareLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("token", models.CharField(max_length=48, unique=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="post_share_links", to=settings.AUTH_USER_MODEL)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="share_links", to="blog.post")),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.CreateModel(
            name="PostFeedback",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("value", models.SmallIntegerField()),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feedback_entries", to="blog.post")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="post_feedback_entries", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.CreateModel(
            name="CommentFeedback",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("value", models.SmallIntegerField()),
                ("comment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feedback_entries", to="blog.comment")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comment_feedback_entries", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddIndex(
            model_name="postsharelink",
            index=models.Index(fields=["token"], name="blog_postsh_token_3de2e4_idx"),
        ),
        migrations.AddIndex(
            model_name="postsharelink",
            index=models.Index(fields=["post", "expires_at"], name="blog_postsh_post_id_136132_idx"),
        ),
        migrations.AddIndex(
            model_name="postfeedback",
            index=models.Index(fields=["post", "value"], name="blog_postfe_post_id_8b991d_idx"),
        ),
        migrations.AddIndex(
            model_name="postfeedback",
            index=models.Index(fields=["user", "value"], name="blog_postfe_user_id_2693ca_idx"),
        ),
        migrations.AddConstraint(
            model_name="postfeedback",
            constraint=models.UniqueConstraint(fields=("post", "user"), name="blog_postfeedback_post_user_unique"),
        ),
        migrations.AddIndex(
            model_name="commentfeedback",
            index=models.Index(fields=["comment", "value"], name="blog_commen_comment_9fbbd2_idx"),
        ),
        migrations.AddIndex(
            model_name="commentfeedback",
            index=models.Index(fields=["user", "value"], name="blog_commen_user_id_9a181a_idx"),
        ),
        migrations.AddConstraint(
            model_name="commentfeedback",
            constraint=models.UniqueConstraint(fields=("comment", "user"), name="blog_commentfeedback_comment_user_unique"),
        ),
    ]
