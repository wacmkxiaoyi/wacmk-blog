from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0017_sitesetting_audit_log_cleanup"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="book",
            name="condition_rules",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="post",
            name="condition_rules",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="postdraft",
            name="condition_rules",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name="book",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("private", "Private"), ("encrypted", "Encrypted"), ("conditional", "Conditional")], default="public", max_length=16),
        ),
        migrations.AlterField(
            model_name="post",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("book_only", "Book only"), ("private", "Private"), ("encrypted", "Encrypted"), ("conditional", "Conditional")], default="public", max_length=16),
        ),
        migrations.AlterField(
            model_name="postdraft",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("book_only", "Book only"), ("private", "Private"), ("encrypted", "Encrypted"), ("conditional", "Conditional")], default="public", max_length=16),
        ),
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(choices=[("login", "Login"), ("logout", "Logout"), ("post_create", "Create post"), ("post_update", "Update post"), ("post_delete", "Delete post"), ("comment_create", "Create comment"), ("comment_update", "Update comment"), ("comment_delete", "Delete comment"), ("profile_update", "Update profile"), ("user_update", "Update user"), ("user_delete", "Delete user"), ("user_asset_update", "Update user assets")], max_length=32),
        ),
        migrations.CreateModel(
            name="BookPurchaseRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cost_money", models.PositiveIntegerField()),
                ("book", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="purchase_records", to="blog.book")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="book_purchase_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.CreateModel(
            name="ArticlePurchaseRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cost_money", models.PositiveIntegerField()),
                ("article", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="purchase_records", to="blog.post")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="article_purchase_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddIndex(
            model_name="bookpurchaserecord",
            index=models.Index(fields=["user", "book"], name="blog_bookpu_user_id_853251_idx"),
        ),
        migrations.AddIndex(
            model_name="bookpurchaserecord",
            index=models.Index(fields=["book", "created_at"], name="blog_bookpu_book_id_098027_idx"),
        ),
        migrations.AddConstraint(
            model_name="bookpurchaserecord",
            constraint=models.UniqueConstraint(fields=("user", "book"), name="blog_bookpurchase_user_book_unique"),
        ),
        migrations.AddIndex(
            model_name="articlepurchaserecord",
            index=models.Index(fields=["user", "article"], name="blog_articl_user_id_0acfb9_idx"),
        ),
        migrations.AddIndex(
            model_name="articlepurchaserecord",
            index=models.Index(fields=["article", "created_at"], name="blog_articl_article_cada46_idx"),
        ),
        migrations.AddConstraint(
            model_name="articlepurchaserecord",
            constraint=models.UniqueConstraint(fields=("user", "article"), name="blog_articlepurchase_user_article_unique"),
        ),
    ]
