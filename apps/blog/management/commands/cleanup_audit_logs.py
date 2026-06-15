from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.blog.models import AuditLog
from apps.blog.utils.site import get_setting


class Command(BaseCommand):
    help = "Delete expired audit logs based on site settings."

    def handle(self, *args, **options):
        if not get_setting("audit_log_cleanup_enabled"):
            self.stdout.write("Audit log cleanup is disabled.")
            return

        cutoff_date = timezone.localdate() - timedelta(days=get_setting("audit_log_retention_days"))
        deleted_count, _details = AuditLog.objects.filter(created_at__date__lt=cutoff_date).delete()
        self.stdout.write(f"Deleted {deleted_count} expired audit log(s).")
