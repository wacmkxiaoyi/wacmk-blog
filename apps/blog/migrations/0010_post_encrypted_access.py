from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0009_rename_blog_postdr_updated_31c7c5_idx_blog_postdr_updated_9f8201_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="access_password",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="postdraft",
            name="access_password",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AlterField(
            model_name="post",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("private", "Private"), ("encrypted", "Encrypted")], default="public", max_length=16),
        ),
        migrations.AlterField(
            model_name="postdraft",
            name="visibility",
            field=models.CharField(choices=[("public", "Public"), ("private", "Private"), ("encrypted", "Encrypted")], default="public", max_length=16),
        ),
    ]
