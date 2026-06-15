from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("blog", "0042_commentrewardrecord_and_comment_reward_settings"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserMoneyHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("change_amount", models.IntegerField()),
                ("balance_after", models.IntegerField()),
                ("reason_type", models.CharField(choices=[("daily_login_reward", "Daily login reward"), ("first_comment_reward", "First comment reward"), ("author_reward", "Author reward"), ("content_purchase", "Content purchase"), ("admin_adjustment", "Admin adjustment")], max_length=32)),
                ("reason_text", models.CharField(max_length=255)),
                ("related_object_type", models.CharField(blank=True, choices=[("post", "Post"), ("book", "Book"), ("attachment", "Attachment"), ("comment", "Comment"), ("user", "User")], default="", max_length=16)),
                ("related_object_id", models.PositiveIntegerField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="money_histories", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddIndex(
            model_name="usermoneyhistory",
            index=models.Index(fields=["user", "created_at"], name="blog_usermo_user_id_347fd3_idx"),
        ),
        migrations.AddIndex(
            model_name="usermoneyhistory",
            index=models.Index(fields=["reason_type", "created_at"], name="blog_usermo_reason__96012b_idx"),
        ),
        migrations.AddIndex(
            model_name="usermoneyhistory",
            index=models.Index(fields=["related_object_type", "related_object_id"], name="blog_usermo_related_e6e20b_idx"),
        ),
    ]
