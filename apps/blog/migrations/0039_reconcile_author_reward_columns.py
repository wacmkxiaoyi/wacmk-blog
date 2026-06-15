from django.db import migrations


def reconcile_author_reward_columns(apps, schema_editor):
    connection = schema_editor.connection
    table_name = "blog_sitesetting"
    new_columns = {
        "article_author_reward_money_ratio": "DECIMAL(4,2) NOT NULL DEFAULT 0.80",
        "article_author_reward_points_ratio": "DECIMAL(4,2) NOT NULL DEFAULT 0.00",
        "book_author_reward_money_ratio": "DECIMAL(4,2) NOT NULL DEFAULT 0.80",
        "book_author_reward_points_ratio": "DECIMAL(4,2) NOT NULL DEFAULT 0.00",
        "attachment_author_reward_money_ratio": "DECIMAL(4,2) NOT NULL DEFAULT 0.80",
        "attachment_author_reward_points_ratio": "DECIMAL(4,2) NOT NULL DEFAULT 0.00",
    }

    with connection.cursor() as cursor:
        existing_columns = {
            column.name for column in connection.introspection.get_table_description(cursor, table_name)
        }

        for column_name, definition in new_columns.items():
            if column_name not in existing_columns:
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")

        existing_columns = {
            column.name for column in connection.introspection.get_table_description(cursor, table_name)
        }
        if {
            "author_reward_money_ratio",
            "author_reward_points_ratio",
        }.issubset(existing_columns):
            cursor.execute(
                f"""
                UPDATE {table_name}
                SET
                    article_author_reward_money_ratio = author_reward_money_ratio,
                    article_author_reward_points_ratio = author_reward_points_ratio,
                    book_author_reward_money_ratio = author_reward_money_ratio,
                    book_author_reward_points_ratio = author_reward_points_ratio,
                    attachment_author_reward_money_ratio = author_reward_money_ratio,
                    attachment_author_reward_points_ratio = author_reward_points_ratio
                """
            )


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0038_rename_blog_author_reader__4c55f5_idx_blog_author_reader__c170c1_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(reconcile_author_reward_columns, migrations.RunPython.noop),
    ]
