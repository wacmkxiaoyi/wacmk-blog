from django.db import transaction
from django.utils import timezone

from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.authorization_core.application.vip_service import VipService
from apps.site_settings.application.settings_service import SiteSettingsService
from apps.users.models import User, UserMoneyChangeLog, UserPointsChangeLog


def award_daily_login_reward(user):
    if not user or not user.is_authenticated:
        return _empty_result()

    rewards = SiteSettingsService.get_all()["user.rewards"]
    identity = UserIdentityService.resolve(user)
    benefits = VipService.get_benefits(identity.vip_level)
    base_money = max(int(rewards.get("daily_login_reward_money", 0)), 0)
    base_points = max(int(rewards.get("daily_login_reward_points", 0)), 0)
    vip_money = benefits["daily_login_bonus_money"]
    vip_points = benefits["daily_login_bonus_points"]
    money = base_money + vip_money
    points = base_points + vip_points
    if money == 0 and points == 0:
        return _empty_result()

    today = timezone.localdate()
    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        if locked_user.last_login_reward_date == today:
            return _empty_result()

        if money:
            locked_user.money_balance += money
            UserMoneyChangeLog.objects.create(
                user=locked_user,
                change_amount=money,
                balance_after=locked_user.money_balance,
                reason_type=UserMoneyChangeLog.REASON_DAILY_LOGIN_REWARD,
            )
        if points:
            locked_user.points_balance += points
            UserPointsChangeLog.objects.create(
                user=locked_user,
                change_amount=points,
                balance_after=locked_user.points_balance,
                reason_type=UserPointsChangeLog.REASON_DAILY_LOGIN_REWARD,
            )
        locked_user.last_login_reward_date = today
        locked_user.save(update_fields=("money_balance", "points_balance", "last_login_reward_date"))

    return {
        "awarded": True,
        "money": money,
        "points": points,
        "base_money": base_money,
        "base_points": base_points,
        "vip_money": vip_money,
        "vip_points": vip_points,
        "vip_level": identity.vip_level,
    }


def _empty_result():
    return {
        "awarded": False,
        "money": 0,
        "points": 0,
        "base_money": 0,
        "base_points": 0,
        "vip_money": 0,
        "vip_points": 0,
        "vip_level": 0,
    }
