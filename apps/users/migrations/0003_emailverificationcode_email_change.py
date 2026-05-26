from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_userprofile"),
    ]

    operations = [
        migrations.AlterField(
            model_name="emailverificationcode",
            name="purpose",
            field=models.CharField(
                choices=[("register", "register"), ("email_change", "email_change")],
                max_length=32,
            ),
        ),
    ]
