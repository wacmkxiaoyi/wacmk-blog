from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0036_attachment_download_count"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="article_author_reward_money_ratio",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.8"), max_digits=4, validators=[django.core.validators.MinValueValidator(Decimal("0")), django.core.validators.MaxValueValidator(Decimal("1"))]),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="article_author_reward_points_ratio",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=4, validators=[django.core.validators.MinValueValidator(Decimal("0")), django.core.validators.MaxValueValidator(Decimal("1"))]),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="book_author_reward_money_ratio",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.8"), max_digits=4, validators=[django.core.validators.MinValueValidator(Decimal("0")), django.core.validators.MaxValueValidator(Decimal("1"))]),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="book_author_reward_points_ratio",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=4, validators=[django.core.validators.MinValueValidator(Decimal("0")), django.core.validators.MaxValueValidator(Decimal("1"))]),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="attachment_author_reward_money_ratio",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.8"), max_digits=4, validators=[django.core.validators.MinValueValidator(Decimal("0")), django.core.validators.MaxValueValidator(Decimal("1"))]),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="attachment_author_reward_points_ratio",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=4, validators=[django.core.validators.MinValueValidator(Decimal("0")), django.core.validators.MaxValueValidator(Decimal("1"))]),
        ),
        migrations.CreateModel(
            name="AuthorRewardRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("object_type", models.CharField(choices=[("post", "Post"), ("book", "Book"), ("attachment", "Attachment")], max_length=16)),
                ("object_id", models.PositiveIntegerField()),
                ("reward_money", models.PositiveIntegerField(default=0)),
                ("reward_points", models.PositiveIntegerField(default=0)),
                ("author", models.ForeignKey(on_delete=models.CASCADE, related_name="earned_author_reward_records", to=settings.AUTH_USER_MODEL)),
                ("reader", models.ForeignKey(on_delete=models.CASCADE, related_name="author_reward_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddConstraint(
            model_name="authorrewardrecord",
            constraint=models.UniqueConstraint(fields=("reader", "object_type", "object_id"), name="blog_authorreward_reader_object_unique"),
        ),
        migrations.AddIndex(
            model_name="authorrewardrecord",
            index=models.Index(fields=["reader", "object_type", "object_id"], name="blog_author_reader__4c55f5_idx"),
        ),
        migrations.AddIndex(
            model_name="authorrewardrecord",
            index=models.Index(fields=["author", "created_at"], name="blog_author_author__ccb59b_idx"),
        ),
    ]
