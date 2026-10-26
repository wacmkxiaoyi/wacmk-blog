import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name='ContentViewLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_type', models.CharField(choices=[('article', 'Article'), ('book', 'Book')], max_length=16)),
                ('resource_id', models.PositiveBigIntegerField()),
                ('visitor_key', models.CharField(max_length=64)),
                ('viewed_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='content_view_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'content_view_logs',
                'indexes': [models.Index(fields=['resource_type', 'resource_id', 'visitor_key', 'viewed_at'], name='content_view_dedupe_idx'), models.Index(fields=['resource_type', 'viewed_at'], name='content_view_trend_idx')],
            },
        ),
    ]
