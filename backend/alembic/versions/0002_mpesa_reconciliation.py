"""add durable M-Pesa reconciliation state

Revision ID: 0002_mpesa_reconciliation
Revises: 0001_initial_schema
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_mpesa_reconciliation"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payment_attempts",
        sa.Column(
            "reconciliation_status",
            sa.String(length=40),
            nullable=False,
            server_default="idle",
        ),
    )
    op.add_column(
        "payment_attempts",
        sa.Column(
            "reconciliation_retry_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "payment_attempts",
        sa.Column(
            "reconciliation_last_attempt_at",
            sa.DateTime(),
            nullable=True,
        ),
    )
    op.add_column(
        "payment_attempts",
        sa.Column(
            "reconciliation_next_attempt_at",
            sa.DateTime(),
            nullable=True,
        ),
    )
    op.add_column(
        "payment_attempts",
        sa.Column(
            "reconciliation_completed_at",
            sa.DateTime(),
            nullable=True,
        ),
    )
    op.add_column(
        "payment_attempts",
        sa.Column(
            "reconciliation_last_error_code",
            sa.String(length=120),
            nullable=True,
        ),
    )
    op.add_column(
        "payment_attempts",
        sa.Column(
            "reconciliation_last_error_message",
            sa.Text(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_payment_attempts_reconciliation_due",
        "payment_attempts",
        [
            "reconciliation_status",
            "reconciliation_next_attempt_at",
        ],
        unique=False,
    )



def downgrade() -> None:
    op.drop_index(
        "ix_payment_attempts_reconciliation_due",
        table_name="payment_attempts",
    )

    op.drop_column(
        "payment_attempts",
        "reconciliation_last_error_message",
    )
    op.drop_column(
        "payment_attempts",
        "reconciliation_last_error_code",
    )
    op.drop_column(
        "payment_attempts",
        "reconciliation_completed_at",
    )
    op.drop_column(
        "payment_attempts",
        "reconciliation_next_attempt_at",
    )
    op.drop_column(
        "payment_attempts",
        "reconciliation_last_attempt_at",
    )
    op.drop_column(
        "payment_attempts",
        "reconciliation_retry_count",
    )
    op.drop_column(
        "payment_attempts",
        "reconciliation_status",
    )
