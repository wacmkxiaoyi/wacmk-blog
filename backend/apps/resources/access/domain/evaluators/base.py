from abc import ABC, abstractmethod


class BaseConditionEvaluator(ABC):
    type = ""
    label = ""
    icon = "circle-question"
    tone = "default"

    @abstractmethod
    def evaluate(self, *, rule, subject, identity, context, unlock_state):
        raise NotImplementedError
