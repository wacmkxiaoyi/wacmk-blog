from ..domain.constants import ACCESS_SCOPE_STANDALONE
from ..domain.handlers import CommonHandler, VipStandaloneHandler


class HandlerResolver:
    @staticmethod
    def resolve(subject, identity):
        if subject.access_scope == ACCESS_SCOPE_STANDALONE and identity.is_vip:
            return VipStandaloneHandler(subject)
        return CommonHandler(subject)
