from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def assign_book_creators(apps, schema_editor):
    Book = apps.get_model("blog", "Book")
    User = apps.get_model(settings.AUTH_USER_MODEL.split(".")[0], settings.AUTH_USER_MODEL.split(".")[1])
    fallback_user = User.objects.order_by("is_superuser", "is_staff", "id").last() or User.objects.order_by("id").first()
    if fallback_user is None:
        return
    for book in Book.objects.filter(created_by__isnull=True):
        related_post = book.posts.order_by("id").first()
        book.created_by_id = related_post.author_id if related_post is not None else fallback_user.pk
        book.save(update_fields=["created_by"])


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0011_sitesetting"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="book",
            name="summary",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="book",
            name="cover_image",
            field=models.ImageField(blank=True, upload_to="blog/book-covers/"),
        ),
        migrations.AddField(
            model_name="book",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("private", "Private"), ("encrypted", "Encrypted")], default="public", max_length=16),
        ),
        migrations.AddField(
            model_name="book",
            name="access_password",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="book",
            name="structure",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="book",
            name="created_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="created_books", to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(assign_book_creators, migrations.RunPython.noop),
        migrations.CreateModel(
            name="BookShareLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("token", models.CharField(max_length=48, unique=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("book", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="share_links", to="blog.book")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="book_share_links", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
            },
        ),
        migrations.AddIndex(
            model_name="booksharelink",
            index=models.Index(fields=["token"], name="blog_booksh_token_83001a_idx"),
        ),
        migrations.AddIndex(
            model_name="booksharelink",
            index=models.Index(fields=["book", "expires_at"], name="blog_booksh_book_id_12b30f_idx"),
        ),
    ]
