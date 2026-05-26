from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0002_expand_audit_actions"),
    ]

    operations = [
        migrations.CreateModel(
            name="Book",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=64, unique=True)),
                ("slug", models.SlugField(max_length=80, unique=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="post",
            name="visibility",
            field=models.CharField(
                choices=[("public", "Public"), ("private", "Private")],
                default="public",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="post",
            name="books",
            field=models.ManyToManyField(blank=True, related_name="posts", to="blog.book"),
        ),
    ]
