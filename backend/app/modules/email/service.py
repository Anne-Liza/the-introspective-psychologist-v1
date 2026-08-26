from email.message import EmailMessage
import smtplib

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redaction import redact_sensitive_text
from app.core.time import utc_now
from app.modules.email.models import EmailLog


def send_email(
    db: Session,
    *,
    to_email: str,
    subject: str,
    body: str,
) -> EmailLog:
    log = EmailLog(
        to_email=to_email,
        subject=subject,
        body=redact_sensitive_text(body),
        provider=settings.EMAIL_PROVIDER,
        status="queued",
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    try:
        provider = settings.EMAIL_PROVIDER.lower()

        if provider == "brevo":
            if not settings.BREVO_API_KEY:
                raise RuntimeError("BREVO_API_KEY is not configured.")

            response = httpx.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "accept": "application/json",
                    "content-type": "application/json",
                },
                json={
                    "sender": {
                        "email": settings.EMAIL_FROM,
                    },
                    "to": [
                        {
                            "email": to_email,
                        }
                    ],
                    "subject": subject,
                    "textContent": body,
                },
                timeout=10.0,
            )
            response.raise_for_status()

        elif provider == "smtp":
            message = EmailMessage()
            message["From"] = settings.EMAIL_FROM
            message["To"] = to_email
            message["Subject"] = subject
            message.set_content(body)

            with smtplib.SMTP(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=10,
            ) as smtp:
                if settings.SMTP_USE_TLS:
                    smtp.starttls()

                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    smtp.login(
                        settings.SMTP_USERNAME,
                        settings.SMTP_PASSWORD,
                    )

                smtp.send_message(message)

        else:
            raise RuntimeError(
                f"Unsupported email provider: {settings.EMAIL_PROVIDER}"
            )

        log.status = "sent"
        log.sent_at = utc_now()

    except Exception as exc:
        log.status = "failed"
        log.error_message = redact_sensitive_text(str(exc))

    db.add(log)
    db.commit()
    db.refresh(log)

    return log
