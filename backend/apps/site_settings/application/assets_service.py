import os
import zipfile

from django.core.files.storage import default_storage
from django.core.exceptions import ValidationError
from PIL import Image

from apps.site_settings.application.settings_service import SiteSettingsService
from apps.site_settings.application.storage import storage_name


ASSET_FIELDS = {"site_icon", "auth_background", "app_background"}
BUNDLE_FIELDS = {"widget_bundle", "cubism_bundle"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_BUNDLE_SIZE = 1024 * 1024 * 1024


class SiteAssetsService:
    @staticmethod
    def upload(field, uploaded_file, user, request=None):
        if field not in ASSET_FIELDS:
            raise ValidationError("Unknown site asset.")
        if not uploaded_file or uploaded_file.size > MAX_IMAGE_SIZE:
            raise ValidationError("Image must be smaller than 10 MB.")
        try:
            image = Image.open(uploaded_file)
            image.verify()
            if image.format not in {"PNG", "JPEG", "GIF", "WEBP", "ICO"}:
                raise ValidationError("Unsupported image format.")
        except (OSError, ValidationError):
            raise ValidationError("Upload a valid PNG, JPEG, GIF, WEBP, or ICO image.")
        finally:
            uploaded_file.seek(0)
        extension = os.path.splitext(uploaded_file.name)[1].lower() or ".bin"
        values = SiteSettingsService.get_section("basic")
        old_path = storage_name(values["basic.assets"][field])
        path = f"site-settings/{field}{extension}"
        # The field owns one canonical object. Remove its old extension/name
        # before saving so an uploaded icon cannot accumulate stale variants.
        if old_path and default_storage.exists(old_path):
            default_storage.delete(old_path)
        if default_storage.exists(path):
            default_storage.delete(path)
        path = default_storage.save(path, uploaded_file)
        values["basic.assets"][field] = path
        SiteSettingsService.update_section("basic", {"basic.assets": values["basic.assets"]}, user, record_audit=False)
        from apps.site_settings.application.audit_service import AuditLogService
        AuditLogService.record(
            action="site_asset.uploaded",
            summary=f"Site asset '{field}' uploaded",
            actor=user,
            metadata={"field": field, "filename": os.path.basename(path), "replaced": bool(old_path)},
            request=request,
        )
        return values["basic.assets"]

    @staticmethod
    def remove(field, user, request=None):
        if field not in ASSET_FIELDS:
            raise ValidationError("Unknown site asset.")
        values = SiteSettingsService.get_section("basic")
        path = storage_name(values["basic.assets"][field])
        values["basic.assets"][field] = ""
        SiteSettingsService.update_section("basic", {"basic.assets": values["basic.assets"]}, user, record_audit=False)
        from apps.site_settings.application.audit_service import AuditLogService
        AuditLogService.record(
            action="site_asset.removed",
            summary=f"Site asset '{field}' removed",
            actor=user,
            metadata={"field": field, "had_file": bool(path)},
            request=request,
        )
        if path and default_storage.exists(path):
            default_storage.delete(path)
        return values["basic.assets"]

    @staticmethod
    def upload_bundle(field, uploaded_file, user, request=None):
        if field not in BUNDLE_FIELDS or not uploaded_file or uploaded_file.size > MAX_BUNDLE_SIZE:
            raise ValidationError("Upload a valid bundle smaller than 1 GB.")
        if not uploaded_file.name.lower().endswith(".zip"):
            raise ValidationError("Live2D bundles must be ZIP files.")
        try:
            with zipfile.ZipFile(uploaded_file) as archive:
                names = archive.namelist()
                if not names or any(name.startswith(("/", "\\")) or ".." in name.replace("\\", "/").split("/") for name in names):
                    raise ValidationError("Bundle contains an unsafe file path.")
                if field == "widget_bundle" and "manifest.json" not in names:
                    raise ValidationError("A widget bundle must include manifest.json at its root.")
                if field == "cubism_bundle" and not any(name.endswith(".model3.json") for name in names):
                    raise ValidationError("A Cubism bundle must include a .model3.json file.")
        except (zipfile.BadZipFile, ValidationError):
            raise ValidationError("Upload a valid Live2D ZIP bundle.")
        finally:
            uploaded_file.seek(0)
        path = default_storage.save(f"site-settings/live2d/{field}/{uuid.uuid4().hex}.zip", uploaded_file)
        values = SiteSettingsService.get_section("basic")
        old_path = storage_name(values["basic.live2d"][field])
        values["basic.live2d"][field] = path
        SiteSettingsService.update_section("basic", {"basic.live2d": values["basic.live2d"]}, user, record_audit=False)
        from apps.site_settings.application.audit_service import AuditLogService
        AuditLogService.record(
            action="live2d_bundle.uploaded",
            summary=f"Live2D bundle '{field}' uploaded",
            actor=user,
            metadata={"field": field, "filename": os.path.basename(path), "replaced": bool(old_path)},
            request=request,
        )
        if old_path and default_storage.exists(old_path):
            default_storage.delete(old_path)
        return values["basic.live2d"]

    @staticmethod
    def remove_bundle(field, user, request=None):
        if field not in BUNDLE_FIELDS:
            raise ValidationError("Unknown Live2D bundle.")
        values = SiteSettingsService.get_section("basic")
        live2d = values["basic.live2d"]
        if live2d["enabled"] and live2d["source_type"] == field:
            raise ValidationError("Select another source or disable Live2D before removing its active bundle.")
        path = storage_name(live2d[field])
        live2d[field] = ""
        SiteSettingsService.update_section("basic", {"basic.live2d": live2d}, user, record_audit=False)
        from apps.site_settings.application.audit_service import AuditLogService
        AuditLogService.record(
            action="live2d_bundle.removed",
            summary=f"Live2D bundle '{field}' removed",
            actor=user,
            metadata={"field": field, "had_file": bool(path)},
            request=request,
        )
        if path and default_storage.exists(path):
            default_storage.delete(path)
        return live2d
