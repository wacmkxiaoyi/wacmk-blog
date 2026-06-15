from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.blog.models import UserMoneyHistory, UserPointsHistory
from apps.blog.services.money import apply_user_money_change
from apps.blog.services.points import apply_user_points_change
from apps.blog.utils import get_site_setting
from apps.blog.utils.site import get_normalized_vip_configs, get_user_vip_level
from apps.users.models import UserProfile


def grant_daily_login_reward_once(user):
    if user is None or not getattr(user, "is_authenticated", False):
        return {
            "granted": False,
            "reward_money": 0,
            "reward_points": 0,
            "base_reward_money": 0,
            "base_reward_points": 0,
            "vip_bonus_money": 0,
            "vip_bonus_points": 0,
            "vip_bonus_name": "",
        }

    site_setting = get_site_setting()
    base_reward_money = max(int(site_setting.get("daily_login_reward_money", 10) or 0), 0)
    base_reward_points = max(int(site_setting.get("daily_login_reward_points", 10) or 0), 0)
    vip_bonus_money = 0
    vip_bonus_points = 0
    vip_bonus_name = ""
    vip_level = get_user_vip_level(user, site_setting)
    if vip_level > 0:
        vip_configs = get_normalized_vip_configs(site_setting)
        if vip_level <= len(vip_configs):
            vip_config = vip_configs[vip_level - 1]
            vip_bonus_money = max(int(vip_config.get("daily_login_bonus_money", 0) or 0), 0)
            vip_bonus_points = max(int(vip_config.get("daily_login_bonus_points", 0) or 0), 0)
            vip_bonus_name = str(vip_config.get("display_name") or "")

    reward_money = base_reward_money + vip_bonus_money
    reward_points = base_reward_points + vip_bonus_points

    if reward_money <= 0 and reward_points <= 0:
        return {
            "granted": False,
            "reward_money": 0,
            "reward_points": 0,
            "base_reward_money": base_reward_money,
            "base_reward_points": base_reward_points,
            "vip_bonus_money": vip_bonus_money,
            "vip_bonus_points": vip_bonus_points,
            "vip_bonus_name": vip_bonus_name,
        }

    today = timezone.localdate()

    with transaction.atomic():
        profile, _created = UserProfile.objects.select_for_update().get_or_create(user=user)
        if profile.last_login_reward_date == today:
            return {
                "granted": False,
                "reward_money": 0,
                "reward_points": 0,
                "base_reward_money": base_reward_money,
                "base_reward_points": base_reward_points,
                "vip_bonus_money": vip_bonus_money,
                "vip_bonus_points": vip_bonus_points,
                "vip_bonus_name": vip_bonus_name,
            }

        updated_fields = ["last_login_reward_date"]
        if reward_money > 0:
            reason_text = str(_("Daily login reward"))
            if vip_bonus_money > 0 and vip_bonus_name:
                reason_text = str(_("Daily login reward (%(vip_name)s bonus included)")) % {"vip_name": vip_bonus_name}
            _history, profile = apply_user_money_change(
                user=user,
                amount=reward_money,
                reason_type=UserMoneyHistory.REASON_DAILY_LOGIN_REWARD,
                reason_text=reason_text,
                profile=profile,
                save_profile=False,
            )
        if reward_points > 0:
            reason_text = str(_("Daily login reward"))
            if vip_bonus_points > 0 and vip_bonus_name:
                reason_text = str(_("Daily login reward (%(vip_name)s bonus included)")) % {"vip_name": vip_bonus_name}
            _history, profile = apply_user_points_change(
                user=user,
                amount=reward_points,
                reason_type=UserPointsHistory.REASON_DAILY_LOGIN_REWARD,
                reason_text=reason_text,
                profile=profile,
                save_profile=False,
            )
        profile.last_login_reward_date = today
        profile.save(update_fields=updated_fields)

    return {
        "granted": True,
        "reward_money": reward_money,
        "reward_points": reward_points,
        "base_reward_money": base_reward_money,
        "base_reward_points": base_reward_points,
        "vip_bonus_money": vip_bonus_money,
        "vip_bonus_points": vip_bonus_points,
        "vip_bonus_name": vip_bonus_name,
    }


__all__ = ["grant_daily_login_reward_once"]
