from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0032_poststar"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BookStar",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("book", models.ForeignKey(on_delete=models.CASCADE, related_name="star_entries", to="blog.book")),
                ("user", models.ForeignKey(on_delete=models.CASCADE, related_name="book_star_entries", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
                "indexes": [
                    models.Index(fields=["book", "created_at"], name="blog_bookstar_book_created_idx"),
                    models.Index(fields=["user", "created_at"], name="blog_bookstar_user_created_idx"),
                ],
                "constraints": [models.UniqueConstraint(fields=("book", "user"), name="blog_bookstar_book_user_unique")],
            },
        ),
    ]
