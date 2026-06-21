from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.blog.models import MediaCleanupJob
from apps.blog.utils.media_cleanup import cleanup_unused_media_files


class Command(BaseCommand):
    help = "Delete unused files from MEDIA_ROOT based on current database references."

    def add_arguments(self, parser):
        parser.add_argument("--job-id", type=int, required=True, help="Media cleanup job id.")
        parser.add_argument("--dry-run", action="store_true", help="Scan unused files without deleting them.")

    def handle(self, *args, **options):
        job_id = int(options["job_id"])
        dry_run = bool(options.get("dry_run"))
        job = MediaCleanupJob.objects.filter(pk=job_id).first()
        if job is None:
            raise CommandError(f"Media cleanup job {job_id} does not exist.")

        MediaCleanupJob.objects.filter(pk=job.pk).update(
            status=MediaCleanupJob.STATUS_RUNNING,
            started_at=timezone.now(),
            finished_at=None,
            error_message="",
        )
        try:
            result = cleanup_unused_media_files(dry_run=dry_run)
        except Exception as exc:
            MediaCleanupJob.objects.filter(pk=job.pk).update(
                status=MediaCleanupJob.STATUS_FAILED,
                finished_at=timezone.now(),
                error_message=str(exc),
            )
            raise

        summary = (
            f"Scanned {result['scanned_file_count']} files, kept {result['kept_file_count']}, "
            f"deleted {result['deleted_file_count']}, removed {result['deleted_directory_count']} directories."
        )
        if dry_run:
            summary = "Dry run: " + summary
        MediaCleanupJob.objects.filter(pk=job.pk).update(
            status=MediaCleanupJob.STATUS_SUCCEEDED,
            finished_at=timezone.now(),
            scanned_file_count=result["scanned_file_count"],
            kept_file_count=result["kept_file_count"],
            deleted_file_count=result["deleted_file_count"],
            deleted_directory_count=result["deleted_directory_count"],
            referenced_path_count=result["referenced_path_count"],
            result_summary=summary,
        )
        self.stdout.write(summary)
