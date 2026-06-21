import os
import re
from collections import defaultdict

from django.contrib.auth import get_user_model
from django.core.files.base import File
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

from apps.blog.models import Attachment, Book, Comment, Post, PostDraft
from apps.blog.utils import (
    ADMIN_FALLBACK_USER_ID,
    admin_attachment_upload_path,
    admin_image_upload_path,
    admin_video_upload_path,
    build_media_url,
    build_user_media_path,
    resolve_media_path,
)
from apps.users.models import UserProfile


OLD_IMAGE_PREFIX = "blog/uploads/"
OLD_VIDEO_PREFIX = "blog/videos/"
MEDIA_REFERENCE_PATTERN = re.compile(r"(?P<full>/media/(?P<kind>blog/(?:uploads|videos))/[^\s\)\]\"'>]+)")


class Command(BaseCommand):
    help = "Migrate user media into per-user folders."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files or database rows.")

    def handle(self, *args, **options):
        self.dry_run = bool(options.get("dry_run"))
        self.stats = defaultdict(int)
        self.admin_user = self._get_admin_user()

        self.stdout.write("Migrating media fields...")
        self._migrate_profile_avatars()
        self._migrate_post_covers()
        self._migrate_book_covers()
        self._migrate_attachments_to_admin()

        self.stdout.write("Rewriting embedded media references...")
        self._rewrite_embedded_media(Post, "author")
        self._rewrite_embedded_media(PostDraft, "author")
        self._rewrite_embedded_media(Comment, "author")

        self.stdout.write("Collecting leftover legacy editor files...")
        self._migrate_remaining_legacy_directory(OLD_IMAGE_PREFIX, admin_image_upload_path)
        self._migrate_remaining_legacy_directory(OLD_VIDEO_PREFIX, admin_video_upload_path)

        summary = ", ".join(f"{key}={value}" for key, value in sorted(self.stats.items())) or "no changes"
        mode_label = "DRY RUN" if self.dry_run else "DONE"
        self.stdout.write(f"{mode_label}: {summary}")

    def _get_admin_user(self):
        User = get_user_model()
        user = User.objects.filter(pk=ADMIN_FALLBACK_USER_ID).first()
        if user is None:
            raise CommandError(f"Admin fallback user {ADMIN_FALLBACK_USER_ID} does not exist.")
        return user

    def _normalize_storage_path(self, path):
        return str(path or "").replace("\\", "/").strip("/")

    def _path_is_legacy(self, path, prefix):
        normalized = self._normalize_storage_path(path)
        return normalized.startswith(prefix)

    def _copy_storage_file(self, source_name, destination_name):
        source_name = self._normalize_storage_path(source_name)
        destination_name = self._normalize_storage_path(destination_name)
        if not source_name or source_name == destination_name:
            return destination_name
        if not default_storage.exists(source_name):
            self.stats["missing_files"] += 1
            return destination_name
        if default_storage.exists(destination_name):
            return destination_name
        if self.dry_run:
            self.stats["copied_files"] += 1
            return destination_name
        with default_storage.open(source_name, "rb") as source_handle:
            saved_name = default_storage.save(destination_name, File(source_handle, name=os.path.basename(destination_name)))
        self.stats["copied_files"] += 1
        return saved_name

    def _delete_storage_file(self, path):
        normalized = self._normalize_storage_path(path)
        if not normalized or not default_storage.exists(normalized):
            return
        if self.dry_run:
            self.stats["deleted_files"] += 1
            return
        default_storage.delete(normalized)
        self.stats["deleted_files"] += 1

    def _migrate_file_field(self, instance, field_name, destination_path):
        field = getattr(instance, field_name)
        source_name = self._normalize_storage_path(getattr(field, "name", ""))
        if not source_name or source_name == destination_path:
            return False
        saved_name = self._copy_storage_file(source_name, destination_path)
        if self.dry_run:
            self.stats["updated_records"] += 1
            return True
        setattr(instance, field_name, saved_name)
        update_fields = [field_name]
        if hasattr(instance, "updated_at"):
            update_fields.append("updated_at")
        instance.save(update_fields=update_fields)
        self._delete_storage_file(source_name)
        self.stats["updated_records"] += 1
        return True

    def _migrate_profile_avatars(self):
        for profile in UserProfile.objects.select_related("user").exclude(avatar=""):
            source_name = self._normalize_storage_path(profile.avatar.name)
            if not source_name:
                continue
            destination = build_user_media_path(profile.user, "avatar", filename=os.path.basename(source_name))
            self._migrate_file_field(profile, "avatar", destination)

    def _migrate_post_covers(self):
        for model, owner_attr in ((Post, "author"), (PostDraft, "author")):
            queryset = model.objects.select_related(owner_attr).exclude(cover_image="")
            for instance in queryset:
                source_name = self._normalize_storage_path(instance.cover_image.name)
                if not source_name:
                    continue
                destination = build_user_media_path(getattr(instance, owner_attr, None), "post-cover", filename=os.path.basename(source_name))
                self._migrate_file_field(instance, "cover_image", destination)

    def _migrate_book_covers(self):
        for book in Book.objects.select_related("created_by").exclude(cover_image=""):
            source_name = self._normalize_storage_path(book.cover_image.name)
            if not source_name:
                continue
            destination = build_user_media_path(book.created_by, "book-cover", filename=os.path.basename(source_name))
            self._migrate_file_field(book, "cover_image", destination)

    def _migrate_attachments_to_admin(self):
        for attachment in Attachment.objects.exclude(file=""):
            source_name = self._normalize_storage_path(attachment.file.name)
            if not source_name:
                continue
            destination = admin_attachment_upload_path(os.path.basename(source_name))
            self._migrate_file_field(attachment, "file", destination)

    def _replace_content_references(self, content):
        updated_paths = set()

        def replace(match):
            full = match.group("full")
            kind = match.group("kind")
            relative = full.removeprefix("/media/")
            file_name = os.path.basename(relative)
            if kind == "blog/uploads":
                new_relative = admin_image_upload_path(file_name)
            else:
                new_relative = admin_video_upload_path(file_name)
            updated_paths.add((self._normalize_storage_path(relative), new_relative))
            return build_media_url(new_relative)

        return MEDIA_REFERENCE_PATTERN.sub(replace, content or ""), updated_paths

    def _rewrite_embedded_media(self, model, owner_attr):
        queryset = model.objects.exclude(content="")
        if owner_attr:
            queryset = queryset.select_related(owner_attr)
        for instance in queryset:
            new_content, path_pairs = self._replace_content_references(instance.content)
            if not path_pairs and new_content == instance.content:
                continue
            for old_path, new_path in path_pairs:
                self._copy_storage_file(old_path, new_path)
            if not self.dry_run:
                instance.content = new_content
                update_fields = ["content"]
                if hasattr(instance, "updated_at"):
                    update_fields.append("updated_at")
                instance.save(update_fields=update_fields)
            self.stats["rewritten_contents"] += 1
            for old_path, _new_path in path_pairs:
                self._delete_storage_file(old_path)

    def _iter_storage_files(self, prefix):
        try:
            directories, files = default_storage.listdir(prefix)
        except FileNotFoundError:
            return
        for file_name in files:
            yield self._normalize_storage_path(os.path.join(prefix, file_name))
        for directory in directories:
            nested_prefix = self._normalize_storage_path(os.path.join(prefix, directory))
            for nested_file in self._iter_storage_files(nested_prefix):
                yield nested_file

    def _migrate_remaining_legacy_directory(self, prefix, destination_builder):
        normalized_prefix = self._normalize_storage_path(prefix)
        if not default_storage.exists(normalized_prefix):
            return
        for source_name in list(self._iter_storage_files(normalized_prefix)):
            destination = destination_builder(os.path.basename(source_name))
            saved_name = self._copy_storage_file(source_name, destination)
            if saved_name:
                self._delete_storage_file(source_name)
                self.stats["moved_legacy_files"] += 1
