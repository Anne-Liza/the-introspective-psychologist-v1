import asyncio
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.mpesa_payments.service import (
    claim_next_due_mpesa_reconciliation,
    process_claimed_mpesa_reconciliation,
)


logger = logging.getLogger(__name__)


def run_mpesa_reconciliation_cycle() -> int:
    processed = 0

    for _ in range(
        settings.MPESA_RECONCILIATION_BATCH_SIZE
    ):
        db = SessionLocal()

        try:
            attempt = (
                claim_next_due_mpesa_reconciliation(
                    db
                )
            )

            if attempt is None:
                return processed

            process_claimed_mpesa_reconciliation(
                db,
                attempt=attempt,
            )

            processed += 1

        except Exception:
            db.rollback()

            logger.exception(
                "M-Pesa reconciliation cycle "
                "failed for a claimed attempt."
            )

        finally:
            db.close()

    return processed


async def mpesa_reconciliation_loop() -> None:
    poll_seconds = max(
        1,
        settings.MPESA_RECONCILIATION_POLL_SECONDS,
    )

    while True:
        try:
            await asyncio.to_thread(
                run_mpesa_reconciliation_cycle
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "M-Pesa reconciliation worker "
                "cycle failed."
            )

        await asyncio.sleep(poll_seconds)
