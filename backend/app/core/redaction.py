from __future__ import annotations

import re


SENSITIVE_TEXT_REPLACEMENTS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"(\b(?:token|access_token|refresh_token)=)[^\s&]+", re.IGNORECASE),
        r"\1[REDACTED]",
    ),
    (
        re.compile(r"(Invitation token:\s*)\S+", re.IGNORECASE),
        r"\1[REDACTED]",
    ),
    (
        re.compile(r"(Authorization:\s*Bearer\s+)\S+", re.IGNORECASE),
        r"\1[REDACTED]",
    ),
)


def redact_sensitive_text(value: str | None) -> str | None:
    if value is None:
        return None

    redacted = value
    for pattern, replacement in SENSITIVE_TEXT_REPLACEMENTS:
        redacted = pattern.sub(replacement, redacted)

    return redacted
