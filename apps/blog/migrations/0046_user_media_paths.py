from django.db import migrations, models

import apps.blog.media_paths


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0045_userpointshistory"),
    ]

    operations = [
        migrations.AlterField(
            model_name="attachment",
            name="file",
            field=models.FileField(upload_to=apps.blog.media_paths.attachment_upload_to),
        ),
        migrations.AlterField(
            model_name="book",
            name="cover_image",
            field=models.ImageField(blank=True, upload_to=apps.blog.media_paths.book_cover_upload_to),
        ),
        migrations.AlterField(
            model_name="post",
            name="cover_image",
            field=models.ImageField(blank=True, upload_to=apps.blog.media_paths.post_cover_upload_to),
        ),
        migrations.AlterField(
            model_name="postdraft",
            name="cover_image",
            field=models.ImageField(blank=True, upload_to=apps.blog.media_paths.post_cover_upload_to),
        ),
    ]
