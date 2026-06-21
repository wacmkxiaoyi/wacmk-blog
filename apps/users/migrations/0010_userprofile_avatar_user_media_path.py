from django.db import migrations, models

import apps.blog.media_paths


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0009_userprofile_last_login_reward_date"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="avatar",
            field=models.ImageField(blank=True, upload_to=apps.blog.media_paths.avatar_upload_to),
        ),
    ]
