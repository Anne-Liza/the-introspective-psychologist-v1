from hashlib import sha256
from decimal import Decimal
import json

import httpx

from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.modules.commerce_core.service import (
    settle_paid_commerce_payment_request,
)
from app.modules.booking_engine.models import (
    BookingHold,
)
from app.modules.booking_engine.service import (
    record_booking_payment_settlement_review,
    settle_paid_booking_payment_request,
)
from app.modules.mpesa_payments.client import (
    MpesaConfigurationError,
    MpesaOAuthError,
    MpesaQueryRejectedError,
    MpesaQueryUncertainError,
    MpesaSubmissionRejectedError,
    MpesaSubmissionUncertainError,
    build_stk_push_payload,
    build_stk_query_payload,
    fetch_daraja_access_token,
    parse_stk_callback_payload,
    submit_daraja_stk_push,
    submit_daraja_stk_query,
)
from app.modules.mpesa_payments.config import MpesaAdapterConfig, get_mpesa_config
from app.modules.mpesa_payments.schemas import (
    MpesaCallbackParseResult,
    MpesaStkPushPrepareRequest,
    normalize_mpesa_phone,
)
from app.modules.payment_attempts.models import (
    PaymentAttempt,
    PaymentProviderEvent,
)
from app.modules.payment_attempts.schemas import PaymentAttemptCreate, PaymentProviderEventCreate
from app.modules.payment_attempts.service import create_payment_attempt_from_request, record_provider_event, verify_provider_event
from app.modules.payment_requests.models import PaymentRequest
from app.modules.payment_requests.service import create_payment_request_event
from app.modules.receipts.service import (
    issue_receipt_for_paid_payment_request,
)


def assert_mpesa_request_amount_supported(amount: Decimal, currency: str) -> None:
    if currency != "KES":
        raise ValueError("M-Pesa STK Push only supports KES payment requests.")

    if amount <= 0:
        raise ValueError("M-Pesa amount must be greater than zero.")

    if amount != amount.to_integral_value():
        raise ValueError("M-Pesa amount must be a whole KES amount.")


def load_payment_request_for_mpesa(db: Session, payment_request_id: str) -> PaymentRequest:
    payment_request = db.get(PaymentRequest, payment_request_id)
    if payment_request is None:
        raise LookupError("Payment request not found.")

    assert_mpesa_request_amount_supported(payment_request.amount, payment_request.currency)
    return payment_request


def prepare_stk_push_attempt(
    db: Session,
    *,
    payload: MpesaStkPushPrepareRequest,
    initiated_by_user_id: str | None = None,
    config: MpesaAdapterConfig | None = None,
):
    resolved_config = config or get_mpesa_config()

    payment_request = load_payment_request_for_mpesa(
        db,
        payload.payment_request_id,
    )

    if (
        payload.account_reference is not None
        and payload.account_reference
        != payment_request.request_number
    ):
        raise ValueError(
            "account_reference must match the "
            "payment request reference."
        )

    attempt = create_payment_attempt_from_request(
        db,
        payload=PaymentAttemptCreate(
            payment_request_id=payload.payment_request_id,
            provider="mpesa",
            provider_reference=None,
            provider_session_id=None,
            idempotency_key=payload.idempotency_key,
            checkout_url=None,
        ),
        initiated_by_user_id=initiated_by_user_id,
    )

    assert_mpesa_request_amount_supported(
        attempt.amount,
        attempt.currency,
    )

    account_reference = (
        payment_request.request_number
    )
    transaction_desc = (
        payload.transaction_desc
        or payment_request.description
        or (
            "Payment "
            f"{payment_request.request_number}"
        )
    )

    # Build payload now so validation and password construction are tested,
    # but do not send to Daraja in V2.4 first slice.
    _stk_payload = build_stk_push_payload(
        config=resolved_config,
        amount=attempt.amount,
        phone_number=payload.phone_number,
        account_reference=account_reference,
        transaction_desc=transaction_desc,
    )

    return attempt



ACTIVE_PUBLIC_MPESA_ATTEMPT_STATUSES = {
    "created",
    "submitting",
    "processing",
    "needs_review",
}


def public_mpesa_idempotency_key(
    *,
    payment_request_id: str,
    phone_number: str,
) -> str:
    fingerprint = sha256(
        (
            f"{payment_request_id}:"
            f"{phone_number}"
        ).encode("utf-8")
    ).hexdigest()

    return f"public-mpesa-{fingerprint[:40]}"


def prepare_public_stk_push_attempt(
    db: Session,
    *,
    payment_request_id: str,
    phone_number: str,
    config: MpesaAdapterConfig | None = None,
) -> PaymentAttempt:
    normalized_phone = normalize_mpesa_phone(
        phone_number
    )

    payment_request = db.get(
        PaymentRequest,
        payment_request_id,
    )

    if (
        payment_request is None
        or payment_request.target_type
        not in {
            "booking_hold",
            "commerce_order",
        }
    ):
        raise LookupError(
            "Payment request not found."
        )

    if payment_request.provider != "mpesa":
        raise ValueError(
            "Payment request is not configured "
            "for M-Pesa."
        )

    assert_mpesa_request_amount_supported(
        payment_request.amount,
        payment_request.currency,
    )

    if (
        payment_request.expires_at is not None
        and payment_request.expires_at
        <= utc_now()
    ):
        raise ValueError(
            "Payment request has expired."
        )

    if payment_request.status not in {
        "pending",
        "processing",
    }:
        raise ValueError(
            "Payment request is not available "
            "for M-Pesa initiation."
        )

    idempotency_key = (
        public_mpesa_idempotency_key(
            payment_request_id=(
                payment_request.id
            ),
            phone_number=normalized_phone,
        )
    )

    existing_attempt = db.scalar(
        select(PaymentAttempt)
        .where(
            PaymentAttempt.payment_request_id
            == payment_request.id,
            PaymentAttempt.provider == "mpesa",
            PaymentAttempt.status.in_(
                tuple(
                    sorted(
                        ACTIVE_PUBLIC_MPESA_ATTEMPT_STATUSES
                    )
                )
            ),
        )
        .order_by(
            PaymentAttempt.created_at.desc()
        )
    )

    if existing_attempt is not None:
        if (
            existing_attempt.idempotency_key
            == idempotency_key
        ):
            return existing_attempt

        raise ValueError(
            "An active M-Pesa attempt already "
            "exists for this payment request."
        )

    reusable_attempt = db.scalar(
        select(PaymentAttempt).where(
            PaymentAttempt.idempotency_key
            == idempotency_key
        )
    )

    if reusable_attempt is not None:
        if (
            reusable_attempt.payment_request_id
            != payment_request.id
            or reusable_attempt.provider
            != "mpesa"
        ):
            raise ValueError(
                "M-Pesa idempotency key is "
                "already in use."
            )

        if reusable_attempt.status in {
            "failed",
            "cancelled",
        }:
            reusable_attempt.status = "created"
            reusable_attempt.verification_status = (
                "unverified"
            )
            reusable_attempt.provider_reference = None
            reusable_attempt.provider_session_id = None
            reusable_attempt.error_code = None
            reusable_attempt.error_message = None
            reusable_attempt.verified_at = None

            db.add(reusable_attempt)
            db.commit()
            db.refresh(reusable_attempt)
            return reusable_attempt

        raise ValueError(
            "The existing M-Pesa attempt cannot "
            "be restarted."
        )

    if payment_request.status != "pending":
        raise ValueError(
            "Payment request cannot start a new "
            "M-Pesa attempt."
        )

    return prepare_stk_push_attempt(
        db,
        payload=MpesaStkPushPrepareRequest(
            payment_request_id=(
                payment_request.id
            ),
            phone_number=normalized_phone,
            account_reference=(
                payment_request.request_number
            ),
            transaction_desc=(
                payment_request.description
                or (
                    "Booking payment "
                    f"{payment_request.request_number}"
                )
            ),
            idempotency_key=idempotency_key,
        ),
        initiated_by_user_id=None,
        config=config,
    )


def _persist_attempt_state(
    db: Session,
    *,
    attempt: PaymentAttempt,
    status: str,
    error_code: str | None,
    error_message: str | None,
) -> None:
    attempt.status = status
    attempt.error_code = error_code
    attempt.error_message = error_message

    db.add(attempt)
    db.commit()
    db.refresh(attempt)


def initiate_public_stk_push(
    db: Session,
    *,
    payment_request_id: str,
    phone_number: str,
    config: MpesaAdapterConfig | None = None,
    client: httpx.Client | None = None,
) -> PaymentAttempt:
    resolved_config = config or get_mpesa_config()

    attempt = prepare_public_stk_push_attempt(
        db,
        payment_request_id=payment_request_id,
        phone_number=phone_number,
        config=resolved_config,
    )

    if attempt.status == "processing":
        return attempt

    if attempt.status == "needs_review":
        raise ValueError(
            "This M-Pesa attempt requires "
            "review before another prompt can "
            "be sent."
        )

    if attempt.status == "submitting":
        raise ValueError(
            "This M-Pesa attempt is already "
            "being submitted."
        )

    if attempt.status != "created":
        raise ValueError(
            "This M-Pesa attempt cannot be "
            "submitted."
        )

    claim_result = db.execute(
        update(PaymentAttempt)
        .where(
            PaymentAttempt.id == attempt.id,
            PaymentAttempt.status == "created",
        )
        .values(
            status="submitting",
            error_code=None,
            error_message=None,
        )
    )

    claimed = claim_result.rowcount == 1
    db.commit()

    if not claimed:
        db.expire_all()

        current_attempt = db.get(
            PaymentAttempt,
            attempt.id,
        )

        if (
            current_attempt is not None
            and current_attempt.status
            == "processing"
        ):
            return current_attempt

        if (
            current_attempt is not None
            and current_attempt.status
            in {"submitting", "needs_review"}
        ):
            raise ValueError(
                "This M-Pesa attempt is already "
                "active."
            )

        raise ValueError(
            "The M-Pesa attempt could not be "
            "claimed for submission."
        )

    db.refresh(attempt)

    payment_request = db.get(
        PaymentRequest,
        attempt.payment_request_id,
    )

    if payment_request is None:
        _persist_attempt_state(
            db,
            attempt=attempt,
            status="needs_review",
            error_code="missing_payment_request",
            error_message=(
                "The payment request disappeared "
                "during M-Pesa submission."
            ),
        )

        raise LookupError(
            "Payment request not found."
        )

    stk_payload = build_stk_push_payload(
        config=resolved_config,
        amount=attempt.amount,
        phone_number=normalize_mpesa_phone(
            phone_number
        ),
        account_reference=(
            payment_request.request_number
        ),
        transaction_desc=(
            payment_request.description
            or (
                "Booking payment "
                f"{payment_request.request_number}"
            )
        ),
    )

    owns_client = client is None
    resolved_client = client or httpx.Client(
        timeout=20.0
    )

    try:
        access_token = fetch_daraja_access_token(
            config=resolved_config,
            client=resolved_client,
        )

        provider_response = (
            submit_daraja_stk_push(
                config=resolved_config,
                access_token=access_token,
                payload=stk_payload,
                client=resolved_client,
            )
        )
    except MpesaConfigurationError as exc:
        _persist_attempt_state(
            db,
            attempt=attempt,
            status="created",
            error_code="configuration_error",
            error_message=str(exc),
        )
        raise
    except MpesaOAuthError as exc:
        _persist_attempt_state(
            db,
            attempt=attempt,
            status="created",
            error_code="oauth_error",
            error_message=str(exc),
        )
        raise
    except MpesaSubmissionRejectedError as exc:
        _persist_attempt_state(
            db,
            attempt=attempt,
            status="failed",
            error_code=(
                exc.code or "provider_rejected"
            ),
            error_message=str(exc),
        )
        raise
    except MpesaSubmissionUncertainError as exc:
        _persist_attempt_state(
            db,
            attempt=attempt,
            status="needs_review",
            error_code="submission_uncertain",
            error_message=str(exc),
        )
        raise
    finally:
        if owns_client:
            resolved_client.close()

    merchant_request_id = str(
        provider_response["MerchantRequestID"]
    ).strip()
    checkout_request_id = str(
        provider_response["CheckoutRequestID"]
    ).strip()

    previous_request_status = (
        payment_request.status
    )

    attempt.provider_session_id = (
        merchant_request_id
    )
    attempt.provider_reference = (
        checkout_request_id
    )
    attempt.status = "processing"
    attempt.verification_status = "unverified"
    attempt.error_code = None
    attempt.error_message = None

    payment_request.status = "processing"
    payment_request.provider_reference = (
        checkout_request_id
    )

    create_payment_request_event(
        db,
        payment_request=payment_request,
        event_type=(
            "payment_request.processing"
        ),
        from_status=previous_request_status,
        to_status="processing",
        notes=(
            "M-Pesa STK Push accepted by "
            "Daraja."
        ),
    )

    db.add(attempt)
    db.add(payment_request)

    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()

        persisted_attempt = db.get(
            PaymentAttempt,
            attempt.id,
        )

        if persisted_attempt is not None:
            persisted_attempt.status = (
                "needs_review"
            )
            persisted_attempt.error_code = (
                "persistence_error"
            )
            persisted_attempt.error_message = (
                "Daraja accepted the STK Push, "
                "but the provider identifiers "
                "could not be persisted."
            )
            db.add(persisted_attempt)
            db.commit()

        raise MpesaSubmissionUncertainError(
            "Daraja accepted the STK Push, but "
            "the response could not be stored. "
            "Do not send another prompt until "
            "the attempt is reviewed."
        ) from exc

    db.refresh(attempt)
    return attempt

def parse_mpesa_callback(payload: dict) -> MpesaCallbackParseResult:
    parsed = parse_stk_callback_payload(payload)
    return MpesaCallbackParseResult(**parsed)


def callback_result_to_provider_event(
    result: MpesaCallbackParseResult,
    *,
    payment_attempt_id: str | None = None,
) -> PaymentProviderEventCreate:
    event_status = "succeeded" if result.result_code == 0 else "failed"
    amount = Decimal(str(result.amount)) if result.amount is not None else None

    return PaymentProviderEventCreate(
        payment_attempt_id=payment_attempt_id,
        provider="mpesa",
        provider_reference=result.checkout_request_id,
        provider_transaction_reference=(
            result.mpesa_receipt_number
        ),
        external_event_id=result.checkout_request_id,
        event_type="mpesa.stk_callback",
        event_status=event_status,
        verification_status="unverified",
        amount=amount,
        currency="KES" if amount is not None else None,
        raw_payload=result.raw_payload,
        notes=result.result_desc,
    )


def record_mpesa_callback_event(
    db: Session,
    *,
    payload: dict,
    payment_attempt_id: str | None = None,
    force_unverified: bool = True,
):
    parsed = parse_mpesa_callback(payload)
    event_payload = callback_result_to_provider_event(parsed, payment_attempt_id=payment_attempt_id)
    return record_provider_event(db, payload=event_payload, force_unverified=force_unverified)




MPESA_STK_QUERY_VERIFICATION_MARKER = (
    "Verified through Daraja STK status query."
)


def _append_mpesa_note(
    existing: str | None,
    note: str,
) -> str:
    normalized_existing = (
        existing or ""
    ).strip()
    normalized_note = note.strip()

    if not normalized_existing:
        return normalized_note

    if normalized_note in normalized_existing:
        return normalized_existing

    return (
        normalized_existing
        + "\n\n"
        + normalized_note
    )


def _coerce_mpesa_result_code(
    value: object,
) -> int | None:
    try:
        return int(str(value).strip())
    except (
        TypeError,
        ValueError,
    ):
        return None


def query_mpesa_provider_event(
    db: Session,
    *,
    provider_event_id: str,
    config: MpesaAdapterConfig | None = None,
    client: httpx.Client | None = None,
) -> dict:
    event = db.get(
        PaymentProviderEvent,
        provider_event_id,
    )

    if event is None:
        raise LookupError(
            "M-Pesa provider event not found."
        )

    if event.provider != "mpesa":
        raise ValueError(
            "Only M-Pesa provider events can "
            "be queried through Daraja."
        )

    if event.payment_attempt_id is None:
        raise ValueError(
            "M-Pesa provider event is not "
            "matched to a payment attempt."
        )

    attempt = db.get(
        PaymentAttempt,
        event.payment_attempt_id,
    )

    if attempt is None:
        raise ValueError(
            "The matched M-Pesa payment attempt "
            "no longer exists."
        )

    checkout_request_id = (
        attempt.provider_reference or ""
    ).strip()

    if not checkout_request_id:
        raise ValueError(
            "The M-Pesa payment attempt is "
            "missing its CheckoutRequestID."
        )

    if (
        event.provider_reference is not None
        and event.provider_reference.strip()
        != checkout_request_id
    ):
        raise ValueError(
            "The callback CheckoutRequestID "
            "does not match the payment attempt."
        )

    resolved_config = (
        config or get_mpesa_config()
    )

    query_payload = build_stk_query_payload(
        config=resolved_config,
        checkout_request_id=(
            checkout_request_id
        ),
    )

    owns_client = client is None
    resolved_client = client or httpx.Client(
        timeout=20.0
    )

    try:
        access_token = fetch_daraja_access_token(
            config=resolved_config,
            client=resolved_client,
        )

        return submit_daraja_stk_query(
            config=resolved_config,
            access_token=access_token,
            payload=query_payload,
            client=resolved_client,
        )
    finally:
        if owns_client:
            resolved_client.close()


def _reject_mpesa_event_after_query(
    db: Session,
    *,
    event: PaymentProviderEvent,
    attempt: PaymentAttempt,
    reason: str,
) -> PaymentProviderEvent:
    event.verification_status = "rejected"
    event.processed_at = utc_now()
    event.notes = _append_mpesa_note(
        event.notes,
        (
            "Daraja STK status-query evidence "
            f"did not match the callback. {reason}"
        ),
    )

    attempt.status = "needs_review"
    attempt.verification_status = "rejected"
    attempt.error_code = (
        "stk_query_mismatch"
    )
    attempt.error_message = reason

    payment_request = db.get(
        PaymentRequest,
        attempt.payment_request_id,
    )

    if (
        payment_request is not None
        and payment_request.status in {
            "pending",
            "processing",
        }
    ):
        previous_status = payment_request.status
        payment_request.status = "needs_review"

        create_payment_request_event(
            db,
            payment_request=payment_request,
            event_type="payment_request.needs_review",
            from_status=previous_status,
            to_status="needs_review",
            notes=(
                "M-Pesa verification could not "
                "confirm the final transaction status."
            ),
        )

        db.add(payment_request)

    db.add(event)
    db.add(attempt)
    db.commit()
    db.refresh(event)

    return event


def _validate_mpesa_query_agreement(
    db: Session,
    *,
    event: PaymentProviderEvent,
    query_result: dict,
) -> PaymentProviderEvent | None:
    if event.payment_attempt_id is None:
        raise ValueError(
            "M-Pesa provider event is not "
            "matched to a payment attempt."
        )

    attempt = db.get(
        PaymentAttempt,
        event.payment_attempt_id,
    )

    if attempt is None:
        raise ValueError(
            "The matched M-Pesa payment attempt "
            "no longer exists."
        )

    try:
        stored_event_payload = json.loads(
            event.payload_json or "{}"
        )
    except json.JSONDecodeError:
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "The stored callback payload "
                "could not be parsed."
            ),
        )

    if not isinstance(
        stored_event_payload,
        dict,
    ):
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "The stored callback payload "
                "is invalid."
            ),
        )

    raw_callback = stored_event_payload.get(
        "raw_payload",
        stored_event_payload,
    )

    if not isinstance(raw_callback, dict):
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "The stored raw callback payload "
                "is invalid."
            ),
        )

    callback = parse_mpesa_callback(
        raw_callback
    )

    references = {
        value.strip()
        for value in (
            attempt.provider_reference,
            event.provider_reference,
            callback.checkout_request_id,
            (
                str(
                    query_result.get(
                        "CheckoutRequestID"
                    )
                )
                if query_result.get(
                    "CheckoutRequestID"
                )
                is not None
                else None
            ),
        )
        if isinstance(value, str)
        and value.strip()
    }

    if len(references) != 1:
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "CheckoutRequestID values do "
                "not agree."
            ),
        )

    merchant_references = {
        value.strip()
        for value in (
            attempt.provider_session_id,
            callback.merchant_request_id,
            (
                str(
                    query_result.get(
                        "MerchantRequestID"
                    )
                )
                if query_result.get(
                    "MerchantRequestID"
                )
                is not None
                else None
            ),
        )
        if isinstance(value, str)
        and value.strip()
    }

    if len(merchant_references) > 1:
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "MerchantRequestID values do "
                "not agree."
            ),
        )

    callback_result_code = (
        callback.result_code
    )
    query_result_code = (
        _coerce_mpesa_result_code(
            query_result.get("ResultCode")
        )
    )

    if (
        callback_result_code is None
        or query_result_code is None
    ):
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "A trustworthy ResultCode was "
                "not available."
            ),
        )

    if callback_result_code != query_result_code:
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "Callback and status-query "
                "ResultCode values do not agree."
            ),
        )

    expected_event_status = (
        "succeeded"
        if query_result_code == 0
        else "failed"
    )

    if event.event_status != expected_event_status:
        return _reject_mpesa_event_after_query(
            db,
            event=event,
            attempt=attempt,
            reason=(
                "Callback outcome does not "
                "match the Daraja query outcome."
            ),
        )

    return None

def verify_mpesa_provider_event(
    db: Session,
    *,
    provider_event_id: str,
    verified_by_user_id: str | None = None,
    notes: str | None = None,
    config: MpesaAdapterConfig | None = None,
    client: httpx.Client | None = None,
) -> PaymentProviderEvent:
    event = db.get(
        PaymentProviderEvent,
        provider_event_id,
    )

    if event is None:
        raise LookupError(
            "M-Pesa provider event not found."
        )

    if event.provider != "mpesa":
        raise ValueError(
            "Only M-Pesa provider events can be "
            "verified through this route."
        )

    if event.is_duplicate:
        raise ValueError(
            "Duplicate provider events cannot "
            "be verified."
        )

    query_evidence_exists = (
        event.verification_status == "verified"
        and (
            MPESA_STK_QUERY_VERIFICATION_MARKER
            in (event.notes or "")
        )
    )

    if not query_evidence_exists:
        query_result = query_mpesa_provider_event(
            db,
            provider_event_id=provider_event_id,
            config=config,
            client=client,
        )

        rejected_event = (
            _validate_mpesa_query_agreement(
                db,
                event=event,
                query_result=query_result,
            )
        )

        if rejected_event is not None:
            return rejected_event

        verified_event = verify_provider_event(
            db,
            provider_event_id=(
                provider_event_id
            ),
            verified_by_user_id=(
                verified_by_user_id
            ),
            notes=notes,
        )

        if (
            verified_event.verification_status
            == "verified"
            and (
                MPESA_STK_QUERY_VERIFICATION_MARKER
                not in (
                    verified_event.notes or ""
                )
            )
        ):
            verified_event.notes = (
                _append_mpesa_note(
                    verified_event.notes,
                    (
                        MPESA_STK_QUERY_VERIFICATION_MARKER
                    ),
                )
            )
            db.add(verified_event)
            db.commit()
            db.refresh(verified_event)
    else:
        verified_event = event

    if (
        verified_event.verification_status
        == "verified"
        and verified_event.event_status
        == "succeeded"
        and verified_event.payment_request_id
        is not None
    ):
        payment_request_id = (
            verified_event.payment_request_id
        )
        payment_request = db.get(
            PaymentRequest,
            payment_request_id,
        )
        appointment_id: str | None = None

        if (
            payment_request is not None
            and payment_request.target_type
            == "booking_hold"
        ):
            try:
                settle_paid_booking_payment_request(
                    db,
                    payment_request_id=(
                        payment_request.id
                    ),
                )
            except (
                LookupError,
                ValueError,
            ) as exc:
                record_booking_payment_settlement_review(
                    db,
                    payment_request_id=(
                        payment_request.id
                    ),
                    reason=str(exc),
                )

                verified_event = db.get(
                    PaymentProviderEvent,
                    provider_event_id,
                )

                if verified_event is None:
                    raise LookupError(
                        "M-Pesa provider event "
                        "not found."
                    )

                review_marker = (
                    "Booking settlement requires "
                    "manual review or refund."
                )

                verified_event.notes = (
                    _append_mpesa_note(
                        verified_event.notes,
                        review_marker,
                    )
                )

                db.add(verified_event)
                db.commit()

            payment_request = db.get(
                PaymentRequest,
                payment_request_id,
            )

            if payment_request is not None:
                booking_hold = db.get(
                    BookingHold,
                    payment_request.target_id,
                )

                if booking_hold is not None:
                    appointment_id = (
                        booking_hold.appointment_id
                    )

        if (
            payment_request is not None
            and payment_request.target_type
            == "commerce_order"
        ):
            try:
                settle_paid_commerce_payment_request(
                    db,
                    payment_request_id=payment_request.id,
                )
            except (
                LookupError,
                ValueError,
                SQLAlchemyError,
            ) as exc:
                db.rollback()

                verified_event = db.get(
                    PaymentProviderEvent,
                    provider_event_id,
                )

                if verified_event is None:
                    raise LookupError(
                        "M-Pesa provider event not found."
                    )

                verified_event.notes = _append_mpesa_note(
                    verified_event.notes,
                    (
                        "Commerce order settlement "
                        "requires manual review. "
                        f"Error type: {type(exc).__name__}."
                    ),
                )

                db.add(verified_event)
                db.commit()

            payment_request = db.get(
                PaymentRequest,
                payment_request_id,
            )

        if payment_request is not None:
            try:
                issue_receipt_for_paid_payment_request(
                    db,
                    payment_request_id=(
                        payment_request.id
                    ),
                    appointment_id=appointment_id,
                    notes=(
                        "Automatically issued after "
                        "verified M-Pesa payment."
                    ),
                    created_by_user_id=(
                        verified_by_user_id
                    ),
                )
            except (
                LookupError,
                ValueError,
                SQLAlchemyError,
            ) as exc:
                db.rollback()

                verified_event = db.get(
                    PaymentProviderEvent,
                    provider_event_id,
                )

                if verified_event is None:
                    raise LookupError(
                        "M-Pesa provider event "
                        "not found."
                    )

                receipt_review_marker = (
                    "Receipt issuance requires "
                    "manual review. "
                    f"Error type: "
                    f"{type(exc).__name__}."
                )

                verified_event.notes = (
                    _append_mpesa_note(
                        verified_event.notes,
                        receipt_review_marker,
                    )
                )

                db.add(verified_event)
                db.commit()

        verified_event = db.get(
            PaymentProviderEvent,
            provider_event_id,
        )

        if verified_event is None:
            raise LookupError(
                "M-Pesa provider event not found."
            )

    return verified_event
