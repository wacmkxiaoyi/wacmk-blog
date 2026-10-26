from ..constants import CHANNEL_COMMON
from .base import BaseHandler


class CommonHandler(BaseHandler):
    channel = CHANNEL_COMMON

    @property
    def visibility(self):
        return self.subject.visibility

    @property
    def condition_rules(self):
        return self.subject.condition_rules
