from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class ConditionDecision:
    type: str
    label: str
    icon: str
    tone: str
    requirement: str
    status: str
    action: str
    original_requirement: int | str | None = None
    discounted_requirement: int | str | None = None
    discount_rate: str = ""
    discount_applied: bool = False

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class ResourceAccessDecision:
    resource_type: str
    resource_id: int
    label: str
    access_scope: str
    effective_channel: str
    is_vip: bool
    all_granted: bool
    can_finalize: bool = False
    settlement_required: bool = False
    conditions: tuple[ConditionDecision, ...] = field(default_factory=tuple)

    def to_dict(self):
        payload = asdict(self)
        payload["conditions"] = [condition.to_dict() for condition in self.conditions]
        return payload
