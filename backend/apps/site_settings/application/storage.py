from django.core.files.storage import default_storage

from apps.resources.media_urls import site_asset_url


def asset_url(name, field=None):
    if not name:
        return ""
    return site_asset_url(field) if field else default_storage.url(name)


def storage_name(value, fallback=""):
    if not value:
        return ""
    if value.startswith("/api/resources/public-media/site-assets/"):
        return fallback
    media_url = default_storage.url("")
    return value[len(media_url):] if value.startswith(media_url) else value


def site_asset_storage_name(value, field):
    if value.startswith("site-settings/") and not value.startswith("/"):
        return value
    try:
        _, names = default_storage.listdir("site-settings")
    except (FileNotFoundError, OSError):
        return ""
    prefix = f"{field}."
    return next((f"site-settings/{name}" for name in names if name.startswith(prefix)), "")
