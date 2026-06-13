class BaseAccessHandler:

    def __init__(self, obj):
        self.obj = obj

    @property
    def condition_rules(self):
        raise NotImplementedError

    @property
    def effective_visibility(self):
        raise NotImplementedError

    @property
    def has_conditions(self):
        return bool(self.condition_rules)

    def is_author_or_staff(self, user):
        raise NotImplementedError

    def evaluate(self, user):
        raise NotImplementedError

    def purchase(self, user):
        raise NotImplementedError


__all__ = ["BaseAccessHandler"]
