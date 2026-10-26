from dataclasses import dataclass, field
from typing import Any, Mapping


@dataclass(frozen=True)
class ResourceAccessContext:
    book_context: bool = False
    share_context: bool = False
    extra: Mapping[str, Any] = field(default_factory=dict)
