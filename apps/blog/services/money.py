from django.db import transaction

from apps.blog.models import UserMoneyHistory
from apps.users.models import UserProfile


def apply_user_money_change(
    *,
    user,
    amount,
    reason_type,
    reason_text,
    related_object_type="",
    related_object_id=None,
    profile=None,
    save_profile=True,
):
    amount = int(amount or 0)
    if amount == 0:
        return None, profile

    with transaction.atomic():
        locked_profile = profile
        if locked_profile is None:
            locked_profile, _created = UserProfile.objects.select_for_update().get_or_create(user=user)
        elif save_profile:
            locked_profile = UserProfile.objects.select_for_update().get(pk=locked_profile.pk)

        locked_profile.money += amount
        locked_profile.save(update_fields=["money"])
        history = UserMoneyHistory.objects.create(
            user=user,
            change_amount=amount,
            balance_after=locked_profile.money,
            reason_type=reason_type,
            reason_text=reason_text,
            related_object_type=related_object_type,
            related_object_id=related_object_id,
        )
    return history, locked_profile


__all__ = ["apply_user_money_change"]
