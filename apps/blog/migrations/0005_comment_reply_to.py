from django.db import migrations, models
import django.db.models.deletion


def populate_comment_reply_to(apps, schema_editor):
    Comment = apps.get_model("blog", "Comment")
    Comment.objects.exclude(parent_id=None).filter(reply_to_id=None).update(reply_to=models.F("parent"))


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0004_comment_and_audit_actions"),
    ]

    operations = [
        migrations.AddField(
            model_name="comment",
            name="reply_to",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="direct_replies",
                to="blog.comment",
            ),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["reply_to", "created_at"], name="blog_commen_reply_t_acb85f_idx"),
        ),
        migrations.RunPython(populate_comment_reply_to, migrations.RunPython.noop),
    ]
