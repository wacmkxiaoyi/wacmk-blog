from django.db import migrations


CONDITION_TYPE_ENCRYPTED = "encrypted"


def move_passwords_into_condition_rules(apps, schema_editor):
    Post = apps.get_model("blog", "Post")
    PostDraft = apps.get_model("blog", "PostDraft")
    Book = apps.get_model("blog", "Book")

    def migrate_instance(instance):
        rules = list(instance.condition_rules or [])
        encrypted_rule = None
        for rule in rules:
            if isinstance(rule, dict) and str(rule.get("type") or "").strip().lower() == CONDITION_TYPE_ENCRYPTED:
                encrypted_rule = rule
                break
        if encrypted_rule is not None and getattr(instance, "access_password", ""):
            encrypted_rule["value"] = instance.access_password
            instance.condition_rules = rules
            instance.save(update_fields=["condition_rules", "updated_at"])

    for model in [Post, PostDraft, Book]:
        for instance in model.objects.all().iterator():
            migrate_instance(instance)


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0020_conditional_visibility_cleanup"),
    ]

    operations = [
        migrations.RunPython(move_passwords_into_condition_rules, migrations.RunPython.noop),
        migrations.RemoveField(model_name="post", name="access_password"),
        migrations.RemoveField(model_name="postdraft", name="access_password"),
        migrations.RemoveField(model_name="book", name="access_password"),
    ]
