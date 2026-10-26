from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.users.models import User, UserMoneyChangeLog, UserPointsChangeLog


def _apply_change(*, user_id, field_name, log_model, amount, reason_type, reason_text="", actor=None, related_object_type="", related_object_id=None):
    amount = int(amount)
    if amount == 0:
        return None, None

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user_id)
        balance_after = getattr(user, field_name) + amount
        if balance_after < 0:
            raise ValidationError({field_name: "Balance cannot be negative."})
        setattr(user, field_name, balance_after)
        user.save(update_fields=(field_name,))
        entry = log_model.objects.create(
            user=user,
            actor=actor,
            change_amount=amount,
            balance_after=balance_after,
            reason_type=reason_type,
            reason_text=reason_text,
            related_object_type=related_object_type,
            related_object_id=related_object_id,
        )
    return user, entry


def change_money(*, user_id, amount, reason_type, reason_text="", actor=None, related_object_type="", related_object_id=None):
    return _apply_change(
        user_id=user_id,
        field_name="money_balance",
        log_model=UserMoneyChangeLog,
        amount=amount,
        reason_type=reason_type,
        reason_text=reason_text,
        actor=actor,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )


def change_points(*, user_id, amount, reason_type, reason_text="", actor=None, related_object_type="", related_object_id=None):
    return _apply_change(
        user_id=user_id,
        field_name="points_balance",
        log_model=UserPointsChangeLog,
        amount=amount,
        reason_type=reason_type,
        reason_text=reason_text,
        actor=actor,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )


def set_balances(*, user_id, money_balance, points_balance, reason_text="", actor=None):
    """Set administrative targets while deriving auditable signed ledger changes."""
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user_id)
        money_delta = int(money_balance) - user.money_balance
        points_delta = int(points_balance) - user.points_balance
        if money_delta:
            user.money_balance += money_delta
            UserMoneyChangeLog.objects.create(
                user=user,
                actor=actor,
                change_amount=money_delta,
                balance_after=user.money_balance,
                reason_type=UserMoneyChangeLog.REASON_ADMIN_ADJUSTMENT,
                reason_text=reason_text,
            )
        if points_delta:
            user.points_balance += points_delta
            UserPointsChangeLog.objects.create(
                user=user,
                actor=actor,
                change_amount=points_delta,
                balance_after=user.points_balance,
                reason_type=UserPointsChangeLog.REASON_ADMIN_ADJUSTMENT,
                reason_text=reason_text,
            )
        if money_delta or points_delta:
            user.save(update_fields=("money_balance", "points_balance"))
    return user, money_delta, points_delta
