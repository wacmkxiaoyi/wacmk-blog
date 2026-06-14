from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0033_bookstar"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Attachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=200)),
                ("file", models.FileField(upload_to="blog/attachments/")),
                ("original_filename", models.CharField(blank=True, max_length=255)),
                ("mime_type", models.CharField(blank=True, max_length=120)),
                ("file_size", models.PositiveBigIntegerField(default=0)),
                ("file_ext", models.CharField(blank=True, max_length=32)),
                ("visibility", models.CharField(choices=[("public", "Public"), ("private", "Private"), ("conditional", "Conditional")], default="public", max_length=16)),
                ("condition_rules", models.JSONField(blank=True, default=list)),
                ("access_scope", models.CharField(choices=[("unified", "Unified"), ("standalone", "Standalone")], default="unified", max_length=16)),
                ("vip_access_permission", models.CharField(choices=[("public", "Public"), ("private", "Private"), ("conditional", "Conditional")], default="public", max_length=16)),
                ("vip_condition_rules", models.JSONField(blank=True, default=list)),
                ("usage_count", models.PositiveIntegerField(default=0)),
                ("last_referenced_at", models.DateTimeField(blank=True, null=True)),
                ("uploaded_by", models.ForeignKey(on_delete=models.PROTECT, related_name="attachments", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-updated_at", "-created_at", "-pk"],
                "indexes": [
                    models.Index(fields=["uploaded_by", "updated_at"], name="blog_attach_uploade_bbf6a1_idx"),
                    models.Index(fields=["visibility", "updated_at"], name="blog_attach_visibil_7a8db2_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AttachmentPasswordRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("attachment", models.ForeignKey(on_delete=models.CASCADE, related_name="password_records", to="blog.attachment")),
                ("user", models.ForeignKey(on_delete=models.CASCADE, related_name="attachment_password_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
                "indexes": [models.Index(fields=["user", "attachment"], name="blog_attachm_user_id_f8c7eb_idx")],
                "constraints": [models.UniqueConstraint(fields=("user", "attachment"), name="blog_attachmentpassword_user_attachment_unique")],
            },
        ),
        migrations.CreateModel(
            name="AttachmentPurchaseRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cost_money", models.PositiveIntegerField()),
                ("attachment", models.ForeignKey(on_delete=models.PROTECT, related_name="purchase_records", to="blog.attachment")),
                ("user", models.ForeignKey(on_delete=models.CASCADE, related_name="attachment_purchase_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-pk"],
                "indexes": [
                    models.Index(fields=["user", "attachment"], name="blog_attachp_user_id_66d196_idx"),
                    models.Index(fields=["attachment", "created_at"], name="blog_attachp_attachm_d31ccd_idx"),
                ],
                "constraints": [models.UniqueConstraint(fields=("user", "attachment"), name="blog_attachmentpurchase_user_attachment_unique")],
            },
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="attachment_max_size_mb",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
