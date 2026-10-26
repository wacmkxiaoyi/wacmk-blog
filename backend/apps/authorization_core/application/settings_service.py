from apps.site_settings.application.settings_service import SiteSettingsService


class AuthorizationSettingsService:
    @staticmethod
    def get(key, default=None):
        return SiteSettingsService.get_legacy_config().get(key, default)

    @staticmethod
    def get_section(section, default=None):
        value = SiteSettingsService.get_legacy_config().get(section, default)
        if isinstance(value, dict):
            return value
        return default if default is not None else {}

    @staticmethod
    def get_nested(path, default=None):
        current = SiteSettingsService.get_legacy_config()
        for part in path:
            if not isinstance(current, dict) or part not in current:
                return default
            current = current[part]
        return current

    @staticmethod
    def get_bool(key, default=False):
        value = SiteSettingsService.get_legacy_config().get(key, default)
        if isinstance(value, bool):
            return value
        return bool(value)
