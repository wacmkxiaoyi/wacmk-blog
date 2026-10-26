from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class UserIdentity:
    user_id: int | None
    is_authenticated: bool
    is_staff: bool
    is_superuser: bool
    is_vip: bool
    vip_level: int
    group_names: frozenset[str]
    money_discount: Decimal
    points_discount: Decimal
    money_balance: int
    points_balance: int
