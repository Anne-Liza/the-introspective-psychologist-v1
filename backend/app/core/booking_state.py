PAYMENT_POLICY_NONE = "none"
PAYMENT_POLICY_PAY_LATER = "pay_later"
PAYMENT_POLICY_DEPOSIT = "deposit"
PAYMENT_POLICY_FULL_UPFRONT = "full_upfront"

ADVANCE_PAYMENT_POLICIES = {
    PAYMENT_POLICY_DEPOSIT,
    PAYMENT_POLICY_FULL_UPFRONT,
}

CONFIRMATION_MODE_INSTANT = "instant"
CONFIRMATION_MODE_STAFF_APPROVAL = "staff_approval"

HOLD_STATUS_ACTIVE = "active"
HOLD_STATUS_PAYMENT_PENDING = "payment_pending"
HOLD_STATUS_PAYMENT_VERIFIED = "payment_verified"
HOLD_STATUS_CONVERTED = "converted"
HOLD_STATUS_EXPIRED = "expired"
HOLD_STATUS_CANCELLED = "cancelled"

VALID_HOLD_STATUSES = {
    HOLD_STATUS_ACTIVE,
    HOLD_STATUS_PAYMENT_PENDING,
    HOLD_STATUS_PAYMENT_VERIFIED,
    HOLD_STATUS_CONVERTED,
    HOLD_STATUS_EXPIRED,
    HOLD_STATUS_CANCELLED,
}

BLOCKING_HOLD_STATUSES = {
    HOLD_STATUS_ACTIVE,
    HOLD_STATUS_PAYMENT_PENDING,
    HOLD_STATUS_PAYMENT_VERIFIED,
}

EXPIRABLE_HOLD_STATUSES = {
    HOLD_STATUS_ACTIVE,
    HOLD_STATUS_PAYMENT_PENDING,
}

HOLD_STATUS_TRANSITIONS = {
    HOLD_STATUS_ACTIVE: {
        HOLD_STATUS_CONVERTED,
        HOLD_STATUS_EXPIRED,
        HOLD_STATUS_CANCELLED,
    },
    HOLD_STATUS_PAYMENT_PENDING: {
        HOLD_STATUS_PAYMENT_VERIFIED,
        HOLD_STATUS_EXPIRED,
        HOLD_STATUS_CANCELLED,
    },
    HOLD_STATUS_PAYMENT_VERIFIED: {
        HOLD_STATUS_CONVERTED,
        HOLD_STATUS_CANCELLED,
    },
    HOLD_STATUS_CONVERTED: set(),
    HOLD_STATUS_EXPIRED: set(),
    HOLD_STATUS_CANCELLED: set(),
}

APPOINTMENT_STATUS_REQUESTED = "requested"
APPOINTMENT_STATUS_CONFIRMED = "confirmed"
APPOINTMENT_STATUS_DECLINED = "declined"
APPOINTMENT_STATUS_CANCELLED = "cancelled"
APPOINTMENT_STATUS_COMPLETED = "completed"
APPOINTMENT_STATUS_NO_SHOW = "no_show"

VALID_APPOINTMENT_STATUSES = {
    APPOINTMENT_STATUS_REQUESTED,
    APPOINTMENT_STATUS_CONFIRMED,
    APPOINTMENT_STATUS_DECLINED,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_COMPLETED,
    APPOINTMENT_STATUS_NO_SHOW,
}

BLOCKING_APPOINTMENT_STATUSES = {
    APPOINTMENT_STATUS_REQUESTED,
    APPOINTMENT_STATUS_CONFIRMED,
}

APPOINTMENT_STATUS_TRANSITIONS = {
    APPOINTMENT_STATUS_REQUESTED: {
        APPOINTMENT_STATUS_CONFIRMED,
        APPOINTMENT_STATUS_DECLINED,
        APPOINTMENT_STATUS_CANCELLED,
    },
    APPOINTMENT_STATUS_CONFIRMED: {
        APPOINTMENT_STATUS_CANCELLED,
        APPOINTMENT_STATUS_COMPLETED,
        APPOINTMENT_STATUS_NO_SHOW,
    },
    APPOINTMENT_STATUS_DECLINED: set(),
    APPOINTMENT_STATUS_CANCELLED: set(),
    APPOINTMENT_STATUS_COMPLETED: set(),
    APPOINTMENT_STATUS_NO_SHOW: set(),
}


def requires_advance_payment(payment_policy: str) -> bool:
    return payment_policy in ADVANCE_PAYMENT_POLICIES


def initial_hold_status(payment_policy: str) -> str:
    if requires_advance_payment(payment_policy):
        return HOLD_STATUS_PAYMENT_PENDING

    return HOLD_STATUS_ACTIVE


def hold_can_confirm(
    hold_status: str,
    payment_policy: str,
) -> bool:
    if requires_advance_payment(payment_policy):
        return hold_status == HOLD_STATUS_PAYMENT_VERIFIED

    return hold_status == HOLD_STATUS_ACTIVE


def appointment_status_for_confirmation_mode(
    confirmation_mode: str,
) -> str:
    if confirmation_mode == CONFIRMATION_MODE_STAFF_APPROVAL:
        return APPOINTMENT_STATUS_REQUESTED

    if confirmation_mode == CONFIRMATION_MODE_INSTANT:
        return APPOINTMENT_STATUS_CONFIRMED

    raise ValueError(
        "Unsupported booking confirmation mode."
    )


def assert_hold_status_transition(
    current_status: str,
    next_status: str,
) -> None:
    if current_status == next_status:
        return

    allowed = HOLD_STATUS_TRANSITIONS.get(current_status)

    if allowed is None or next_status not in allowed:
        raise ValueError(
            "Invalid booking hold status transition: "
            f"{current_status} -> {next_status}."
        )


def assert_appointment_status_transition(
    current_status: str,
    next_status: str,
) -> None:
    if current_status == next_status:
        return

    allowed = APPOINTMENT_STATUS_TRANSITIONS.get(
        current_status
    )

    if allowed is None or next_status not in allowed:
        raise ValueError(
            "Invalid appointment status transition: "
            f"{current_status} -> {next_status}."
        )
