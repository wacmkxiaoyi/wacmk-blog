from django.conf import settings
from django.db import migrations, models


def migrate_legacy_drafts(apps, schema_editor):
    Post = apps.get_model("blog", "Post")
    PostDraft = apps.get_model("blog", "PostDraft")
    through_tags = PostDraft.tags.through
    through_books = PostDraft.books.through

    legacy_drafts = list(Post.objects.filter(status="draft"))
    for legacy_post in legacy_drafts:
        draft = PostDraft.objects.create(
            title=legacy_post.title,
            slug=legacy_post.slug,
            summary=legacy_post.summary,
            content=legacy_post.content,
            visibility=legacy_post.visibility,
            author_id=legacy_post.author_id,
            created_at=legacy_post.created_at,
            updated_at=legacy_post.updated_at,
        )
        if legacy_post.cover_image:
            draft.cover_image = legacy_post.cover_image.name
            draft.save(update_fields=["cover_image", "updated_at"])
        through_tags.objects.bulk_create(
            [
                through_tags(postdraft_id=draft.pk, tag_id=tag_id)
                for tag_id in legacy_post.tags.values_list("pk", flat=True)
            ]
        )
        through_books.objects.bulk_create(
            [
                through_books(postdraft_id=draft.pk, book_id=book_id)
                for book_id in legacy_post.books.values_list("pk", flat=True)
            ]
        )
        legacy_post.delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("blog", "0007_rename_blog_commen_reply_t_acb85f_idx_blog_commen_reply_t_d4d885_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="PostDraft",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=200)),
                ("slug", models.SlugField(max_length=220)),
                ("summary", models.TextField(blank=True)),
                ("content", models.TextField()),
                ("cover_image", models.ImageField(blank=True, upload_to="blog/covers/")),
                ("visibility", models.CharField(choices=[("public", "Public"), ("private", "Private")], default="public", max_length=16)),
                ("books", models.ManyToManyField(blank=True, related_name="post_drafts", to="blog.book")),
                ("author", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="post_drafts", to=settings.AUTH_USER_MODEL)),
                ("source_post", models.OneToOneField(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name="revision_draft", to="blog.post")),
                ("tags", models.ManyToManyField(blank=True, related_name="post_drafts", to="blog.tag")),
            ],
            options={
                "ordering": ["-updated_at", "-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="postdraft",
            index=models.Index(fields=["updated_at"], name="blog_postdr_updated_31c7c5_idx"),
        ),
        migrations.AddIndex(
            model_name="postdraft",
            index=models.Index(fields=["author", "updated_at"], name="blog_postdr_author__774f43_idx"),
        ),
        migrations.AddIndex(
            model_name="postdraft",
            index=models.Index(fields=["slug"], name="blog_postdr_slug_759c4e_idx"),
        ),
        migrations.RunPython(migrate_legacy_drafts, migrations.RunPython.noop),
    ]
