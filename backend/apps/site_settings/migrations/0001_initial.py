import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name='AuditCleanupRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source', models.CharField(default='scheduled', max_length=32)),
                ('status', models.CharField(choices=[('running', 'Running'), ('succeeded', 'Succeeded'), ('failed', 'Failed')], default='running', max_length=16)),
                ('retention_days', models.PositiveIntegerField()),
                ('cutoff_at', models.DateTimeField()),
                ('deleted_count', models.PositiveIntegerField(default=0)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True)),
            ],
            options={
                'db_table': 'site_settings_audit_cleanup_runs',
                'ordering': ('-started_at', '-id'),
            },
        ),
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=64)),
                ('summary', models.CharField(max_length=255)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=512)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='site_settings_audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'site_settings_audit_logs',
                'ordering': ('-created_at', '-id'),
                'indexes': [models.Index(fields=['-created_at', '-id'], name='site_audit_created_idx'), models.Index(fields=['action', '-created_at'], name='site_audit_action_idx'), models.Index(fields=['actor', '-created_at'], name='site_audit_actor_idx')],
            },
        ),
        migrations.CreateModel(
            name='SiteSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=128, unique=True)),
                ('value', models.JSONField()),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_site_settings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'site_settings',
                'ordering': ('key',),
            },
        ),
    ]
