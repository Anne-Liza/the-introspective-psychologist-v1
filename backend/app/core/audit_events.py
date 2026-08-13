from __future__ import annotations

from enum import StrEnum
from typing import Any

from app.core.request_context import get_request_id
from app.core.structured_logging import log_event


class AuditAction(StrEnum):
    AUTH_REGISTERED = "auth.registered"
    AUTH_EMAIL_VERIFIED = "auth.email_verified"
    AUTH_PASSWORD_RESET_REQUESTED = "auth.password_reset.requested"
    AUTH_PASSWORD_RESET_COMPLETED = "auth.password_reset.completed"
    AUTH_LOGIN_SUCCESS = "auth.login.success"
    AUTH_LOGIN_FAILED = "auth.login.failed"
    AUTH_REFRESH_ROTATED = "auth.refresh.rotated"
    AUTH_LOGOUT = "auth.logout"

    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_ROLES_ASSIGNED = "user.roles_assigned"

    FILE_METADATA_CREATED = "file.metadata_created"
    FILE_UPLOADED = "file.uploaded"
    FILE_DELETED = "file.deleted"

    INVITATION_CREATED = "invitation.created"
    INVITATION_ACCEPTED = "invitation.accepted"
    INVITATION_REVOKED = "invitation.revoked"
    INVITATION_RESENT = "invitation.resent"
    INVITATION_EXPIRED = "invitation.expired"

    APP_GENERATION_PREVIEWED = "app_generation.previewed"
    APP_GENERATION_CREATED = "app_generation.created"

    PAYMENT_CHECKOUT_CREATED = "payment.checkout.created"
    PAYMENT_STATUS_CHANGED = "payment.status_changed"
    PAYMENT_REQUEST_CREATED = "payment_request.created"
    PAYMENT_REQUEST_STATUS_CHANGED = "payment_request.status_changed"
    PAYMENT_ATTEMPT_CREATED = "payment_attempt.created"
    PAYMENT_PROVIDER_EVENT_RECORDED = "payment_provider_event.recorded"
    PAYMENT_ATTEMPT_VERIFIED = "payment_attempt.verified"
    MPESA_STK_PUSH_PREPARED = "mpesa.stk_push.prepared"
    MPESA_STK_PUSH_INITIATED = "mpesa.stk_push.initiated"
    MPESA_CALLBACK_RECEIVED = "mpesa.callback.received"
    RECEIPT_CREATED = "receipt.created"
    RECEIPT_STATUS_CHANGED = "receipt.status_changed"
    FULFILLMENT_CREATED = "fulfillment.created"
    FULFILLMENT_STATUS_CHANGED = "fulfillment.status_changed"
    CLIENT_RECORD_CREATED = "client_record.created"
    CLIENT_RECORD_UPDATED = "client_record.updated"
    CLIENT_RECORD_LINKED = "client_record.linked"

    SETTINGS_UPDATED = "settings.updated"


AUDIT_ACTIONS = {item.value for item in AuditAction}


def validate_audit_action(action: str | AuditAction) -> str:
    value = str(action)

    if value not in AUDIT_ACTIONS:
        raise ValueError(f"Unsupported audit action: {value}")

    return value


def record_audit_event(
    db,
    *,
    action: str | AuditAction,
    actor=None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
):
    """
    Record a sanitized audit event.

    When the audit_logs module is available, persistence stays delegated to its
    service layer so audit metadata sanitization remains centralized.

    Generated apps may not include the audit_logs module. In that case, this
    helper emits a sanitized structured log fallback instead of creating a hard
    dependency from core modules such as auth/files/users to audit_logs.
    """
    validated_action = validate_audit_action(action)

    try:
        from app.modules.audit_logs.service import create_audit_log
    except ModuleNotFoundError as exc:
        missing_name = exc.name or ""

        if missing_name == "app.modules.audit_logs" or missing_name.startswith("app.modules.audit_logs."):
            return log_event(
                event="audit.event",
                level="info",
                message="Audit event recorded through structured log fallback.",
                metadata={
                    "action": validated_action,
                    "actor_user_id": getattr(actor, "id", None),
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "audit_sink": "structured_log_fallback",
                    "payload": metadata or {},
                },
                request_id=get_request_id(),
            )

        raise

    return create_audit_log(
        db,
        action=validated_action,
        actor=actor,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata=metadata or {},
    )
