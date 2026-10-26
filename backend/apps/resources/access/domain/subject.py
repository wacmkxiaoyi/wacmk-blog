from dataclasses import dataclass

from .rules import ConditionRule


@dataclass(frozen=True)
class ResourceSubject:
    resource_type: str
    resource_id: int
    label: str
    owner_user_id: int | None
    visibility: str
    condition_rules: tuple[ConditionRule, ...]
    access_scope: str
    vip_access_permission: str
    vip_condition_rules: tuple[ConditionRule, ...]
    allowed_condition_types: frozenset[str]
    password_hashes: dict[str, str]
