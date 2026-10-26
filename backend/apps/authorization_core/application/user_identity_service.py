from decimal import Decimal

from .balance_provider import DefaultIdentityBalanceProvider
from ..domain.identity import UserIdentity
from .group_service import GroupService
from .vip_service import VipService


class UserIdentityService:
    balance_provider = DefaultIdentityBalanceProvider()

    @staticmethod
    def resolve(user):
        if not user or not getattr(user, "is_authenticated", False):
            return UserIdentity(
                user_id=None,
                is_authenticated=False,
                is_staff=False,
                is_superuser=False,
                is_vip=False,
                vip_level=0,
                group_names=frozenset(),
                money_discount=Decimal("0"),
                points_discount=Decimal("0"),
                money_balance=0,
                points_balance=0,
            )

        group_names = GroupService.get_group_names(user)
        vip_level = VipService.resolve_vip_level(group_names)
        discounts = VipService.get_discounts(vip_level)
        balances = UserIdentityService.balance_provider.get_balances(user)
        return UserIdentity(
            user_id=user.pk,
            is_authenticated=True,
            is_staff=bool(user.is_staff),
            is_superuser=bool(user.is_superuser),
            is_vip=vip_level > 0,
            vip_level=vip_level,
            group_names=group_names,
            money_discount=discounts["money_discount"],
            points_discount=discounts["points_discount"],
            money_balance=int(balances.money_balance),
            points_balance=int(balances.points_balance),
        )
