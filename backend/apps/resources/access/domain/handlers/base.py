class BaseHandler:
    channel = "common"

    def __init__(self, subject):
        self.subject = subject

    @property
    def visibility(self):
        raise NotImplementedError

    @property
    def condition_rules(self):
        raise NotImplementedError

    def has_bypass_access(self, identity):
        if not identity.is_authenticated:
            return False
        if identity.is_staff or identity.is_superuser:
            return True
        return identity.user_id is not None and identity.user_id == self.subject.owner_user_id
