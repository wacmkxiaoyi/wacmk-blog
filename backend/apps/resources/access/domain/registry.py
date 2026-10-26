from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .evaluators.base import BaseConditionEvaluator

_registry: dict[str, "BaseConditionEvaluator"] = {}


def register(evaluator: "BaseConditionEvaluator"):
    _registry[evaluator.type] = evaluator


def get(condition_type: str):
    return _registry.get(condition_type)
