from ..constants import CHANNEL_VIP
from .base import BaseHandler


class VipStandaloneHandler(BaseHandler):
    channel = CHANNEL_VIP

    @property
    def visibility(self):
        return self.subject.vip_access_permission

    @property
    def condition_rules(self):
        return self.subject.vip_condition_rules
