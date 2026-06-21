from django.db import migrations


def rename_live2d_widget_bundle_keys(apps, schema_editor):
    SiteSetting = apps.get_model("blog", "SiteSetting")
    rename_map = {
        "live2d_bundle_file": "live2d_widget_bundle_file",
        "live2d_bundle_manifest": "live2d_widget_bundle_manifest",
        "live2d_bundle_extract_root": "live2d_widget_bundle_extract_root",
    }
    for old_key, new_key in rename_map.items():
        SiteSetting.objects.filter(key=new_key).delete()
        SiteSetting.objects.filter(key=old_key).update(key=new_key)


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0048_mediacleanupjob"),
    ]

    operations = [
        migrations.RunPython(rename_live2d_widget_bundle_keys, migrations.RunPython.noop),
    ]
