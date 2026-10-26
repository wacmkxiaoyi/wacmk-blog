from dataclasses import dataclass


@dataclass(frozen=True)
class AuthorizationResult:
    allowed: bool
    reason_code: str
    reason_message: str
