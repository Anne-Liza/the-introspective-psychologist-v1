from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.core.database import Base

from app.modules.app_settings.models import AppSetting  # noqa: F401
from app.modules.appointments.models import Appointment  # noqa: F401
from app.modules.auth.models import RefreshToken, EmailVerificationToken, PasswordResetToken  # noqa: F401
from app.modules.availability.models import AvailabilityRule, AvailabilityException  # noqa: F401
from app.modules.blog.models import BlogPost  # noqa: F401
from app.modules.booking_engine.models import BookingHold, BookingScheduleLock, BookingSetting  # noqa: F401
from app.modules.client_records.models import ClientRecord, ClientRecordLink  # noqa: F401
from app.modules.commerce_core.models import CommerceItem, CommerceOrder, CommerceOrderItem  # noqa: F401
from app.modules.contact_messages.models import ContactMessage  # noqa: F401
from app.modules.email.models import EmailLog  # noqa: F401
from app.modules.email_templates.models import EmailTemplate  # noqa: F401
from app.modules.files.models import FileAsset  # noqa: F401
from app.modules.fulfillment.models import FulfillmentRecord, FulfillmentEvent  # noqa: F401
from app.modules.invitations.models import Invitation  # noqa: F401
from app.modules.landing_sections.models import LandingSection  # noqa: F401
from app.modules.payment_attempts.models import PaymentAttempt, PaymentProviderEvent  # noqa: F401
from app.modules.payment_requests.models import PaymentRequest, PaymentRequestEvent  # noqa: F401
from app.modules.receipts.models import ReceiptRecord, ReceiptEvent  # noqa: F401
from app.modules.roles.models import Permission, Role  # noqa: F401
from app.modules.services.models import Service  # noqa: F401
from app.modules.therapist_profiles.models import TherapistProfile, TherapistProfileRevision  # noqa: F401
from app.modules.users.models import User  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
