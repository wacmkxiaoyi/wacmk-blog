from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0035_rename_blog_attach_uploade_bbf6a1_idx_blog_attach_uploade_d29d3b_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="attachment",
            name="download_count",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
