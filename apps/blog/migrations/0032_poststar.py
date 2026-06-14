from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0031_add_allow_reprint_and_allow_quote"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PostStar",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("post", models.ForeignKey(on_delete=models.CASCADE, related_name="star_entries", to="blog.post")),
                ("user", models.ForeignKey(on_delete=models.CASCADE, related_name="post_star_entries", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
                "indexes": [models.Index(fields=["post", "created_at"], name="blog_postst_post_id_14e554_idx"), models.Index(fields=["user", "created_at"], name="blog_postst_user_id_9016bb_idx")],
                "constraints": [models.UniqueConstraint(fields=("post", "user"), name="blog_poststar_post_user_unique")],
            },
        ),
    ]
