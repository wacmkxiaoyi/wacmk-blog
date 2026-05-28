from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_emailverificationcode_email_change"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="money",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="points",
            field=models.IntegerField(default=0),
        ),
    ]
