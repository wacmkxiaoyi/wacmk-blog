from dataclasses import dataclass


@dataclass(frozen=True)
class BalanceSnapshot:
    money_balance: int = 0
    points_balance: int = 0


class DefaultIdentityBalanceProvider:
    def get_balances(self, user) -> BalanceSnapshot:
        return BalanceSnapshot(
            money_balance=int(getattr(user, "money_balance", 0) or 0),
            points_balance=int(getattr(user, "points_balance", 0) or 0),
        )
