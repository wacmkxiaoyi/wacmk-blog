import json

from django.db import migrations, models
from django.utils import timezone


SETTING_FIELDS = [
    "enable_register",
    "code_expire_seconds",
    "code_resend_seconds",
    "site_title",
    "site_icon",
    "auth_background",
    "app_background",
    "post_editor_autosave_enabled",
    "post_editor_autosave_interval_minutes",
    "audit_log_cleanup_enabled",
    "audit_log_retention_days",
    "vip_max_level",
    "vip_level_names",
    "dashboard_visit_trend_days",
    "allow_non_admin_create_post",
    "non_admin_max_post_count",
    "vip_only_create_post",
    "allow_non_admin_create_book",
    "non_admin_max_book_count",
    "vip_only_create_book",
    "attachment_max_size_mb",
    "allow_comment",
    "vip_only_comment",
    "article_author_reward_money_ratio",
    "article_author_reward_points_ratio",
    "book_author_reward_money_ratio",
    "book_author_reward_points_ratio",
    "attachment_author_reward_money_ratio",
    "attachment_author_reward_points_ratio",
]


def _serialize_value(key, value):
    if value is None:
        return None
    if key == "vip_level_names":
        return json.dumps(value, ensure_ascii=True)
    return str(value)


def _create_kv_table(schema_editor, table_name):
    quoted_table_name = schema_editor.quote_name(table_name)
    if schema_editor.connection.vendor == "sqlite":
        schema_editor.execute(
            f"""
            CREATE TABLE {quoted_table_name} (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                created_at datetime NOT NULL,
                updated_at datetime NOT NULL,
                [key] varchar(100) NOT NULL UNIQUE,
                value text NOT NULL
            )
            """
        )
        return
    schema_editor.execute(
        f"""
        CREATE TABLE {quoted_table_name} (
            id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
            created_at datetime(6) NOT NULL,
            updated_at datetime(6) NOT NULL,
            `key` varchar(100) NOT NULL UNIQUE,
            value longtext NOT NULL
        )
        """
    )


def migrate_sitesettings_to_key_value(apps, schema_editor):
    LegacySiteSetting = apps.get_model("blog", "SiteSetting")
    connection = schema_editor.connection
    table_name = LegacySiteSetting._meta.db_table
    legacy_table_name = f"{table_name}_legacy"

    with connection.cursor() as cursor:
        existing_tables = set(connection.introspection.table_names(cursor))
        if table_name not in existing_tables:
            return
        existing_columns = {
            column.name for column in connection.introspection.get_table_description(cursor, table_name)
        }
        if {"key", "value"}.issubset(existing_columns):
            return

    row = LegacySiteSetting.objects.order_by("pk").values(*SETTING_FIELDS).first()

    schema_editor.execute(
        f"ALTER TABLE {schema_editor.quote_name(table_name)} RENAME TO {schema_editor.quote_name(legacy_table_name)}"
    )
    _create_kv_table(schema_editor, table_name)

    if row:
        payload = []
        now = timezone.now()
        for key in SETTING_FIELDS:
            serialized = _serialize_value(key, row.get(key))
            if serialized is None:
                continue
            payload.append((now, now, key, serialized))
        if payload:
            with connection.cursor() as cursor:
                cursor.executemany(
                    f"INSERT INTO {schema_editor.quote_name(table_name)} (created_at, updated_at, {schema_editor.quote_name('key')}, value) VALUES (%s, %s, %s, %s)",
                    payload,
                )

    schema_editor.execute(f"DROP TABLE {schema_editor.quote_name(legacy_table_name)}")


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0039_reconcile_author_reward_columns"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(migrate_sitesettings_to_key_value, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AlterModelOptions(
                    name="sitesetting",
                    options={"ordering": ["key"], "verbose_name": "Site setting", "verbose_name_plural": "Site settings"},
                ),
                migrations.RemoveField(model_name="sitesetting", name="enable_register"),
                migrations.RemoveField(model_name="sitesetting", name="code_expire_seconds"),
                migrations.RemoveField(model_name="sitesetting", name="code_resend_seconds"),
                migrations.RemoveField(model_name="sitesetting", name="site_title"),
                migrations.RemoveField(model_name="sitesetting", name="site_icon"),
                migrations.RemoveField(model_name="sitesetting", name="auth_background"),
                migrations.RemoveField(model_name="sitesetting", name="app_background"),
                migrations.RemoveField(model_name="sitesetting", name="post_editor_autosave_enabled"),
                migrations.RemoveField(model_name="sitesetting", name="post_editor_autosave_interval_minutes"),
                migrations.RemoveField(model_name="sitesetting", name="audit_log_cleanup_enabled"),
                migrations.RemoveField(model_name="sitesetting", name="audit_log_retention_days"),
                migrations.RemoveField(model_name="sitesetting", name="vip_max_level"),
                migrations.RemoveField(model_name="sitesetting", name="vip_level_names"),
                migrations.RemoveField(model_name="sitesetting", name="dashboard_visit_trend_days"),
                migrations.RemoveField(model_name="sitesetting", name="allow_non_admin_create_post"),
                migrations.RemoveField(model_name="sitesetting", name="non_admin_max_post_count"),
                migrations.RemoveField(model_name="sitesetting", name="vip_only_create_post"),
                migrations.RemoveField(model_name="sitesetting", name="allow_non_admin_create_book"),
                migrations.RemoveField(model_name="sitesetting", name="non_admin_max_book_count"),
                migrations.RemoveField(model_name="sitesetting", name="vip_only_create_book"),
                migrations.RemoveField(model_name="sitesetting", name="attachment_max_size_mb"),
                migrations.RemoveField(model_name="sitesetting", name="allow_comment"),
                migrations.RemoveField(model_name="sitesetting", name="vip_only_comment"),
                migrations.RemoveField(model_name="sitesetting", name="article_author_reward_money_ratio"),
                migrations.RemoveField(model_name="sitesetting", name="article_author_reward_points_ratio"),
                migrations.RemoveField(model_name="sitesetting", name="book_author_reward_money_ratio"),
                migrations.RemoveField(model_name="sitesetting", name="book_author_reward_points_ratio"),
                migrations.RemoveField(model_name="sitesetting", name="attachment_author_reward_money_ratio"),
                migrations.RemoveField(model_name="sitesetting", name="attachment_author_reward_points_ratio"),
                migrations.AddField(
                    model_name="sitesetting",
                    name="key",
                    field=models.CharField(default="", max_length=100, unique=True),
                    preserve_default=False,
                ),
                migrations.AddField(
                    model_name="sitesetting",
                    name="value",
                    field=models.TextField(blank=True, default=""),
                ),
            ],
        ),
    ]
