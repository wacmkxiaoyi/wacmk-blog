from decimal import Decimal, ROUND_FLOOR

from django.db import IntegrityError, transaction

from apps.site_settings.application.settings_service import SiteSettingsService
from apps.users.models import User, UserMoneyChangeLog, UserPointsChangeLog

from ..infrastructure.models import ResourcePurchased


SETTINGS_KEY_BY_RESOURCE_TYPE = {
    "article": "content.article",
    "book": "content.book",
    "attachment": "upload.attachment",
}


def _ratio(value):
    try:
        return min(max(Decimal(str(value)), Decimal("0")), Decimal("1"))
    except Exception:
        return Decimal("0")


def _reward(amount, ratio):
    return int((Decimal(amount) * ratio).quantize(Decimal("1"), rounding=ROUND_FLOOR))


class ResourceSettlementService:
    @classmethod
    def finalize(cls, *, resource, subject, identity, amount):
        if not identity.is_authenticated:
            return {"ok": False, "message": "Authentication required."}
        if subject.owner_user_id is None:
            return {"ok": False, "message": "This resource has no eligible author for settlement."}
        if identity.user_id == subject.owner_user_id:
            return {"ok": False, "message": "Authors cannot purchase their own resources."}

        amount = int(amount)
        if amount <= 0:
            return {"ok": False, "message": "Invalid settlement amount."}

        with transaction.atomic():
            user_ids = sorted({identity.user_id, subject.owner_user_id})
            users = {user.pk: user for user in User.objects.select_for_update().filter(pk__in=user_ids)}
            buyer = users.get(identity.user_id)
            author = users.get(subject.owner_user_id)
            if buyer is None or author is None or not author.is_active:
                return {"ok": False, "message": "This resource has no eligible author for settlement."}
            if ResourcePurchased.objects.filter(user=buyer, resource_type=subject.resource_type, object_id=resource.pk).exists():
                return {"ok": True, "created": False, "message": ""}
            if buyer.money_balance < amount:
                return {"ok": False, "message": "Insufficient balance."}

            setting_key = SETTINGS_KEY_BY_RESOURCE_TYPE.get(subject.resource_type)
            settings = SiteSettingsService.get_all().get(setting_key, {}) if setting_key else {}
            money_ratio = _ratio(settings.get("author_reward_money_ratio", "0"))
            points_ratio = _ratio(settings.get("author_reward_points_ratio", "0"))
            money_reward = _reward(amount, money_ratio)
            points_reward = _reward(amount, points_ratio)
            try:
                with transaction.atomic():
                    ResourcePurchased.objects.create(user=buyer, resource_type=subject.resource_type, object_id=resource.pk, cost_money=amount)
            except IntegrityError:
                return {"ok": True, "created": False, "message": ""}
            buyer.money_balance -= amount
            buyer.save(update_fields=("money_balance",))
            UserMoneyChangeLog.objects.create(user=buyer, actor=buyer, change_amount=-amount, balance_after=buyer.money_balance, reason_type=UserMoneyChangeLog.REASON_CONTENT_PURCHASE, reason_text=subject.label, related_object_type=subject.resource_type, related_object_id=resource.pk)
            if money_reward:
                author.money_balance += money_reward
                author.save(update_fields=("money_balance",))
                UserMoneyChangeLog.objects.create(user=author, actor=buyer, change_amount=money_reward, balance_after=author.money_balance, reason_type=UserMoneyChangeLog.REASON_AUTHOR_REWARD, reason_text=subject.label, related_object_type=subject.resource_type, related_object_id=resource.pk)
            if points_reward:
                author.points_balance += points_reward
                author.save(update_fields=("points_balance",))
                UserPointsChangeLog.objects.create(user=author, actor=buyer, change_amount=points_reward, balance_after=author.points_balance, reason_type=UserPointsChangeLog.REASON_AUTHOR_REWARD, reason_text=subject.label, related_object_type=subject.resource_type, related_object_id=resource.pk)
        return {"ok": True, "created": True, "message": ""}
