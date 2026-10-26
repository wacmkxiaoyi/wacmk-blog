import apps.users.models
import django.contrib.auth.models
import django.contrib.auth.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('username', models.CharField(error_messages={'unique': 'A user with that username already exists.'}, help_text='Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.', max_length=150, unique=True, validators=[django.contrib.auth.validators.UnicodeUsernameValidator()], verbose_name='username')),
                ('first_name', models.CharField(blank=True, max_length=150, verbose_name='first name')),
                ('last_name', models.CharField(blank=True, max_length=150, verbose_name='last name')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('is_active', models.BooleanField(default=True, help_text='Designates whether this user should be treated as active. Unselect this instead of deleting accounts.', verbose_name='active')),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('email', models.EmailField(max_length=254, unique=True, verbose_name='email address')),
                ('money_balance', models.PositiveBigIntegerField(default=0)),
                ('points_balance', models.PositiveBigIntegerField(default=0)),
                ('last_login_reward_date', models.DateField(blank=True, null=True)),
                ('avatar', models.ImageField(blank=True, upload_to=apps.users.models.avatar_upload_to)),
                ('description', models.TextField(blank=True, default='', max_length=500)),
                ('gender', models.CharField(blank=True, choices=[('', 'Unspecified'), ('male', 'Male'), ('female', 'Female'), ('other', 'Other')], default='', max_length=16)),
                ('age', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('github', models.URLField(blank=True, default='', max_length=255)),
                ('website', models.URLField(blank=True, default='', max_length=255)),
                ('twitter', models.URLField(blank=True, default='', max_length=255)),
                ('qq', models.CharField(blank=True, default='', max_length=20)),
                ('show_email_on_namecard', models.BooleanField(default=False)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'verbose_name': 'user',
                'verbose_name_plural': 'users',
                'db_table': 'users',
            },
            managers=[
                ('objects', django.contrib.auth.models.UserManager()),
            ],
        ),
        migrations.CreateModel(
            name='EmailVerificationCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('code', models.CharField(max_length=6)),
                ('purpose', models.CharField(choices=[('register', 'register'), ('email_change', 'email_change')], max_length=32)),
                ('expires_at', models.DateTimeField()),
                ('consumed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['email', 'purpose', 'created_at'], name='users_email_email_b72057_idx')],
            },
        ),
        migrations.CreateModel(
            name='PasswordResetCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=6)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reset_codes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'password reset code',
                'verbose_name_plural': 'password reset codes',
                'db_table': 'password_reset_codes',
            },
        ),
        migrations.CreateModel(
            name='UserMoneyChangeLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('change_amount', models.BigIntegerField()),
                ('balance_after', models.PositiveBigIntegerField()),
                ('reason_type', models.CharField(choices=[('daily_login_reward', 'Daily login reward'), ('first_comment_reward', 'First comment reward'), ('author_reward', 'Author reward'), ('content_purchase', 'Content purchase'), ('admin_adjustment', 'Admin adjustment')], max_length=32)),
                ('reason_text', models.CharField(blank=True, default='', max_length=255)),
                ('related_object_type', models.CharField(blank=True, default='', max_length=64)),
                ('related_object_id', models.PositiveBigIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_actor_entries', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'user money change log',
                'verbose_name_plural': 'user money change logs',
                'db_table': 'users_money_change_logs',
                'ordering': ('-created_at', '-pk'),
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='UserPointsChangeLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('change_amount', models.BigIntegerField()),
                ('balance_after', models.PositiveBigIntegerField()),
                ('reason_type', models.CharField(choices=[('daily_login_reward', 'Daily login reward'), ('first_comment_reward', 'First comment reward'), ('author_reward', 'Author reward'), ('content_purchase', 'Content purchase'), ('admin_adjustment', 'Admin adjustment')], max_length=32)),
                ('reason_text', models.CharField(blank=True, default='', max_length=255)),
                ('related_object_type', models.CharField(blank=True, default='', max_length=64)),
                ('related_object_id', models.PositiveBigIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_actor_entries', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'user points change log',
                'verbose_name_plural': 'user points change logs',
                'db_table': 'users_points_change_logs',
                'ordering': ('-created_at', '-pk'),
                'abstract': False,
            },
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['email'], name='users_email_4b85f2_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['username'], name='users_usernam_baeb4b_idx'),
        ),
        migrations.AddIndex(
            model_name='usermoneychangelog',
            index=models.Index(fields=['user', 'created_at'], name='users_money_user_id_e6b14e_idx'),
        ),
        migrations.AddIndex(
            model_name='usermoneychangelog',
            index=models.Index(fields=['reason_type', 'created_at'], name='users_money_reason__92b531_idx'),
        ),
        migrations.AddIndex(
            model_name='usermoneychangelog',
            index=models.Index(fields=['related_object_type', 'related_object_id'], name='users_money_related_05602a_idx'),
        ),
        migrations.AddIndex(
            model_name='userpointschangelog',
            index=models.Index(fields=['user', 'created_at'], name='users_point_user_id_cc5ec7_idx'),
        ),
        migrations.AddIndex(
            model_name='userpointschangelog',
            index=models.Index(fields=['reason_type', 'created_at'], name='users_point_reason__2a72b1_idx'),
        ),
        migrations.AddIndex(
            model_name='userpointschangelog',
            index=models.Index(fields=['related_object_type', 'related_object_id'], name='users_point_related_e14c92_idx'),
        ),
    ]
