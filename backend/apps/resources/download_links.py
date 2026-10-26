import secrets

from django.core.cache import cache

from .access.domain.constants import ATTACHMENT_DOWNLOAD_TOKEN_TTL_SECONDS


class AttachmentDownloadLinkService:
    @staticmethod
    def cache_key(token):
        return f"attachment-download:{token}"

    @classmethod
    def issue(cls, attachment):
        token = secrets.token_urlsafe(32)
        cache.set(cls.cache_key(token), attachment.pk, timeout=ATTACHMENT_DOWNLOAD_TOKEN_TTL_SECONDS)
        return token

    @classmethod
    def consume(cls, token):
        key = cls.cache_key(token)
        attachment_id = cache.get(key)
        if attachment_id is None:
            return None
        cache.delete(key)
        return attachment_id
