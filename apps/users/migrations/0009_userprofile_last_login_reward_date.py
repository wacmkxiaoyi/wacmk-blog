from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_add_show_email_on_namecard"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="last_login_reward_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
