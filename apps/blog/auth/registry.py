from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .evaluators.base import BaseConditionEvaluator

_registry: dict[str, "BaseConditionEvaluator"] = {}


def register(evaluator: "BaseConditionEvaluator"):
    _registry[evaluator.type] = evaluator


def get(type_: str) -> "BaseConditionEvaluator | None":
    return _registry.get(type_)


def get_allowed_types_for_post():
    return [e.type for e in _registry.values() if e.allowed_on_post]


def get_allowed_types_for_book():
    return [e.type for e in _registry.values() if e.allowed_on_book]


__all__ = ["register", "get", "get_allowed_types_for_post", "get_allowed_types_for_book"]
