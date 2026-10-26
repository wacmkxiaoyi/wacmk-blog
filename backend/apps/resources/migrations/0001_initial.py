import apps.resources.models
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('tags', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Article',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('visibility', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('condition_rules', models.JSONField(blank=True, default=list)),
                ('access_scope', models.CharField(choices=[('unified', 'Unified'), ('standalone', 'Standalone')], default='unified', max_length=16)),
                ('vip_access_permission', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('vip_condition_rules', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=200)),
                ('slug', models.SlugField(max_length=220, unique=True)),
                ('suppress_detail_hero', models.BooleanField(default=False)),
                ('allow_quote', models.BooleanField(default=True)),
                ('allow_reprint', models.BooleanField(default=False)),
                ('cover_image', models.ImageField(blank=True, upload_to=apps.resources.models.article_cover_upload_to)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('external_link_token', models.CharField(blank=True, default=None, max_length=48, null=True, unique=True)),
                ('external_link_expires_at', models.DateTimeField(blank=True, null=True)),
                ('external_link_password', models.CharField(blank=True, default=None, max_length=255, null=True)),
                ('view_count', models.PositiveBigIntegerField(default=0)),
            ],
            options={
                'db_table': 'articles',
                'ordering': ('-published_at', '-updated_at', '-pk'),
            },
        ),
        migrations.CreateModel(
            name='ArticleDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('visibility', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('condition_rules', models.JSONField(blank=True, default=list)),
                ('access_scope', models.CharField(choices=[('unified', 'Unified'), ('standalone', 'Standalone')], default='unified', max_length=16)),
                ('vip_access_permission', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('vip_condition_rules', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('article_id', models.PositiveBigIntegerField(unique=True)),
                ('title', models.CharField(max_length=200)),
                ('slug', models.SlugField(max_length=220, unique=True)),
                ('abstract', models.TextField(blank=True, default='')),
                ('content', models.TextField(blank=True, default='')),
                ('suppress_detail_hero', models.BooleanField(default=False)),
                ('allow_quote', models.BooleanField(default=True)),
                ('allow_reprint', models.BooleanField(default=False)),
                ('cover_image', models.ImageField(blank=True, upload_to=apps.resources.models.article_cover_upload_to)),
            ],
            options={
                'db_table': 'article_drafts',
                'ordering': ('-updated_at', '-pk'),
            },
        ),
        migrations.CreateModel(
            name='ArticleIdentity',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ],
            options={
                'db_table': 'article_identities',
            },
        ),
        migrations.CreateModel(
            name='Attachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('visibility', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('condition_rules', models.JSONField(blank=True, default=list)),
                ('access_scope', models.CharField(choices=[('unified', 'Unified'), ('standalone', 'Standalone')], default='unified', max_length=16)),
                ('vip_access_permission', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('vip_condition_rules', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=255)),
                ('original_filename', models.CharField(max_length=255)),
                ('mime_type', models.CharField(blank=True, default='', max_length=255)),
                ('file_size', models.PositiveBigIntegerField(default=0)),
                ('file_ext', models.CharField(blank=True, default='', max_length=32)),
                ('usage_count', models.PositiveIntegerField(default=0)),
                ('download_count', models.PositiveIntegerField(default=0)),
                ('last_referenced_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'db_table': 'attachments',
                'ordering': ('-updated_at', '-pk'),
            },
        ),
        migrations.CreateModel(
            name='Book',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('visibility', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('condition_rules', models.JSONField(blank=True, default=list)),
                ('access_scope', models.CharField(choices=[('unified', 'Unified'), ('standalone', 'Standalone')], default='unified', max_length=16)),
                ('vip_access_permission', models.CharField(choices=[('public', 'Public'), ('private', 'Private'), ('conditional', 'Conditional')], default='public', max_length=16)),
                ('vip_condition_rules', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=64, unique=True)),
                ('slug', models.SlugField(max_length=80, unique=True)),
                ('cover_image', models.ImageField(blank=True, upload_to=apps.resources.models.book_cover_upload_to)),
                ('structure', models.JSONField(blank=True, default=list)),
                ('external_link_token', models.CharField(blank=True, default=None, max_length=48, null=True, unique=True)),
                ('external_link_expires_at', models.DateTimeField(blank=True, null=True)),
                ('external_link_password', models.CharField(blank=True, default=None, max_length=255, null=True)),
                ('view_count', models.PositiveBigIntegerField(default=0)),
            ],
            options={
                'db_table': 'books',
                'ordering': ('-updated_at', '-pk'),
            },
        ),
        migrations.CreateModel(
            name='MediaAsset',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('kind', models.CharField(choices=[('image', 'Image'), ('video', 'Video'), ('attachment', 'Attachment')], max_length=16)),
                ('file', models.FileField(upload_to=apps.resources.models.media_asset_upload_to)),
                ('storage_key', models.CharField(blank=True, editable=False, max_length=512)),
                ('original_filename', models.CharField(max_length=255)),
                ('media_type', models.CharField(blank=True, default='', max_length=255)),
                ('file_size', models.PositiveBigIntegerField(default=0)),
                ('checksum', models.CharField(blank=True, default='', max_length=128)),
                ('status', models.CharField(choices=[('ready', 'Ready'), ('quarantined', 'Quarantined'), ('deleted', 'Deleted')], default='ready', max_length=16)),
            ],
            options={
                'db_table': 'media_assets',
                'ordering': ('-updated_at',),
            },
        ),
        migrations.CreateModel(
            name='MediaAssetReference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resource_type', models.CharField(max_length=16)),
                ('resource_id', models.PositiveBigIntegerField()),
                ('usage', models.CharField(default='body', max_length=32)),
            ],
            options={
                'db_table': 'media_asset_references',
            },
        ),
        migrations.CreateModel(
            name='ResourceGranted',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_type', models.CharField(max_length=64)),
                ('object_id', models.PositiveBigIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'resource_granted',
                'ordering': ['-created_at', '-pk'],
            },
        ),
        migrations.CreateModel(
            name='ResourcePurchased',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_type', models.CharField(max_length=64)),
                ('object_id', models.PositiveBigIntegerField()),
                ('cost_money', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'resource_purchased',
                'ordering': ['-created_at', '-pk'],
            },
        ),
        migrations.CreateModel(
            name='ResourceStar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_type', models.CharField(choices=[('article', 'Article'), ('book', 'Book')], max_length=16)),
                ('resource_id', models.PositiveBigIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'resource_stars',
            },
        ),
        migrations.CreateModel(
            name='ResourceVote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_type', models.CharField(choices=[('article', 'Article'), ('book', 'Book')], max_length=16)),
                ('resource_id', models.PositiveBigIntegerField()),
                ('vote', models.CharField(choices=[('up', 'Up'), ('down', 'Down')], max_length=4)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'resource_votes',
            },
        ),
        migrations.AddField(model_name='article', name='author', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='articles', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='article', name='tags', field=models.ManyToManyField(blank=True, related_name='articles', to='tags.tag')),
        migrations.AddField(model_name='articledraft', name='author', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='article_drafts', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='articledraft', name='tags', field=models.ManyToManyField(blank=True, related_name='article_drafts', to='tags.tag')),
        migrations.AddField(model_name='attachment', name='uploaded_by', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='book', name='created_by', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='books', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='article', name='books', field=models.ManyToManyField(blank=True, related_name='articles', to='resources.book')),
        migrations.AddField(model_name='mediaasset', name='uploaded_by', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='media_assets', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='attachment', name='asset', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='attachments', to='resources.mediaasset')),
        migrations.AddField(model_name='mediaassetreference', name='asset', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='references', to='resources.mediaasset')),
        migrations.AddField(model_name='resourcegranted', name='user', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='authorized_resource_password_grants', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='resourcepurchased', name='user', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='authorized_resource_purchase_records', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='resourcestar', name='user', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='resource_stars', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='resourcevote', name='user', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='resource_votes', to=settings.AUTH_USER_MODEL)),
        migrations.AddIndex(model_name='article', index=models.Index(fields=['published_at'], name='articles_published_idx')),
        migrations.AddIndex(model_name='article', index=models.Index(fields=['author', 'updated_at'], name='articles_author__fb0148_idx')),
        migrations.AddIndex(model_name='articledraft', index=models.Index(fields=['author', 'updated_at'], name='article_drafts_author_idx')),
        migrations.AddIndex(model_name='articledraft', index=models.Index(fields=['article_id', 'updated_at'], name='article_drafts_article_idx')),
        migrations.AddIndex(model_name='attachment', index=models.Index(fields=['uploaded_by', 'updated_at'], name='attachments_uploade_c795c1_idx')),
        migrations.AddIndex(model_name='book', index=models.Index(fields=['created_by', 'updated_at'], name='books_created_4f509f_idx')),
        migrations.AddIndex(model_name='mediaasset', index=models.Index(fields=['uploaded_by', 'kind', 'updated_at'], name='media_asset_owner_kind_idx')),
        migrations.AddIndex(model_name='mediaassetreference', index=models.Index(fields=['resource_type', 'resource_id'], name='media_asset_ref_resource_idx')),
        migrations.AddConstraint(model_name='mediaassetreference', constraint=models.UniqueConstraint(fields=('asset', 'resource_type', 'resource_id', 'usage'), name='media_asset_reference_unique')),
        migrations.AddConstraint(model_name='resourcegranted', constraint=models.UniqueConstraint(fields=('user', 'resource_type', 'object_id'), name='resource_granted_user_resource_unique')),
        migrations.AddIndex(model_name='resourcepurchased', index=models.Index(fields=['resource_type', 'object_id', 'created_at'], name='res_purchased_type_obj_idx')),
        migrations.AddConstraint(model_name='resourcepurchased', constraint=models.UniqueConstraint(fields=('user', 'resource_type', 'object_id'), name='resource_purchased_user_resource_unique')),
        migrations.AddIndex(model_name='resourcestar', index=models.Index(fields=['resource_type', 'resource_id'], name='resource_star_resource_idx')),
        migrations.AddConstraint(model_name='resourcestar', constraint=models.UniqueConstraint(fields=('resource_type', 'resource_id', 'user'), name='resource_star_unique')),
        migrations.AddIndex(model_name='resourcevote', index=models.Index(fields=['resource_type', 'resource_id', 'vote'], name='resource_vote_resource_idx')),
        migrations.AddConstraint(model_name='resourcevote', constraint=models.UniqueConstraint(fields=('resource_type', 'resource_id', 'user'), name='resource_vote_unique')),
    ]
