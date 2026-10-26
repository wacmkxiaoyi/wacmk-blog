from dataclasses import dataclass

from django.core.exceptions import ValidationError

from .constants import CONDITION_FLAG_TYPES, CONDITION_LABELS, CONDITION_PASSWORD_TYPES, CONDITION_VALUE_TYPES, DEFAULT_ALLOWED_CONDITION_TYPES


@dataclass(frozen=True)
class ConditionRule:
    type: str
    value: object = None


def normalize_condition_rules(raw_rules, *, allowed_types=None):
    if raw_rules in (None, ""):
        return tuple()
    if not isinstance(raw_rules, list):
        raise ValidationError("Condition data must be a list.")

    if allowed_types is None:
        normalized_allowed_types = set(DEFAULT_ALLOWED_CONDITION_TYPES)
    else:
        normalized_allowed_types = {str(item).strip().lower() for item in allowed_types if str(item).strip()}

    normalized = []
    seen_types = set()
    for rule in raw_rules:
        if not isinstance(rule, dict):
            raise ValidationError("Each condition must be an object.")
        condition_type = str(rule.get("type") or "").strip().lower()
        if condition_type not in CONDITION_LABELS or condition_type not in normalized_allowed_types:
            raise ValidationError("Unknown condition type.")
        if condition_type in seen_types:
            raise ValidationError("Each condition type can only be used once.")
        seen_types.add(condition_type)

        if condition_type in CONDITION_VALUE_TYPES:
            raw_value = rule.get("value")
            try:
                value = int(raw_value)
            except (TypeError, ValueError) as exc:
                raise ValidationError("Condition value must be a positive integer.") from exc
            if value < 1:
                raise ValidationError("Condition value must be a positive integer.")
            normalized.append(ConditionRule(type=condition_type, value=value))
            continue

        if condition_type in CONDITION_PASSWORD_TYPES:
            normalized.append(ConditionRule(type=condition_type, value=str(rule.get("value") or "")))
            continue

        if condition_type in CONDITION_FLAG_TYPES:
            normalized.append(ConditionRule(type=condition_type))
            continue

    return tuple(normalized)
