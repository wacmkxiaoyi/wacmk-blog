from django.db import migrations, models


POST_BOOK_ONLY = "book_only"
POST_ENCRYPTED = "encrypted"
VISIBILITY_CONDITIONAL = "conditional"


def migrate_legacy_visibility_to_conditions(apps, schema_editor):
    Post = apps.get_model("blog", "Post")
    PostDraft = apps.get_model("blog", "PostDraft")
    Book = apps.get_model("blog", "Book")

    def append_rule(instance, condition_type):
        rules = list(instance.condition_rules or [])
        if not any(isinstance(rule, dict) and str(rule.get("type") or "").strip().lower() == condition_type for rule in rules):
            rules.append({"type": condition_type})
        instance.condition_rules = rules
        instance.visibility = VISIBILITY_CONDITIONAL
        instance.save(update_fields=["condition_rules", "visibility", "updated_at"])

    for post in Post.objects.filter(visibility__in=[POST_BOOK_ONLY, POST_ENCRYPTED]).iterator():
        append_rule(post, post.visibility)

    for draft in PostDraft.objects.filter(visibility__in=[POST_BOOK_ONLY, POST_ENCRYPTED]).iterator():
        append_rule(draft, draft.visibility)

    for book in Book.objects.filter(visibility=POST_ENCRYPTED).iterator():
        append_rule(book, POST_ENCRYPTED)


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0019_rename_blog_articl_user_id_66d900_idx_blog_articl_user_id_0acfb9_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_visibility_to_conditions, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="book",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("private", "Private"), ("conditional", "Conditional")], default="public", max_length=16),
        ),
        migrations.AlterField(
            model_name="post",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("private", "Private"), ("conditional", "Conditional")], default="public", max_length=16),
        ),
        migrations.AlterField(
            model_name="postdraft",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("private", "Private"), ("conditional", "Conditional")], default="public", max_length=16),
        ),
    ]
