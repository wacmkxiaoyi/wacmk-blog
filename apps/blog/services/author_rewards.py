from decimal import Decimal, ROUND_CEILING

from django.db import IntegrityError, transaction
from django.utils.translation import gettext_lazy as _

from apps.blog.access.resolver import get_access_handler
from apps.blog.models import Attachment, AuthorRewardRecord, Book, Post, UserMoneyHistory, UserPointsHistory
from apps.blog.permissions import CONDITION_TYPE_MONEY, CONDITION_TYPE_POINTS, get_condition_rule_value
from apps.blog.services.money import apply_user_money_change
from apps.blog.services.points import apply_user_points_change
from apps.blog.utils import get_site_setting
from apps.blog.utils.site import get_user_vip_level, get_normalized_vip_configs
from apps.users.models import UserProfile


def _get_reward_author_and_type(obj):
    if isinstance(obj, Post):
        return getattr(obj, "author", None), AuthorRewardRecord.OBJECT_TYPE_POST
    if isinstance(obj, Book):
        return getattr(obj, "created_by", None), AuthorRewardRecord.OBJECT_TYPE_BOOK
    if isinstance(obj, Attachment):
        return getattr(obj, "uploaded_by", None), AuthorRewardRecord.OBJECT_TYPE_ATTACHMENT
    return None, ""


def _get_reward_ratios(site_setting, object_type):
    if object_type == AuthorRewardRecord.OBJECT_TYPE_POST:
        return site_setting["article_author_reward_money_ratio"], site_setting["article_author_reward_points_ratio"]
    if object_type == AuthorRewardRecord.OBJECT_TYPE_BOOK:
        return site_setting["book_author_reward_money_ratio"], site_setting["book_author_reward_points_ratio"]
    if object_type == AuthorRewardRecord.OBJECT_TYPE_ATTACHMENT:
        return site_setting["attachment_author_reward_money_ratio"], site_setting["attachment_author_reward_points_ratio"]
    return Decimal("0"), Decimal("0")


def _get_vip_reward_bonus(site_setting, reader):
    vip_level = get_user_vip_level(reader, site_setting)
    if vip_level <= 0:
        return Decimal("0"), Decimal("0")
    vip_configs = get_normalized_vip_configs(site_setting)
    if vip_level > len(vip_configs):
        return Decimal("0"), Decimal("0")
    config = vip_configs[vip_level - 1]
    return Decimal(str(config.get("money_reward", 0) or 0)), Decimal(str(config.get("points_reward", 0) or 0))


def _round_reward(value, ratio, bonus=Decimal("0")):
    if value is None or value <= 0:
        return 0
    ratio = Decimal(str(ratio or 0))
    if ratio <= 0:
        return 0
    bonus = Decimal(str(bonus or 0))
    reward = (Decimal(value) * ratio * (Decimal("1") + bonus)).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return max(int(reward), 0)


def grant_author_reward_once(obj, reader):
    if not getattr(reader, "is_authenticated", False):
        return {"granted": False, "created": False, "reward_money": 0, "reward_points": 0}

    author, object_type = _get_reward_author_and_type(obj)
    if author is None or not object_type or getattr(author, "pk", None) == getattr(reader, "pk", None):
        return {"granted": False, "created": False, "reward_money": 0, "reward_points": 0}

    handler = get_access_handler(obj, reader)
    model_cls = type(obj)
    if handler.effective_visibility != getattr(model_cls, "VISIBILITY_CONDITIONAL", "conditional"):
        return {"granted": False, "created": False, "reward_money": 0, "reward_points": 0}

    condition_rules = handler.condition_rules or []
    money_required = get_condition_rule_value(condition_rules, CONDITION_TYPE_MONEY)
    points_required = get_condition_rule_value(condition_rules, CONDITION_TYPE_POINTS)

    site_setting = get_site_setting()
    money_ratio, points_ratio = _get_reward_ratios(site_setting, object_type)
    money_bonus, points_bonus = _get_vip_reward_bonus(site_setting, reader)
    reward_money = _round_reward(money_required, money_ratio, money_bonus)
    reward_points = _round_reward(points_required, points_ratio, points_bonus)

    if reward_money <= 0 and reward_points <= 0:
        return {"granted": False, "created": False, "reward_money": 0, "reward_points": 0}

    with transaction.atomic():
        try:
            record = AuthorRewardRecord.objects.create(
                reader=reader,
                author=author,
                object_type=object_type,
                object_id=obj.pk,
                reward_money=reward_money,
                reward_points=reward_points,
            )
        except IntegrityError:
            return {"granted": False, "created": False, "reward_money": 0, "reward_points": 0}

        author_profile, _created = UserProfile.objects.select_for_update().get_or_create(user=author)
        if reward_money > 0:
            object_label = getattr(obj, "title", "") or getattr(obj, "name", "") or str(obj)
            reason_text = str(_("Author reward"))
            if object_label:
                reason_text = str(_("Author reward from %(object_type)s: %(title)s")) % {
                    "object_type": object_type,
                    "title": object_label,
                }
            _history, author_profile = apply_user_money_change(
                user=author,
                amount=reward_money,
                reason_type=UserMoneyHistory.REASON_AUTHOR_REWARD,
                reason_text=reason_text,
                related_object_type=object_type,
                related_object_id=obj.pk,
                profile=author_profile,
                save_profile=False,
            )
        if reward_points > 0:
            object_label = getattr(obj, "title", "") or getattr(obj, "name", "") or str(obj)
            reason_text = str(_("Author reward"))
            if object_label:
                reason_text = str(_("Author reward from %(object_type)s: %(title)s")) % {
                    "object_type": object_type,
                    "title": object_label,
                }
            _history, author_profile = apply_user_points_change(
                user=author,
                amount=reward_points,
                reason_type=UserPointsHistory.REASON_AUTHOR_REWARD,
                reason_text=reason_text,
                related_object_type=object_type,
                related_object_id=obj.pk,
                profile=author_profile,
                save_profile=False,
            )

    return {
        "granted": True,
        "created": True,
        "reward_money": record.reward_money,
        "reward_points": record.reward_points,
    }


__all__ = ["grant_author_reward_once"]
