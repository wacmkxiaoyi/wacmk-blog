from decimal import Decimal, InvalidOperation

from .settings_service import AuthorizationSettingsService
from ..domain.constants import VIP_GROUP_PREFIX


class VipService:
    @staticmethod
    def resolve_vip_level(group_names):
        highest_level = 0
        for group_name in group_names:
            normalized = str(group_name or "").strip().lower()
            if normalized.startswith(VIP_GROUP_PREFIX):
                suffix = normalized[len(VIP_GROUP_PREFIX):]
                if suffix.isdigit():
                    highest_level = max(highest_level, int(suffix))
        return highest_level

    @staticmethod
    def get_discounts(vip_level):
        if vip_level <= 0:
            return {"money_discount": Decimal("0"), "points_discount": Decimal("0")}

        max_level = AuthorizationSettingsService.get_nested(("vip", "vip_max_level"), 0) or 0
        configs = AuthorizationSettingsService.get_nested(("vip", "vip_configs"), []) or []
        if vip_level > int(max_level) or vip_level > len(configs):
            return {"money_discount": Decimal("0"), "points_discount": Decimal("0")}

        config = configs[vip_level - 1]
        if not isinstance(config, dict):
            return {"money_discount": Decimal("0"), "points_discount": Decimal("0")}
        return {
            "money_discount": VipService._parse_discount(config.get("money_discount")),
            "points_discount": VipService._parse_discount(config.get("points_discount")),
        }

    @staticmethod
    def get_benefits(vip_level):
        """Return the complete configured benefit set for a resolved VIP level."""
        config = VipService._get_config(vip_level)
        if config is None:
            return {
                "money_discount": Decimal("0"), "points_discount": Decimal("0"),
                "money_reward": Decimal("0"), "points_reward": Decimal("0"),
                "daily_login_bonus_money": 0, "daily_login_bonus_points": 0,
                "first_comment_bonus_money": 0, "first_comment_bonus_points": 0,
            }
        return {
            "money_discount": VipService._parse_discount(config.get("money_discount")),
            "points_discount": VipService._parse_discount(config.get("points_discount")),
            "money_reward": VipService._parse_discount(config.get("money_reward")),
            "points_reward": VipService._parse_discount(config.get("points_reward")),
            "daily_login_bonus_money": VipService._parse_nonnegative_int(config.get("daily_login_bonus_money")),
            "daily_login_bonus_points": VipService._parse_nonnegative_int(config.get("daily_login_bonus_points")),
            "first_comment_bonus_money": VipService._parse_nonnegative_int(config.get("first_comment_bonus_money")),
            "first_comment_bonus_points": VipService._parse_nonnegative_int(config.get("first_comment_bonus_points")),
        }

    @staticmethod
    def _get_config(vip_level):
        if vip_level <= 0:
            return None
        max_level = AuthorizationSettingsService.get_nested(("vip", "vip_max_level"), 0) or 0
        configs = AuthorizationSettingsService.get_nested(("vip", "vip_configs"), []) or []
        if vip_level > int(max_level) or vip_level > len(configs):
            return None
        config = configs[vip_level - 1]
        return config if isinstance(config, dict) else None

    @staticmethod
    def _parse_discount(value):
        try:
            parsed = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal("0")
        if parsed < 0:
            return Decimal("0")
        if parsed > 1:
            return Decimal("1")
        return parsed

    @staticmethod
    def _parse_nonnegative_int(value):
        try:
            return max(int(value), 0)
        except (TypeError, ValueError):
            return 0
