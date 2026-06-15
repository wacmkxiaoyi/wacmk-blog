from django.db import IntegrityError, transaction
from django.utils.translation import gettext_lazy as _

from apps.blog.models import CommentRewardRecord, UserMoneyHistory, UserPointsHistory
from apps.blog.services.money import apply_user_money_change
from apps.blog.services.points import apply_user_points_change
from apps.blog.utils import get_site_setting
from apps.blog.utils.site import get_normalized_vip_configs, get_user_vip_level
from apps.users.models import UserProfile


def grant_first_comment_reward_once(comment):
    user = getattr(comment, "author", None)
    post = getattr(comment, "post", None)
    if user is None or post is None or not getattr(user, "is_authenticated", False):
        return {
            "granted": False,
            "created": False,
            "reward_money": 0,
            "reward_points": 0,
            "base_reward_money": 0,
            "base_reward_points": 0,
            "vip_reward_money": 0,
            "vip_reward_points": 0,
            "vip_display_name": "",
        }

    site_setting = get_site_setting()
    base_reward_money = max(int(site_setting.get("comment_first_reward_money", 1) or 0), 0)
    base_reward_points = max(int(site_setting.get("comment_first_reward_points", 1) or 0), 0)
    vip_reward_money = 0
    vip_reward_points = 0
    vip_display_name = ""
    vip_level = get_user_vip_level(user, site_setting)
    if vip_level > 0:
        vip_configs = get_normalized_vip_configs(site_setting)
        if vip_level <= len(vip_configs):
            vip_config = vip_configs[vip_level - 1]
            vip_display_name = str(vip_config.get("display_name") or "")
            vip_reward_money = max(int(vip_config.get("first_comment_bonus_money", 0) or 0), 0)
            vip_reward_points = max(int(vip_config.get("first_comment_bonus_points", 0) or 0), 0)

    reward_money = base_reward_money + vip_reward_money
    reward_points = base_reward_points + vip_reward_points

    if reward_money <= 0 and reward_points <= 0:
        return {
            "granted": False,
            "created": False,
            "reward_money": 0,
            "reward_points": 0,
            "base_reward_money": base_reward_money,
            "base_reward_points": base_reward_points,
            "vip_reward_money": vip_reward_money,
            "vip_reward_points": vip_reward_points,
            "vip_display_name": vip_display_name,
        }

    with transaction.atomic():
        try:
            record = CommentRewardRecord.objects.create(
                user=user,
                post=post,
                comment=comment,
                reward_money=reward_money,
                reward_points=reward_points,
            )
        except IntegrityError:
            return {
                "granted": False,
                "created": False,
                "reward_money": 0,
                "reward_points": 0,
                "base_reward_money": base_reward_money,
                "base_reward_points": base_reward_points,
                "vip_reward_money": vip_reward_money,
                "vip_reward_points": vip_reward_points,
                "vip_display_name": vip_display_name,
            }

        profile, _created = UserProfile.objects.select_for_update().get_or_create(user=user)
        if reward_money > 0:
            reason_text = str(_("First comment reward"))
            if post.title:
                reason_text = str(_("First comment reward for article: %(title)s")) % {"title": post.title}
            _history, profile = apply_user_money_change(
                user=user,
                amount=reward_money,
                reason_type=UserMoneyHistory.REASON_FIRST_COMMENT_REWARD,
                reason_text=reason_text,
                related_object_type=UserMoneyHistory.RELATED_OBJECT_TYPE_COMMENT,
                related_object_id=comment.pk,
                profile=profile,
                save_profile=False,
            )
        if reward_points > 0:
            reason_text = str(_("First comment reward"))
            if post.title:
                reason_text = str(_("First comment reward for article: %(title)s")) % {"title": post.title}
            _history, profile = apply_user_points_change(
                user=user,
                amount=reward_points,
                reason_type=UserPointsHistory.REASON_FIRST_COMMENT_REWARD,
                reason_text=reason_text,
                related_object_type=UserPointsHistory.RELATED_OBJECT_TYPE_COMMENT,
                related_object_id=comment.pk,
                profile=profile,
                save_profile=False,
            )

    return {
        "granted": True,
        "created": True,
        "reward_money": record.reward_money,
        "reward_points": record.reward_points,
        "base_reward_money": base_reward_money,
        "base_reward_points": base_reward_points,
        "vip_reward_money": vip_reward_money,
        "vip_reward_points": vip_reward_points,
        "vip_display_name": vip_display_name,
    }


__all__ = ["grant_first_comment_reward_once"]
