from datetime import timedelta

from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.site_settings.application.audit_service import AuditLogService
from apps.site_settings.application.settings_service import SiteSettingsService
from apps.site_settings.models import AuditCleanupRun, AuditLog


class Command(BaseCommand):
    help = "Remove audit logs older than the configured retention period."
    lock_key = "site-settings:audit-cleanup:lock"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report eligible logs without deleting them.")

    def handle(self, *args, **options):
        if not cache.add(self.lock_key, "locked", timeout=60 * 60):
            raise CommandError("Audit cleanup is already running.")
        try:
            config = SiteSettingsService.get_all()["system.audit_cleanup"]
            if not config["enabled"]:
                self.stdout.write("Audit cleanup is disabled; no logs were deleted.")
                return
            cutoff_at = timezone.now() - timedelta(days=config["retention_days"])
            eligible = AuditLog.objects.filter(created_at__lt=cutoff_at)
            count = eligible.count()
            if options["dry_run"]:
                self.stdout.write(f"Dry run: {count} audit logs older than {cutoff_at.isoformat()} would be deleted.")
                return
            cleanup_run = AuditCleanupRun.objects.create(
                retention_days=config["retention_days"],
                cutoff_at=cutoff_at,
            )
            try:
                with transaction.atomic():
                    deleted_count, _ = eligible.delete()
                    cleanup_run.deleted_count = deleted_count
                    cleanup_run.status = AuditCleanupRun.STATUS_SUCCEEDED
                    cleanup_run.finished_at = timezone.now()
                    cleanup_run.save(update_fields=("deleted_count", "status", "finished_at"))
                    AuditLogService.record(
                        action="audit_retention.completed",
                        summary="Scheduled audit retention cleanup completed",
                        metadata={
                            "retention_days": config["retention_days"],
                            "cutoff_at": cutoff_at.isoformat(),
                            "deleted_count": deleted_count,
                            "cleanup_run_id": cleanup_run.id,
                        },
                    )
                self.stdout.write(self.style.SUCCESS(f"Deleted {deleted_count} audit logs."))
            except Exception as error:
                cleanup_run.status = AuditCleanupRun.STATUS_FAILED
                cleanup_run.finished_at = timezone.now()
                cleanup_run.error_message = str(error)[:2000]
                cleanup_run.save(update_fields=("status", "finished_at", "error_message"))
                AuditLogService.record(
                    action="audit_retention.failed",
                    summary="Scheduled audit retention cleanup failed",
                    metadata={"cleanup_run_id": cleanup_run.id},
                )
                raise
        finally:
            cache.delete(self.lock_key)
