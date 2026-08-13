from base64 import b64encode
from datetime import datetime
from decimal import Decimal
from typing import Any

import httpx


def stringify_optional(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)

from app.modules.mpesa_payments.config import MpesaAdapterConfig


def build_mpesa_timestamp(now: datetime | None = None) -> str:
    timestamp_source = now or datetime.utcnow()
    return timestamp_source.strftime("%Y%m%d%H%M%S")


def build_stk_password(*, shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}".encode("utf-8")
    return b64encode(raw).decode("utf-8")


def build_stk_push_payload(
    *,
    config: MpesaAdapterConfig,
    amount: Decimal,
    phone_number: str,
    account_reference: str,
    transaction_desc: str,
    timestamp: str | None = None,
) -> dict[str, Any]:
    resolved_timestamp = timestamp or build_mpesa_timestamp()
    return {
        "BusinessShortCode": config.shortcode,
        "Password": build_stk_password(
            shortcode=config.shortcode,
            passkey=config.passkey,
            timestamp=resolved_timestamp,
        ),
        "Timestamp": resolved_timestamp,
        "TransactionType": config.transaction_type,
        "Amount": int(amount),
        "PartyA": phone_number,
        "PartyB": config.shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": config.callback_url,
        "AccountReference": account_reference,
        "TransactionDesc": transaction_desc,
    }


def build_stk_query_payload(
    *,
    config: MpesaAdapterConfig,
    checkout_request_id: str,
    timestamp: str | None = None,
) -> dict[str, Any]:
    normalized_checkout_request_id = (
        checkout_request_id.strip()
    )

    if not normalized_checkout_request_id:
        raise ValueError(
            "CheckoutRequestID is required."
        )

    resolved_timestamp = (
        timestamp or build_mpesa_timestamp()
    )

    return {
        "BusinessShortCode": config.shortcode,
        "Password": build_stk_password(
            shortcode=config.shortcode,
            passkey=config.passkey,
            timestamp=resolved_timestamp,
        ),
        "Timestamp": resolved_timestamp,
        "CheckoutRequestID": (
            normalized_checkout_request_id
        ),
    }



class MpesaClientError(RuntimeError):
    """Base error for the Daraja HTTP boundary."""


class MpesaConfigurationError(
    MpesaClientError
):
    """Raised when required M-Pesa settings are absent."""


class MpesaOAuthError(MpesaClientError):
    """Raised before an STK request can be submitted."""


class MpesaSubmissionRejectedError(
    MpesaClientError
):
    """Raised when Daraja explicitly rejects a request."""

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code


class MpesaSubmissionUncertainError(
    MpesaClientError
):
    """
    Raised when an STK request may have reached Daraja
    but no trustworthy acceptance response was received.
    """


class MpesaQueryRejectedError(
    MpesaClientError
):
    """
    Raised when Daraja explicitly rejects an
    STK status-query request.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code


class MpesaQueryUncertainError(
    MpesaClientError
):
    """
    Raised when Daraja does not return a
    trustworthy STK status-query response.
    """


def assert_mpesa_configured(
    config: MpesaAdapterConfig,
) -> None:
    if not config.is_configured:
        raise MpesaConfigurationError(
            "M-Pesa is not fully configured."
        )


def fetch_daraja_access_token(
    *,
    config: MpesaAdapterConfig,
    client: httpx.Client,
) -> str:
    assert_mpesa_configured(config)

    try:
        response = client.get(
            config.oauth_url,
            params={
                "grant_type": (
                    "client_credentials"
                )
            },
            auth=(
                config.consumer_key,
                config.consumer_secret,
            ),
        )
    except httpx.RequestError as exc:
        raise MpesaOAuthError(
            "M-Pesa authentication is "
            "temporarily unavailable."
        ) from exc

    if response.status_code >= 400:
        raise MpesaOAuthError(
            "M-Pesa authentication was rejected."
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise MpesaOAuthError(
            "M-Pesa authentication returned an "
            "invalid response."
        ) from exc

    if not isinstance(payload, dict):
        raise MpesaOAuthError(
            "M-Pesa authentication returned an "
            "invalid response."
        )

    access_token = payload.get("access_token")

    if (
        not isinstance(access_token, str)
        or not access_token.strip()
    ):
        raise MpesaOAuthError(
            "M-Pesa authentication did not "
            "return an access token."
        )

    return access_token.strip()


def _safe_provider_error(
    response: httpx.Response,
) -> tuple[str | None, str]:
    try:
        payload = response.json()
    except ValueError:
        return (
            str(response.status_code),
            "M-Pesa rejected the STK request.",
        )

    if not isinstance(payload, dict):
        return (
            str(response.status_code),
            "M-Pesa rejected the STK request.",
        )

    raw_code = (
        payload.get("errorCode")
        or payload.get("ResponseCode")
        or response.status_code
    )
    raw_message = (
        payload.get("errorMessage")
        or payload.get("ResponseDescription")
        or payload.get("CustomerMessage")
        or "M-Pesa rejected the STK request."
    )

    return (
        str(raw_code) if raw_code is not None else None,
        str(raw_message),
    )


def submit_daraja_stk_push(
    *,
    config: MpesaAdapterConfig,
    access_token: str,
    payload: dict[str, Any],
    client: httpx.Client,
) -> dict[str, Any]:
    assert_mpesa_configured(config)

    try:
        response = client.post(
            config.stk_push_url,
            headers={
                "Authorization": (
                    f"Bearer {access_token}"
                ),
                "Content-Type": (
                    "application/json"
                ),
            },
            json=payload,
        )
    except httpx.RequestError as exc:
        raise MpesaSubmissionUncertainError(
            "The M-Pesa request may have been "
            "submitted, but no response was "
            "received. Do not send another "
            "request until this attempt is "
            "reviewed."
        ) from exc

    if response.status_code >= 500:
        raise MpesaSubmissionUncertainError(
            "M-Pesa returned a temporary server "
            "error after submission. The attempt "
            "must be reviewed before retrying."
        )

    if response.status_code >= 400:
        code, message = _safe_provider_error(
            response
        )
        raise MpesaSubmissionRejectedError(
            message,
            code=code,
        )

    try:
        response_payload = response.json()
    except ValueError as exc:
        raise MpesaSubmissionUncertainError(
            "M-Pesa returned an unreadable STK "
            "response. The attempt must be "
            "reviewed before retrying."
        ) from exc

    if not isinstance(response_payload, dict):
        raise MpesaSubmissionUncertainError(
            "M-Pesa returned an invalid STK "
            "response. The attempt must be "
            "reviewed before retrying."
        )

    response_code = response_payload.get(
        "ResponseCode"
    )

    if str(response_code) != "0":
        code, message = _safe_provider_error(
            response
        )
        raise MpesaSubmissionRejectedError(
            message,
            code=code,
        )

    merchant_request_id = response_payload.get(
        "MerchantRequestID"
    )
    checkout_request_id = response_payload.get(
        "CheckoutRequestID"
    )

    if (
        not isinstance(
            merchant_request_id,
            str,
        )
        or not merchant_request_id.strip()
        or not isinstance(
            checkout_request_id,
            str,
        )
        or not checkout_request_id.strip()
    ):
        raise MpesaSubmissionUncertainError(
            "M-Pesa accepted the request without "
            "returning complete transaction "
            "identifiers. The attempt must be "
            "reviewed before retrying."
        )

    return response_payload


def _safe_query_error(
    response: httpx.Response,
) -> tuple[str | None, str]:
    try:
        payload = response.json()
    except ValueError:
        return (
            str(response.status_code),
            "M-Pesa rejected the STK status query.",
        )

    if not isinstance(payload, dict):
        return (
            str(response.status_code),
            "M-Pesa rejected the STK status query.",
        )

    raw_code = (
        payload.get("errorCode")
        or payload.get("ResponseCode")
        or response.status_code
    )
    raw_message = (
        payload.get("errorMessage")
        or payload.get("ResponseDescription")
        or payload.get("ResultDesc")
        or (
            "M-Pesa rejected the STK "
            "status query."
        )
    )

    return (
        (
            str(raw_code)
            if raw_code is not None
            else None
        ),
        str(raw_message),
    )


def submit_daraja_stk_query(
    *,
    config: MpesaAdapterConfig,
    access_token: str,
    payload: dict[str, Any],
    client: httpx.Client,
) -> dict[str, Any]:
    assert_mpesa_configured(config)

    expected_checkout_request_id = str(
        payload.get("CheckoutRequestID") or ""
    ).strip()

    if not expected_checkout_request_id:
        raise ValueError(
            "CheckoutRequestID is required."
        )

    try:
        response = client.post(
            config.stk_query_url,
            headers={
                "Authorization": (
                    f"Bearer {access_token}"
                ),
                "Content-Type": (
                    "application/json"
                ),
            },
            json=payload,
        )
    except httpx.RequestError as exc:
        raise MpesaQueryUncertainError(
            "M-Pesa transaction status could "
            "not be confirmed because the query "
            "request did not receive a response."
        ) from exc

    if response.status_code >= 500:
        raise MpesaQueryUncertainError(
            "M-Pesa returned a temporary server "
            "error while checking transaction "
            "status."
        )

    if response.status_code >= 400:
        code, message = _safe_query_error(
            response
        )
        raise MpesaQueryRejectedError(
            message,
            code=code,
        )

    try:
        response_payload = response.json()
    except ValueError as exc:
        raise MpesaQueryUncertainError(
            "M-Pesa returned an unreadable "
            "transaction-status response."
        ) from exc

    if not isinstance(response_payload, dict):
        raise MpesaQueryUncertainError(
            "M-Pesa returned an invalid "
            "transaction-status response."
        )

    response_code = response_payload.get(
        "ResponseCode"
    )

    if str(response_code) != "0":
        code, message = _safe_query_error(
            response
        )
        raise MpesaQueryRejectedError(
            message,
            code=code,
        )

    returned_checkout_request_id = (
        response_payload.get(
            "CheckoutRequestID"
        )
    )

    if (
        not isinstance(
            returned_checkout_request_id,
            str,
        )
        or not returned_checkout_request_id.strip()
    ):
        raise MpesaQueryUncertainError(
            "M-Pesa did not return the "
            "CheckoutRequestID for the queried "
            "transaction."
        )

    if (
        returned_checkout_request_id.strip()
        != expected_checkout_request_id
    ):
        raise MpesaQueryUncertainError(
            "M-Pesa returned a status response "
            "for a different transaction."
        )

    if response_payload.get("ResultCode") is None:
        raise MpesaQueryUncertainError(
            "M-Pesa did not return a transaction "
            "result code."
        )

    return response_payload

def parse_callback_metadata_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    parsed: dict[str, Any] = {}

    for item in items:
        name = item.get("Name")
        if not name:
            continue
        parsed[str(name)] = item.get("Value")

    return parsed


def parse_stk_callback_payload(payload: dict[str, Any]) -> dict[str, Any]:
    callback = (
        payload.get("Body", {})
        .get("stkCallback", {})
    )

    metadata_items = (
        callback.get("CallbackMetadata", {})
        .get("Item", [])
    )

    metadata = parse_callback_metadata_items(metadata_items if isinstance(metadata_items, list) else [])

    return {
        "merchant_request_id": callback.get("MerchantRequestID"),
        "checkout_request_id": callback.get("CheckoutRequestID"),
        "result_code": callback.get("ResultCode"),
        "result_desc": callback.get("ResultDesc"),
        "amount": metadata.get("Amount"),
        "mpesa_receipt_number": metadata.get("MpesaReceiptNumber"),
        "transaction_date": stringify_optional(metadata.get("TransactionDate")),
        "phone_number": stringify_optional(metadata.get("PhoneNumber")),
        "raw_payload": payload,
    }
