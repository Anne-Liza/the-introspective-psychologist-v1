from __future__ import annotations

import json
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

BOOKING_POLICY_JSON = '{"allocation_mode": "least_loaded_stable", "allocation_window_days": 30, "booking_mode": "guest_booking", "booking_window_days": 45, "client_accounts_required": false, "confirmation_mode": "instant", "deposit_percentage": 50, "hold_minutes": 10, "locations": [{"key": "westlands", "label": "Westlands, Nairobi"}], "payment_before_booking": true, "payment_policy": "deposit", "recommended_payment_provider": "mpesa", "session_formats": [{"key": "online", "label": "Online", "requires_location": false}, {"key": "in_person", "label": "In person", "requires_location": true}], "therapist_selection": "optional_preference", "timezone": "Africa/Nairobi"}'  # noqa: E501
BOOKING_POLICY: dict[str, Any] = json.loads(BOOKING_POLICY_JSON)


VALID_PAYMENT_POLICIES = {
    "none",
    "pay_later",
    "deposit",
    "full_upfront",
}

VALID_CONFIRMATION_MODES = {
    "instant",
    "staff_approval",
}


def resolve_booking_timezone(
    policy: dict,
) -> str:
    configured = str(
        policy.get("timezone", "UTC")
    ).strip()

    if not configured:
        raise ValueError(
            "Invalid compiled booking timezone."
        )

    try:
        ZoneInfo(configured)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(
            "Invalid compiled booking timezone."
        ) from exc

    return configured


def resolve_booking_payment_policy(
    policy: dict,
) -> str:
    configured = policy.get("payment_policy")

    if configured is None:
        return (
            "full_upfront"
            if bool(
                policy.get(
                    "payment_before_booking",
                    False,
                )
            )
            else "none"
        )

    normalized = str(configured).strip().lower()

    if normalized not in VALID_PAYMENT_POLICIES:
        raise ValueError(
            "Invalid compiled booking payment policy."
        )

    return normalized


def resolve_booking_deposit_percentage(
    policy: dict,
) -> int | None:
    configured_policy = (
        resolve_booking_payment_policy(policy)
    )
    configured_percentage = policy.get(
        "deposit_percentage"
    )

    if configured_policy != "deposit":
        if configured_percentage is not None:
            raise ValueError(
                "Invalid compiled booking deposit "
                "percentage."
            )
        return None

    if type(configured_percentage) is not int:
        raise ValueError(
            "Invalid compiled booking deposit "
            "percentage."
        )

    if not 1 <= configured_percentage <= 99:
        raise ValueError(
            "Invalid compiled booking deposit "
            "percentage."
        )

    return configured_percentage


def resolve_booking_confirmation_mode(
    policy: dict,
) -> str:
    normalized = str(
        policy.get(
            "confirmation_mode",
            "instant",
        )
    ).strip().lower()

    if normalized not in VALID_CONFIRMATION_MODES:
        raise ValueError(
            "Invalid compiled booking "
            "confirmation mode."
        )

    return normalized


def public_booking_policy() -> dict[str, Any]:
    return {
        "booking_mode": BOOKING_POLICY.get("booking_mode", "guest_booking"),
        "client_accounts_required": bool(BOOKING_POLICY.get("client_accounts_required", False)),
        "session_formats": list(BOOKING_POLICY.get("session_formats", [])),
        "locations": list(BOOKING_POLICY.get("locations", [])),
        "therapist_selection": BOOKING_POLICY.get("therapist_selection", "optional_preference"),
        "allocation_mode": BOOKING_POLICY.get("allocation_mode", "least_loaded_stable"),
        "hold_minutes": int(BOOKING_POLICY.get("hold_minutes", 10)),
        "booking_window_days": int(BOOKING_POLICY.get("booking_window_days", 45)),
        "payment_policy": (
            resolve_booking_payment_policy(
                BOOKING_POLICY
            )
        ),
        "deposit_percentage": (
            resolve_booking_deposit_percentage(
                BOOKING_POLICY
            )
        ),
        "confirmation_mode": (
            resolve_booking_confirmation_mode(
                BOOKING_POLICY
            )
        ),
        "payment_before_booking": (
            resolve_booking_payment_policy(
                BOOKING_POLICY
            )
            in {"deposit", "full_upfront"}
        ),
        "recommended_payment_provider": BOOKING_POLICY.get("recommended_payment_provider"),
    }


def booking_timezone() -> str:
    return resolve_booking_timezone(
        BOOKING_POLICY
    )


def payment_policy() -> str:
    return resolve_booking_payment_policy(
        BOOKING_POLICY
    )


def deposit_percentage() -> int | None:
    return resolve_booking_deposit_percentage(
        BOOKING_POLICY
    )


def confirmation_mode() -> str:
    return resolve_booking_confirmation_mode(
        BOOKING_POLICY
    )


def hold_minutes() -> int:
    return max(1, int(BOOKING_POLICY.get("hold_minutes", 10)))


def booking_window_days() -> int:
    return max(1, int(BOOKING_POLICY.get("booking_window_days", 45)))


def allocation_window_days() -> int:
    return max(1, int(BOOKING_POLICY.get("allocation_window_days", 30)))
