from copy import deepcopy
from hashlib import sha256
import json

from django.core.cache import cache
from django.db import transaction

from apps.site_settings.domain.definitions import SETTING_DEFINITIONS, default_for, default_vip_config
from apps.site_settings.models import SiteSetting
from apps.site_settings.application.storage import asset_url, site_asset_storage_name, storage_name


class SiteSettingsService:
    cache_key = "site-settings:all:v1"

    @classmethod
    def get_all(cls):
        cached = cache.get(cls.cache_key)
        if cached is not None:
            return deepcopy(cached)
        values = {key: default_for(key) for key in SETTING_DEFINITIONS}
        for setting in SiteSetting.objects.filter(key__in=SETTING_DEFINITIONS).only("key", "value"):
            value = setting.value
            # Persisted JSON settings predate newly added default fields.
            if isinstance(value, dict) and isinstance(values[setting.key], dict):
                value = {**values[setting.key], **value}
                if setting.key == "vip" and isinstance(value.get("vip_configs"), list):
                    value["vip_configs"] = [
                        {**default_vip_config(index + 1), **config}
                        if isinstance(config, dict) else config
                        for index, config in enumerate(value["vip_configs"])
                    ]
            values[setting.key] = value
        cache.set(cls.cache_key, values, timeout=300)
        return deepcopy(values)

    @classmethod
    def get_section(cls, section):
        return {key: value for key, value in cls.get_all().items() if SETTING_DEFINITIONS[key]["section"] == section}

    @classmethod
    def update_section(cls, section, values, user, request=None, record_audit=True):
        allowed_keys = {key for key, definition in SETTING_DEFINITIONS.items() if definition["section"] == section}
        removed_asset_names = []
        changed_keys = []
        with transaction.atomic():
            for key, value in values.items():
                if key not in allowed_keys:
                    continue
                previous_value = cls.get_all()[key]
                # Secrets are write-only: an empty value from the management DTO means keep it.
                if key == "basic.live2d" and not value["ai"]["api_key"]:
                    value = {**value, "ai": {**value["ai"], "api_key": previous_value["ai"]["api_key"]}}
                if key == "basic.assets":
                    value = {
                        name: storage_name(path, site_asset_storage_name(previous_value.get(name, ""), name))
                        for name, path in value.items()
                    }
                    removed_asset_names.extend(
                        storage_name(previous_value[name])
                        for name in previous_value
                        if previous_value[name] and not value[name]
                    )
                if key == "basic.live2d":
                    value = {
                        **value,
                        "widget_bundle": storage_name(value["widget_bundle"]),
                        "cubism_bundle": storage_name(value["cubism_bundle"]),
                    }
                if value != previous_value:
                    SiteSetting.objects.update_or_create(key=key, defaults={"value": value, "updated_by": user})
                    changed_keys.append(key)
            if changed_keys and section == "basic" and record_audit:
                from apps.site_settings.application.audit_service import AuditLogService
                AuditLogService.record(
                    action="site_settings.updated",
                    summary="Basic site settings updated",
                    actor=user,
                    metadata={"changed_keys": changed_keys},
                    request=request,
                )
        cache.delete(cls.cache_key)
        if removed_asset_names:
            from django.core.files.storage import default_storage
            for name in removed_asset_names:
                if default_storage.exists(name):
                    default_storage.delete(name)
        return cls.get_section(section)

    @classmethod
    def reset_section(cls, section, user=None, request=None):
        keys = [key for key, definition in SETTING_DEFINITIONS.items() if definition["section"] == section]
        values = cls.get_section(section)
        configured_keys = list(SiteSetting.objects.filter(key__in=keys).values_list("key", flat=True))
        if section == "basic":
            from django.core.files.storage import default_storage
            asset_names = [storage_name(name) for name in values["basic.assets"].values()]
            asset_names.extend((storage_name(values["basic.live2d"]["widget_bundle"]), storage_name(values["basic.live2d"]["cubism_bundle"])))
            for name in asset_names:
                if name and default_storage.exists(name):
                    default_storage.delete(name)
        with transaction.atomic():
            SiteSetting.objects.filter(key__in=keys).delete()
            if configured_keys and section == "basic":
                from apps.site_settings.application.audit_service import AuditLogService
                AuditLogService.record(
                    action="site_settings.reset",
                    summary="Basic site settings restored to defaults",
                    actor=user,
                    metadata={"changed_keys": configured_keys},
                    request=request,
                )
        cache.delete(cls.cache_key)
        return cls.get_section(section)

    @classmethod
    def get_public_config(cls):
        values = {key: value for key, value in cls.get_all().items() if SETTING_DEFINITIONS[key]["public"]}
        for key in ("content.article", "content.book", "upload.attachment", "upload.video", "comment"):
            values[key].pop("permission", None)
        values["basic.assets"] = {key: asset_url(name, key) for key, name in values["basic.assets"].items()}
        return values

    @classmethod
    def get_public_runtime_config(cls):
        values = cls.get_public_config()
        all_values = cls.get_all()
        vip = all_values["vip"]
        values["user"] = {
            "storage_capacity_mb": int(all_values["user.rewards"].get("storage_capacity_mb", 10) or 0),
        }
        values["vip"] = {
            "levels": [
                {
                    "level": index,
                    "display_name": str(config.get("display_name") or f"VIP {index}"),
                    "money_discount": str(config.get("money_discount") or "0"),
                    "points_discount": str(config.get("points_discount") or "0"),
                    "money_reward": str(config.get("money_reward") or "0"),
                    "points_reward": str(config.get("points_reward") or "0"),
                    "daily_login_bonus_money": int(config.get("daily_login_bonus_money") or 0),
                    "daily_login_bonus_points": int(config.get("daily_login_bonus_points") or 0),
                    "first_comment_bonus_money": int(config.get("first_comment_bonus_money") or 0),
                    "first_comment_bonus_points": int(config.get("first_comment_bonus_points") or 0),
                    "storage_capacity_mb": int(config.get("storage_capacity_mb") or 0),
                }
                for index, config in enumerate(vip.get("vip_configs", []), start=1)
                if isinstance(config, dict)
            ]
        }
        payload = json.dumps(values, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
        return {"version": sha256(payload.encode("utf-8")).hexdigest(), "values": values}

    @classmethod
    def get_management_section(cls, section):
        values = cls.get_section(section)
        for key in ("content.article", "content.book", "upload.attachment", "upload.video", "comment"):
            if key in values:
                values[key].pop("permission", None)
        if "basic.live2d" in values:
            values["basic.live2d"] = {
                **values["basic.live2d"],
                "ai": {**values["basic.live2d"]["ai"], "api_key": ""},
            }
            values["basic.live2d"] = {
                **values["basic.live2d"],
                "widget_bundle": asset_url(values["basic.live2d"]["widget_bundle"]),
                "cubism_bundle": asset_url(values["basic.live2d"]["cubism_bundle"]),
            }
        if "basic.assets" in values:
            values["basic.assets"] = {key: asset_url(name, key) for key, name in values["basic.assets"].items()}
        return values

    @classmethod
    def get_legacy_config(cls):
        values = cls.get_all()
        return {
            "registration": values["registration"],
            "vip": values["vip"],
            "article": values["content.article"],
            "book": values["content.book"],
            "attachment": values["upload.attachment"],
            "video": values["upload.video"],
            "comment": values["comment"],
        }
