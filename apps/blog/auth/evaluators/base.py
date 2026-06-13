class BaseConditionEvaluator:
    type: str = ""
    label: str = ""
    icon: str = ""
    tone: str = ""
    value_kind: str = ""
    allowed_on_post: bool = True
    allowed_on_book: bool = True

    def evaluate(self, user, value, *, has_purchase=False, profile=None):
        raise NotImplementedError

    def get_display(self, value):
        display = {
            "type": self.type,
            "icon": self.icon,
            "tone": self.tone,
            "label": str(self.label),
        }
        if self.value_kind == "integer":
            display["value"] = value
        return display


__all__ = ["BaseConditionEvaluator"]
