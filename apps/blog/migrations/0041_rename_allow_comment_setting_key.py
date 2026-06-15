from django.db import migrations


OLD_KEY = "allow_comment"
NEW_KEY = "allow_user_comment"


def rename_allow_comment_setting_key(apps, schema_editor):
    SiteSetting = apps.get_model("blog", "SiteSetting")
    old_entry = SiteSetting.objects.filter(key=OLD_KEY).first()
    if old_entry is None:
        return

    if SiteSetting.objects.filter(key=NEW_KEY).exists():
        old_entry.delete()
        return

    old_entry.key = NEW_KEY
    old_entry.save(update_fields=["key", "updated_at"])


def restore_allow_comment_setting_key(apps, schema_editor):
    SiteSetting = apps.get_model("blog", "SiteSetting")
    new_entry = SiteSetting.objects.filter(key=NEW_KEY).first()
    if new_entry is None:
        return

    if SiteSetting.objects.filter(key=OLD_KEY).exists():
        new_entry.delete()
        return

    new_entry.key = OLD_KEY
    new_entry.save(update_fields=["key", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0040_refactor_sitesetting_to_key_value"),
    ]

    operations = [
        migrations.RunPython(rename_allow_comment_setting_key, restore_allow_comment_setting_key),
    ]
