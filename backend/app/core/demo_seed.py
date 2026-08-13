from __future__ import annotations

import json
import struct
import zlib
from datetime import date, time, timedelta
from decimal import Decimal
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.core.storage.local import LocalStorageProvider
from app.core.time import utc_now
from app.modules.app_settings.models import AppSetting
from app.modules.appointments.models import Appointment
from app.modules.availability.models import AvailabilityException, AvailabilityRule
from app.modules.blog.models import BlogPost
from app.modules.booking_engine.models import BookingHold
from app.modules.client_records.models import ClientRecord, ClientRecordLink
from app.modules.commerce_core.models import CommerceItem, CommerceOrder, CommerceOrderItem
from app.modules.contact_messages.models import ContactMessage
from app.modules.email.models import EmailLog
from app.modules.files.models import FileAsset
from app.modules.fulfillment.models import FulfillmentEvent, FulfillmentRecord
from app.modules.invitations.models import Invitation
from app.modules.landing_sections.models import LandingSection
from app.modules.payment_attempts.models import PaymentAttempt, PaymentProviderEvent
from app.modules.payment_requests.models import PaymentRequest, PaymentRequestEvent
from app.modules.receipts.models import ReceiptEvent, ReceiptRecord
from app.modules.services.models import Service
from app.modules.therapist_profiles.models import (
    TherapistProfile,
    TherapistProfileRevision,
)
from app.modules.therapist_profiles.service import (
    REVISION_CONTENT_FIELDS,
    build_revision_from_profile,
)
from app.modules.users.models import User


DEMO_EMAIL_DOMAIN = "demo.example"
DEMO_SOURCE = "presentation_seed"


def _update(instance, values: dict) -> None:
    for key, value in values.items():
        setattr(instance, key, value)


def _next_weekday(day_of_week: int, *, weeks_ahead: int = 1) -> date:
    today = date.today()
    days_ahead = (day_of_week - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead + ((weeks_ahead - 1) * 7))


def _seed_settings(db: Session) -> None:
    values = {
        "practice.email": ("hello@therapy.demo.example", "Public practice email."),
        "practice.phone": ("+254 700 000 000", "Public practice phone and WhatsApp number."),
        "practice.location": ("Westlands, Nairobi", "Primary in-person practice location."),
        "practice.hours": ("Monday to Friday, 8:00–18:00 EAT", "Administrative office hours."),
        "practice.session_formats": ("Online and in-person", "Public session formats."),
        "practice.demo_notice": (
            "This local review contains synthetic presentation data.",
            "Identifies the opt-in presentation dataset.",
        ),
    }
    for key, (value, description) in values.items():
        setting = db.scalar(select(AppSetting).where(AppSetting.key == key))
        payload = {
            "value": value,
            "value_type": "string",
            "group": "practice",
            "description": description,
        }
        if setting is None:
            db.add(AppSetting(key=key, **payload))
        else:
            _update(setting, payload)


def _seed_landing_sections(db: Session) -> None:
    sections = [
        {
            "key": "about.hero",
            "eyebrow": "Our practice",
            "title": "Thoughtful therapy, held by a collaborative team.",
            "body": f"{settings.APP_NAME} is a multi-therapist practice offering grounded, culturally responsive support for individuals, couples, and people navigating change.",
            "cta_label": None,
            "cta_url": None,
            "image_url": "/demo/practice/practice-room.svg",
            "sort_order": 1,
            "is_visible": True,
        },
        {
            "key": "about.profile",
            "eyebrow": "How we work",
            "title": "Care begins with fit, clarity, and emotional safety.",
            "body": "Our therapists bring different specialties and approaches while sharing a commitment to respectful, collaborative care. You can explore the team and ask questions before choosing your next step.",
            "cta_label": "Meet the therapists",
            "cta_url": "/therapists",
            "image_url": None,
            "sort_order": 2,
            "is_visible": True,
        },
        {
            "key": "about.cta",
            "eyebrow": "A gentle next step",
            "title": "Not sure which therapist or service fits?",
            "body": "Send the practice an administrative message. We can explain formats, fees, availability, and the booking process without asking you to share sensitive clinical information online.",
            "cta_label": "Contact the practice",
            "cta_url": "/contact",
            "image_url": None,
            "sort_order": 3,
            "is_visible": True,
        },
        {
            "key": "contact.email",
            "eyebrow": "Email",
            "title": "hello@therapy.demo.example",
            "body": "For appointments, services, workshops, and general administrative questions.",
            "cta_label": None,
            "cta_url": None,
            "image_url": None,
            "sort_order": 1,
            "is_visible": True,
        },
        {
            "key": "contact.phone",
            "eyebrow": "Phone & WhatsApp",
            "title": "+254 700 000 000",
            "body": "Administrative messages are answered during office hours.",
            "cta_label": None,
            "cta_url": None,
            "image_url": None,
            "sort_order": 2,
            "is_visible": True,
        },
        {
            "key": "contact.location",
            "eyebrow": "Location",
            "title": "Westlands, Nairobi",
            "body": "Online sessions are also available across Kenya where appropriate.",
            "cta_label": None,
            "cta_url": None,
            "image_url": None,
            "sort_order": 3,
            "is_visible": True,
        },
        {
            "key": "contact.hours",
            "eyebrow": "Office hours",
            "title": "Monday–Friday, 8:00–18:00 EAT",
            "body": "Messages outside these hours are reviewed on the next working day.",
            "cta_label": None,
            "cta_url": None,
            "image_url": None,
            "sort_order": 4,
            "is_visible": True,
        },
        {
            "key": "contact.emergency",
            "eyebrow": "Urgent support",
            "title": "This website is not an emergency or crisis service.",
            "body": "If you or someone else is in immediate danger, contact local emergency services or go to the nearest emergency department.",
            "cta_label": None,
            "cta_url": None,
            "image_url": None,
            "sort_order": 5,
            "is_visible": True,
        },
    ]
    for values in sections:
        section = db.scalar(select(LandingSection).where(LandingSection.key == values["key"]))
        if section is None:
            db.add(LandingSection(**values))
        else:
            _update(section, {key: value for key, value in values.items() if key != "key"})


def _seed_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    role,
    password: str,
) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()
    else:
        user.full_name = full_name
        user.password_hash = hash_password(password)
        user.is_active = True
        user.is_verified = True
    if role not in user.roles:
        user.roles.append(role)
    return user


def _seed_invitation(
    db: Session,
    *,
    email: str,
    role_name: str,
    status: str,
    invited_by_user_id: str,
    accepted_by_user_id: str | None = None,
    revoked_by_user_id: str | None = None,
) -> Invitation:
    invitation = db.scalar(
        select(Invitation).where(
            Invitation.email == email,
            Invitation.role_name == role_name,
        )
    )
    now = utc_now()
    pending = status == "pending"
    accepted = status == "accepted"
    revoked = status == "revoked"
    payload = {
        "pending_email_key": email if pending else None,
        "token_hash": sha256(f"demo:{email}".encode()).hexdigest() if pending else None,
        "status": status,
        "delivery_status": "sent",
        "invited_by_user_id": invited_by_user_id,
        "accepted_by_user_id": accepted_by_user_id if accepted else None,
        "revoked_by_user_id": revoked_by_user_id if revoked else None,
        "expires_at": now + timedelta(days=3) if pending else now - timedelta(days=4),
        "accepted_at": now - timedelta(days=12) if accepted else None,
        "revoked_at": now - timedelta(days=2) if revoked else None,
        "expired_at": None,
        "last_sent_at": now - timedelta(days=1),
        "send_count": 1,
    }
    if invitation is None:
        invitation = Invitation(email=email, role_name=role_name, **payload)
        db.add(invitation)
    else:
        _update(invitation, payload)
    return invitation


def _seed_staff(db: Session, *, role_map: dict, developer: User) -> dict[str, User]:
    demo_password = settings.DEMO_STAFF_PASSWORD.strip()
    if not demo_password:
        raise RuntimeError(
            "DEMO_STAFF_PASSWORD is required when therapy demo data is enabled."
        )
    practice_admin = _seed_user(
        db,
        email=f"practice.admin@{DEMO_EMAIL_DOMAIN}",
        full_name="Amina Otieno",
        role=role_map["Practice Admin"],
        password=demo_password,
    )
    therapist_users = [
        _seed_user(
            db,
            email=f"amani.wekesa@{DEMO_EMAIL_DOMAIN}",
            full_name="Amani Wekesa",
            role=role_map["Therapist"],
            password=demo_password,
        ),
        _seed_user(
            db,
            email=f"leila.hassan@{DEMO_EMAIL_DOMAIN}",
            full_name="Leila Hassan",
            role=role_map["Therapist"],
            password=demo_password,
        ),
        _seed_user(
            db,
            email=f"njeri.kamau@{DEMO_EMAIL_DOMAIN}",
            full_name="Njeri Kamau",
            role=role_map["Therapist"],
            password=demo_password,
        ),
    ]
    db.flush()
    _seed_invitation(
        db,
        email=practice_admin.email,
        role_name="Practice Admin",
        status="accepted",
        invited_by_user_id=developer.id,
        accepted_by_user_id=practice_admin.id,
    )
    for user in therapist_users:
        _seed_invitation(
            db,
            email=user.email,
            role_name="Therapist",
            status="accepted",
            invited_by_user_id=practice_admin.id,
            accepted_by_user_id=user.id,
        )
    _seed_invitation(
        db,
        email=f"pending.therapist@{DEMO_EMAIL_DOMAIN}",
        role_name="Therapist",
        status="pending",
        invited_by_user_id=practice_admin.id,
    )
    _seed_invitation(
        db,
        email=f"revoked.therapist@{DEMO_EMAIL_DOMAIN}",
        role_name="Therapist",
        status="revoked",
        invited_by_user_id=practice_admin.id,
        revoked_by_user_id=practice_admin.id,
    )
    return {
        "practice_admin": practice_admin,
        "amani": therapist_users[0],
        "leila": therapist_users[1],
        "njeri": therapist_users[2],
    }


def _seed_therapist_profiles(db: Session) -> dict[str, TherapistProfile]:
    profiles = [
        {
            "key": "amani",
            "full_name": "Amani Wekesa",
            "slug": "amani-wekesa",
            "title": "Counselling Psychologist",
            "short_bio": "Warm, collaborative support for anxiety, identity, and life transitions.",
            "bio": "Amani works with adults navigating anxiety, changing relationships, identity questions, and new chapters. Sessions balance careful reflection with practical ways of understanding patterns and building steadier choices.",
            "specialties": "Anxiety, life transitions, identity, relationships",
            "approaches": "Person-centred, attachment-informed, reflective practice",
            "languages": "English, Kiswahili",
            "location": "Westlands, Nairobi",
            "session_formats": "Online, In-person",
            "profile_image_url": "/demo/therapists/amani-wekesa.svg",
            "booking_cta_label": "Book with Amani",
            "booking_cta_url": "/book?therapist=amani-wekesa",
            "sort_order": 1,
            "is_published": True,
        },
        {
            "key": "leila",
            "full_name": "Leila Hassan",
            "slug": "leila-hassan",
            "title": "Counselling Psychologist",
            "short_bio": "Grounded support for stress, burnout, grief, and workplace wellbeing.",
            "bio": "Leila supports adults carrying prolonged stress, burnout, grief, and competing responsibilities. Her work creates room to slow down, clarify needs, and develop boundaries that can be sustained outside the therapy room.",
            "specialties": "Burnout, grief, workplace stress, boundaries",
            "approaches": "Integrative, strengths-based, trauma-aware",
            "languages": "English, Kiswahili",
            "location": "Online across Kenya",
            "session_formats": "Online",
            "profile_image_url": "/demo/therapists/leila-hassan.svg",
            "booking_cta_label": "Book with Leila",
            "booking_cta_url": "/book?therapist=leila-hassan",
            "sort_order": 2,
            "is_published": True,
        },
        {
            "key": "njeri",
            "full_name": "Njeri Kamau",
            "slug": "njeri-kamau",
            "title": "Marriage and Family Therapist",
            "short_bio": "Support for couples, communication, family patterns, and reconnection.",
            "bio": "Njeri works with couples and adults who want to understand recurring relationship patterns, communicate more clearly, and make deliberate decisions about connection, boundaries, and repair.",
            "specialties": "Couples, communication, family relationships, conflict",
            "approaches": "Systemic, emotion-focused, collaborative",
            "languages": "English, Kiswahili, Kikuyu",
            "location": "Westlands, Nairobi",
            "session_formats": "Online, In-person",
            "profile_image_url": "/demo/therapists/njeri-kamau.svg",
            "booking_cta_label": "Book with Njeri",
            "booking_cta_url": "/book?therapist=njeri-kamau",
            "sort_order": 3,
            "is_published": True,
        },
    ]
    result = {}
    for values in profiles:
        key = values.pop("key")
        profile = db.scalar(select(TherapistProfile).where(TherapistProfile.slug == values["slug"]))
        if profile is None:
            profile = TherapistProfile(**values)
            db.add(profile)
        else:
            _update(profile, {field: value for field, value in values.items() if field != "slug"})
        db.flush()
        result[key] = profile
    return result


def _seed_therapist_profile_publications(
    db: Session,
    *,
    profiles: dict[str, TherapistProfile],
    staff: dict[str, User],
) -> None:
    now = utc_now()

    for key in ("amani", "leila", "njeri"):
        profile = profiles[key]
        therapist = staff[key]

        current = db.scalar(
            select(TherapistProfileRevision).where(
                TherapistProfileRevision.therapist_profile_id == profile.id,
                TherapistProfileRevision.is_current_publication.is_(True),
            )
        )

        if current is None:
            latest = db.scalar(
                select(TherapistProfileRevision)
                .where(
                    TherapistProfileRevision.therapist_profile_id == profile.id
                )
                .order_by(
                    TherapistProfileRevision.version_number.desc()
                )
            )

            current = build_revision_from_profile(
                profile,
                version_number=(
                    latest.version_number + 1
                    if latest is not None
                    else 1
                ),
                created_by_user_id=therapist.id,
            )
            db.add(current)
        else:
            for field in REVISION_CONTENT_FIELDS:
                setattr(current, field, getattr(profile, field))

        current.review_status = "approved"
        current.submitted_at = now - timedelta(days=14)
        current.reviewed_by_user_id = staff["practice_admin"].id
        current.reviewed_at = now - timedelta(days=13)
        current.review_notes = None
        current.is_current_publication = True
        current.published_by_user_id = staff["practice_admin"].id
        current.published_at = now - timedelta(days=12)

        profile.review_status = "approved"
        profile.reviewed_by_user_id = staff["practice_admin"].id
        profile.reviewed_at = current.reviewed_at
        profile.review_notes = None
        profile.is_published = True




def _seed_services(db: Session) -> dict[str, Service]:
    services = [
        {
            "key": "individual",
            "name": "Individual Therapy",
            "slug": "individual-therapy",
            "summary": "One-to-one support for emotional clarity, self-understanding, relationships, and sustainable change.",
            "description": "A 50-minute individual session shaped around your goals, questions, and preferred pace. Available online or in person after an initial fit and availability check.",
            "category": "Individual support",
            "service_format": "Online or in-person",
            "duration_minutes": 50,
            "price_amount": Decimal("4500.00"),
            "currency": "KES",
            "payment_policy_override": "full_upfront",
            "cta_label": "Request individual therapy",
            "cta_url": "/book?service=individual-therapy",
            "sort_order": 1,
            "is_featured": True,
            "is_published": True,
        },
        {
            "key": "burnout",
            "name": "Stress and Burnout Support",
            "slug": "stress-and-burnout-support",
            "summary": "Focused support for overwhelm, workplace stress, boundaries, and steadier routines.",
            "description": "A structured 60-minute session for exploring sustained stress and identifying realistic changes in boundaries, rest, communication, and workload.",
            "category": "Focused support",
            "service_format": "Online",
            "duration_minutes": 60,
            "price_amount": Decimal("5000.00"),
            "currency": "KES",
            "cta_label": "Request burnout support",
            "cta_url": "/book?service=stress-and-burnout-support",
            "sort_order": 2,
            "is_featured": True,
            "is_published": True,
        },
        {
            "key": "couples",
            "name": "Couples Therapy",
            "slug": "couples-therapy",
            "summary": "A collaborative space for communication, conflict patterns, repair, and relationship decisions.",
            "description": "A 75-minute couples session. Both partners receive practical information about the process before the first confirmed appointment.",
            "category": "Relationship support",
            "service_format": "Online or in-person",
            "duration_minutes": 75,
            "price_amount": Decimal("6500.00"),
            "currency": "KES",
            "cta_label": "Request couples therapy",
            "cta_url": "/book?service=couples-therapy",
            "sort_order": 3,
            "is_featured": False,
            "is_published": True,
        },
        {
            "key": "consultation",
            "name": "Initial Consultation",
            "slug": "initial-consultation",
            "summary": "A free, shorter conversation to ask practical questions and explore service and therapist fit.",
            "description": "A free 30-minute online consultation for general orientation. It is not an assessment, diagnosis, emergency response, or confirmed course of therapy.",
            "category": "Getting started",
            "service_format": "Online",
            "duration_minutes": 30,
            "price_amount": Decimal("0.00"),
            "currency": "KES",
            "payment_policy_override": "none",
            "cta_label": "Request a consultation",
            "cta_url": "/book?service=initial-consultation",
            "sort_order": 4,
            "is_featured": False,
            "is_published": True,
        },
    ]
    result = {}
    for values in services:
        key = values.pop("key")
        service = db.scalar(select(Service).where(Service.slug == values["slug"]))
        if service is None:
            service = Service(**values)
            db.add(service)
        else:
            _update(service, {field: value for field, value in values.items() if field != "slug"})
        db.flush()
        result[key] = service
    return result


def _seed_availability(
    db: Session,
    *,
    profiles: dict[str, TherapistProfile],
    services: dict[str, Service],
) -> None:
    rules = [
        ("Amani · Monday in-person", 0, time(9), time(14), profiles["amani"], services["individual"], "In-person", "Westlands, Nairobi"),
        ("Amani · Wednesday online", 2, time(10), time(17), profiles["amani"], services["individual"], "Online", "Secure video session"),
        ("Leila · Tuesday online", 1, time(9), time(16), profiles["leila"], services["burnout"], "Online", "Secure video session"),
        ("Leila · Thursday online", 3, time(12), time(18), profiles["leila"], services["consultation"], "Online", "Secure video session"),
        ("Njeri · Friday couples", 4, time(9), time(17), profiles["njeri"], services["couples"], "In-person", "Westlands, Nairobi"),
        ("Njeri · Saturday online", 5, time(9), time(13), profiles["njeri"], services["couples"], "Online", "Secure video session"),
    ]
    for index, (title, weekday, start, end, therapist, service, session_format, location) in enumerate(rules, 1):
        rule = db.scalar(select(AvailabilityRule).where(AvailabilityRule.title == title))
        values = {
            "day_of_week": weekday,
            "start_time": start,
            "end_time": end,
            "timezone": "Africa/Nairobi",
            "slot_duration_minutes": service.duration_minutes or 60,
            "buffer_minutes": 10,
            "capacity": 1,
            "service_id": service.id,
            "therapist_profile_id": therapist.id,
            "session_format": session_format,
            "location": location,
            "is_active": True,
            "is_public": True,
            "sort_order": index,
        }
        if rule is None:
            db.add(AvailabilityRule(title=title, **values))
        else:
            _update(rule, values)

    exception = db.scalar(
        select(AvailabilityException).where(AvailabilityException.reason == "Presentation example: team development afternoon")
    )
    values = {
        "date": _next_weekday(3, weeks_ahead=2),
        "start_time": time(13),
        "end_time": time(18),
        "exception_type": "blocked",
        "reason": "Presentation example: team development afternoon",
        "service_id": None,
        "therapist_profile_id": profiles["leila"].id,
        "is_active": True,
        "is_public": True,
    }
    if exception is None:
        db.add(AvailabilityException(**values))
    else:
        _update(exception, values)


def _seed_appointment(
    db: Session,
    *,
    client_email: str,
    values: dict,
) -> Appointment:
    appointment = db.scalar(
        select(Appointment).where(
            Appointment.source == DEMO_SOURCE,
            Appointment.client_email == client_email,
        )
    )
    payload = {**values, "client_email": client_email, "source": DEMO_SOURCE}
    if appointment is None:
        appointment = Appointment(**payload)
        db.add(appointment)
    else:
        _update(appointment, payload)
    db.flush()
    return appointment


def _seed_appointments(
    db: Session,
    *,
    profiles: dict[str, TherapistProfile],
    services: dict[str, Service],
) -> dict[str, Appointment]:
    appointments = {
        "requested": _seed_appointment(
            db,
            client_email=f"maria.request@{DEMO_EMAIL_DOMAIN}",
            values={
                "appointment_date": _next_weekday(2),
                "start_time": time(10),
                "end_time": time(10, 50),
                "client_name": "Maria Demo",
                "client_phone": "+254 700 000 101",
                "service_id": services["individual"].id,
                "therapist_profile_id": profiles["amani"].id,
                "status": "requested",
                "session_format": "Online",
                "location": "Secure video session",
                "client_message": "I would like to understand the first-session process and available online times.",
                "admin_notes": "Presentation data: awaiting administrative review.",
                "sort_order": 1,
            },
        ),
        "confirmed": _seed_appointment(
            db,
            client_email=f"james.confirmed@{DEMO_EMAIL_DOMAIN}",
            values={
                "appointment_date": _next_weekday(4),
                "start_time": time(11),
                "end_time": time(12, 15),
                "client_name": "James Demo",
                "client_phone": "+254 700 000 102",
                "service_id": services["couples"].id,
                "therapist_profile_id": profiles["njeri"].id,
                "status": "confirmed",
                "session_format": "In-person",
                "location": "Westlands, Nairobi",
                "client_message": "Please confirm parking and arrival instructions.",
                "admin_notes": "Presentation data: confirmation email sent.",
                "sort_order": 2,
            },
        ),
        "completed": _seed_appointment(
            db,
            client_email=f"faith.completed@{DEMO_EMAIL_DOMAIN}",
            values={
                "appointment_date": date.today() - timedelta(days=5),
                "start_time": time(14),
                "end_time": time(15),
                "client_name": "Faith Demo",
                "client_phone": "+254 700 000 103",
                "service_id": services["burnout"].id,
                "therapist_profile_id": profiles["leila"].id,
                "status": "completed",
                "session_format": "Online",
                "location": "Secure video session",
                "client_message": None,
                "admin_notes": "Presentation data: attendance recorded; no clinical notes stored here.",
                "sort_order": 3,
            },
        ),
        "cancelled": _seed_appointment(
            db,
            client_email=f"peter.cancelled@{DEMO_EMAIL_DOMAIN}",
            values={
                "appointment_date": _next_weekday(1, weeks_ahead=2),
                "start_time": time(9),
                "end_time": time(9, 30),
                "client_name": "Peter Demo",
                "client_phone": None,
                "service_id": services["consultation"].id,
                "therapist_profile_id": profiles["leila"].id,
                "status": "cancelled",
                "session_format": "Online",
                "location": "Secure video session",
                "client_message": "I need to choose another week.",
                "admin_notes": "Presentation data: client requested cancellation.",
                "sort_order": 4,
            },
        ),
    }

    hold = db.scalar(
        select(BookingHold).where(BookingHold.client_email == f"hold.client@{DEMO_EMAIL_DOMAIN}")
    )
    hold_values = {
        "hold_date": _next_weekday(0, weeks_ahead=2),
        "start_time": time(11),
        "end_time": time(11, 50),
        "service_id": services["individual"].id,
        "therapist_profile_id": profiles["amani"].id,
        "session_format": "In-person",
        "location": "Westlands, Nairobi",
        "client_name": "Booking Hold Demo",
        "client_email": f"hold.client@{DEMO_EMAIL_DOMAIN}",
        "client_phone": "+254 700 000 104",
        "status": "active",
        "expires_at": utc_now() + timedelta(hours=2),
        "appointment_id": None,
        "sort_order": 1,
    }
    if hold is None:
        db.add(BookingHold(**hold_values))
    else:
        _update(hold, hold_values)
    return appointments


def _seed_contact_messages(db: Session) -> None:
    messages = [
        {
            "name": "Naomi Demo",
            "email": f"naomi.inquiry@{DEMO_EMAIL_DOMAIN}",
            "subject": "Choosing between online and in-person sessions",
            "message": "Could you share the practical differences between your online and Westlands appointment options?",
            "source": DEMO_SOURCE,
            "is_read": False,
        },
        {
            "name": "Daniel Demo",
            "email": f"daniel.workshop@{DEMO_EMAIL_DOMAIN}",
            "subject": "Reflective Practice Workshop",
            "message": "Please let me know when the next workshop date is confirmed.",
            "source": DEMO_SOURCE,
            "is_read": True,
        },
    ]
    for values in messages:
        message = db.scalar(
            select(ContactMessage).where(
                ContactMessage.source == DEMO_SOURCE,
                ContactMessage.email == values["email"],
            )
        )
        if message is None:
            db.add(ContactMessage(**values))
        else:
            _update(message, values)


def _seed_email_logs(db: Session) -> None:
    logs = [
        {
            "to_email": f"james.confirmed@{DEMO_EMAIL_DOMAIN}",
            "subject": "[Presentation] Your appointment is confirmed",
            "body": "Synthetic appointment confirmation. No external email was sent.",
            "provider": "presentation",
            "status": "sent",
            "error_message": None,
            "sent_at": utc_now() - timedelta(days=2),
        },
        {
            "to_email": f"mercy.pending@{DEMO_EMAIL_DOMAIN}",
            "subject": "[Presentation] Complete your payment",
            "body": "Synthetic payment reminder. No external email was sent.",
            "provider": "presentation",
            "status": "queued",
            "error_message": None,
            "sent_at": None,
        },
        {
            "to_email": f"invalid.address@{DEMO_EMAIL_DOMAIN}",
            "subject": "[Presentation] Workshop information",
            "body": "Synthetic failed delivery example. No external email was sent.",
            "provider": "presentation",
            "status": "failed",
            "error_message": "Synthetic presentation failure: recipient unavailable.",
            "sent_at": None,
        },
    ]
    for values in logs:
        log = db.scalar(
            select(EmailLog).where(
                EmailLog.to_email == values["to_email"],
                EmailLog.subject == values["subject"],
            )
        )
        if log is None:
            db.add(EmailLog(**values))
        else:
            _update(log, values)


def _seed_order(
    db: Session,
    *,
    order_number: str,
    customer_name: str,
    customer_email: str,
    status: str,
    fulfillment_status: str,
    item: CommerceItem,
    quantity: int,
) -> CommerceOrder:
    total = Decimal(item.price_amount) * quantity
    order = db.scalar(select(CommerceOrder).where(CommerceOrder.order_number == order_number))
    values = {
        "customer_name": customer_name,
        "customer_email": customer_email,
        "customer_phone": "+254 700 000 200",
        "status": status,
        "fulfillment_status": fulfillment_status,
        "subtotal_amount": total,
        "discount_amount": Decimal("0.00"),
        "tax_amount": Decimal("0.00"),
        "total_amount": total,
        "currency": item.currency,
        "source": DEMO_SOURCE,
        "notes": "Synthetic presentation order.",
    }
    if order is None:
        order = CommerceOrder(order_number=order_number, **values)
        db.add(order)
        db.flush()
    else:
        _update(order, values)

    line = db.scalar(
        select(CommerceOrderItem).where(
            CommerceOrderItem.order_id == order.id,
            CommerceOrderItem.sort_order == 1,
        )
    )
    line_values = {
        "commerce_item_id": item.id,
        "item_name": item.name,
        "item_type": item.item_type,
        "quantity": quantity,
        "unit_amount": item.price_amount,
        "line_total_amount": total,
        "currency": item.currency,
        "linked_service_id": item.linked_service_id,
        "session_credit_count": item.session_credit_count,
        "sort_order": 1,
    }
    if line is None:
        db.add(CommerceOrderItem(order_id=order.id, **line_values))
    else:
        _update(line, line_values)
    db.flush()
    return order


def _seed_payment_request(
    db: Session,
    *,
    number: str,
    order: CommerceOrder,
    status: str,
    provider_reference: str | None,
) -> PaymentRequest:
    request = db.scalar(select(PaymentRequest).where(PaymentRequest.request_number == number))
    paid = status == "paid"
    values = {
        "commerce_order_id": order.id,
        "target_type": "commerce_order",
        "target_id": order.id,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "amount": order.total_amount,
        "currency": order.currency,
        "provider": "mpesa",
        "provider_reference": provider_reference,
        "settlement_account_label": "Demo till",
        "status": status,
        "description": f"Payment for {order.order_number}",
        "admin_notes": "Synthetic presentation payment request.",
        "expires_at": utc_now() + timedelta(days=2) if not paid else None,
        "paid_at": utc_now() - timedelta(days=1) if paid else None,
        "cancelled_at": None,
        "created_by_user_id": None,
    }
    if request is None:
        request = PaymentRequest(request_number=number, **values)
        db.add(request)
    else:
        _update(request, values)
    db.flush()
    event = db.scalar(
        select(PaymentRequestEvent).where(
            PaymentRequestEvent.payment_request_id == request.id,
            PaymentRequestEvent.event_type == "demo_seeded",
        )
    )
    if event is None:
        db.add(
            PaymentRequestEvent(
                payment_request_id=request.id,
                event_type="demo_seeded",
                from_status=None,
                to_status=status,
                provider="mpesa",
                provider_reference=provider_reference,
                amount=request.amount,
                currency=request.currency,
                notes="Synthetic presentation lifecycle event.",
            )
        )
    return request


def _seed_attempt(
    db: Session,
    *,
    number: str,
    request: PaymentRequest,
    status: str,
    verification_status: str,
    provider_reference: str,
) -> PaymentAttempt:
    attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.attempt_number == number))
    values = {
        "payment_request_id": request.id,
        "provider": "mpesa",
        "provider_reference": provider_reference,
        "provider_session_id": f"SESSION-{number}",
        "idempotency_key": f"demo:{number.lower()}",
        "amount": request.amount,
        "currency": request.currency,
        "status": status,
        "verification_status": verification_status,
        "checkout_url": None,
        "error_code": None,
        "error_message": None,
        "initiated_by_user_id": None,
        "verified_at": utc_now() - timedelta(days=1) if verification_status == "verified" else None,
    }
    if attempt is None:
        attempt = PaymentAttempt(attempt_number=number, **values)
        db.add(attempt)
    else:
        _update(attempt, values)
    db.flush()
    external_event_id = f"EVENT-{number}"
    provider_event = db.scalar(
        select(PaymentProviderEvent).where(
            PaymentProviderEvent.external_event_id == external_event_id
        )
    )
    payload = json.dumps(
        {
            "demo": True,
            "provider": "mpesa",
            "result": "success" if status == "succeeded" else "pending",
        },
        sort_keys=True,
    )
    fingerprint = sha256(external_event_id.encode()).hexdigest()
    event_values = {
        "payment_attempt_id": attempt.id,
        "payment_request_id": request.id,
        "provider": "mpesa",
        "provider_reference": provider_reference,
        "event_type": "stk_callback",
        "event_status": status if status in {"succeeded", "failed"} else "pending",
        "verification_status": verification_status,
        "amount": request.amount,
        "currency": request.currency,
        "event_fingerprint": fingerprint,
        "payload_hash": sha256(payload.encode()).hexdigest(),
        "payload_json": payload,
        "is_duplicate": False,
        "original_event_id": None,
        "notes": "Sanitized synthetic provider event; no live Daraja call occurred.",
        "processed_at": utc_now() - timedelta(days=1) if status == "succeeded" else None,
    }
    if provider_event is None:
        db.add(PaymentProviderEvent(external_event_id=external_event_id, **event_values))
    else:
        _update(provider_event, event_values)
    return attempt


def _seed_receipt_and_fulfillment(
    db: Session,
    *,
    receipt_number: str,
    fulfillment_number: str,
    request: PaymentRequest,
    order: CommerceOrder,
    fulfillment_type: str,
    fulfillment_status: str,
) -> ReceiptRecord:
    receipt = db.scalar(select(ReceiptRecord).where(ReceiptRecord.receipt_number == receipt_number))
    receipt_values = {
        "payment_request_id": request.id,
        "payment_reference": request.request_number,
        "target_type": request.target_type,
        "target_id": request.target_id,
        "commerce_order_id": order.id,
        "appointment_id": None,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "amount": request.amount,
        "currency": request.currency,
        "provider": request.provider,
        "provider_reference": request.provider_reference,
        "provider_transaction_reference": (
            request.provider_transaction_reference
        ),
        "status": "issued",
        "notes": "Synthetic presentation receipt.",
        "issued_at": request.paid_at or utc_now(),
        "voided_at": None,
        "created_by_user_id": None,
    }
    if receipt is None:
        receipt = ReceiptRecord(receipt_number=receipt_number, **receipt_values)
        db.add(receipt)
    else:
        _update(receipt, receipt_values)
    db.flush()
    receipt_event = db.scalar(
        select(ReceiptEvent).where(
            ReceiptEvent.receipt_id == receipt.id,
            ReceiptEvent.event_type == "issued",
        )
    )
    if receipt_event is None:
        db.add(
            ReceiptEvent(
                receipt_id=receipt.id,
                event_type="issued",
                from_status=None,
                to_status="issued",
                notes="Synthetic presentation receipt event.",
            )
        )

    fulfillment = db.scalar(
        select(FulfillmentRecord).where(FulfillmentRecord.fulfillment_number == fulfillment_number)
    )
    fulfilled = fulfillment_status == "fulfilled"
    fulfillment_values = {
        "receipt_id": receipt.id,
        "payment_request_id": request.id,
        "commerce_order_id": order.id,
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "fulfillment_type": fulfillment_type,
        "status": fulfillment_status,
        "notes": "Synthetic presentation fulfillment record.",
        "started_at": utc_now() - timedelta(days=1),
        "fulfilled_at": utc_now() - timedelta(hours=12) if fulfilled else None,
        "cancelled_at": None,
        "created_by_user_id": None,
    }
    if fulfillment is None:
        fulfillment = FulfillmentRecord(fulfillment_number=fulfillment_number, **fulfillment_values)
        db.add(fulfillment)
    else:
        _update(fulfillment, fulfillment_values)
    db.flush()
    event = db.scalar(
        select(FulfillmentEvent).where(
            FulfillmentEvent.fulfillment_id == fulfillment.id,
            FulfillmentEvent.event_type == "demo_seeded",
        )
    )
    if event is None:
        db.add(
            FulfillmentEvent(
                fulfillment_id=fulfillment.id,
                event_type="demo_seeded",
                from_status=None,
                to_status=fulfillment_status,
                notes="Synthetic presentation fulfillment event.",
            )
        )
    return receipt


def _seed_commerce_lifecycle(
    db: Session,
    *,
    services: dict[str, Service],
) -> dict[str, CommerceOrder]:
    required_slugs = {
        "guided-reflection-workbook",
        "grounding-prompt-card-set",
        "reflective-practice-workshop",
        "three-session-support-bundle",
        "practice-reflection-notebook",
        "grounded-keychain",
        "everyday-practice-tote",
        "practice-t-shirt",
        "practice-hoodie",
    }
    items = {
        item.slug: item
        for item in db.scalars(
            select(CommerceItem).where(
                CommerceItem.slug.in_(required_slugs)
            )
        ).all()
    }
    if set(items) != required_slugs:
        raise RuntimeError("Therapy presentation catalog must be seeded before lifecycle records.")

    item_updates = {
        "guided-reflection-workbook": ("/demo/store/reflection-workbook.svg", None),
        "grounding-prompt-card-set": ("/demo/store/grounding-cards.svg", None),
        "reflective-practice-workshop": ("/demo/store/reflective-workshop.svg", None),
        "three-session-support-bundle": ("/demo/store/session-bundle.svg", services["individual"].id),
        "practice-reflection-notebook": ("/demo/store/practice-notebook.svg", None),
        "grounded-keychain": ("/demo/store/grounded-keychain.svg", None),
        "everyday-practice-tote": ("/demo/store/practice-tote.svg", None),
        "practice-t-shirt": ("/demo/store/practice-t-shirt.svg", None),
        "practice-hoodie": ("/demo/store/practice-hoodie.svg", None),
    }
    for slug, (image_url, linked_service_id) in item_updates.items():
        items[slug].image_url = image_url
        items[slug].linked_service_id = linked_service_id

    pending_order = _seed_order(
        db,
        order_number="DEMO-ORDER-1001",
        customer_name="Mercy Demo",
        customer_email=f"mercy.pending@{DEMO_EMAIL_DOMAIN}",
        status="pending_payment",
        fulfillment_status="unfulfilled",
        item=items["guided-reflection-workbook"],
        quantity=1,
    )
    fulfilled_order = _seed_order(
        db,
        order_number="DEMO-ORDER-1002",
        customer_name="Faith Demo",
        customer_email=f"faith.completed@{DEMO_EMAIL_DOMAIN}",
        status="paid",
        fulfillment_status="fulfilled",
        item=items["reflective-practice-workshop"],
        quantity=1,
    )
    delivery_order = _seed_order(
        db,
        order_number="DEMO-ORDER-1003",
        customer_name="James Demo",
        customer_email=f"james.confirmed@{DEMO_EMAIL_DOMAIN}",
        status="paid",
        fulfillment_status="unfulfilled",
        item=items["grounding-prompt-card-set"],
        quantity=2,
    )

    pending_request = _seed_payment_request(
        db,
        number="DEMO-PAY-1001",
        order=pending_order,
        status="pending",
        provider_reference=None,
    )
    fulfilled_request = _seed_payment_request(
        db,
        number="DEMO-PAY-1002",
        order=fulfilled_order,
        status="paid",
        provider_reference="DEMO-MPESA-1002",
    )
    delivery_request = _seed_payment_request(
        db,
        number="DEMO-PAY-1003",
        order=delivery_order,
        status="paid",
        provider_reference="DEMO-MPESA-1003",
    )

    _seed_attempt(
        db,
        number="DEMO-ATTEMPT-1001",
        request=pending_request,
        status="processing",
        verification_status="unverified",
        provider_reference="DEMO-PENDING-1001",
    )
    _seed_attempt(
        db,
        number="DEMO-ATTEMPT-1002",
        request=fulfilled_request,
        status="succeeded",
        verification_status="verified",
        provider_reference="DEMO-MPESA-1002",
    )
    _seed_attempt(
        db,
        number="DEMO-ATTEMPT-1003",
        request=delivery_request,
        status="succeeded",
        verification_status="verified",
        provider_reference="DEMO-MPESA-1003",
    )

    _seed_receipt_and_fulfillment(
        db,
        receipt_number="DEMO-RECEIPT-1002",
        fulfillment_number="DEMO-FULFILLMENT-1002",
        request=fulfilled_request,
        order=fulfilled_order,
        fulfillment_type="service",
        fulfillment_status="fulfilled",
    )
    _seed_receipt_and_fulfillment(
        db,
        receipt_number="DEMO-RECEIPT-1003",
        fulfillment_number="DEMO-FULFILLMENT-1003",
        request=delivery_request,
        order=delivery_order,
        fulfillment_type="physical",
        fulfillment_status="pending",
    )
    return {
        "pending": pending_order,
        "fulfilled": fulfilled_order,
        "delivery": delivery_order,
    }


def _seed_client_records(
    db: Session,
    *,
    appointments: dict[str, Appointment],
    orders: dict[str, CommerceOrder],
) -> None:
    records = [
        (
            "DEMO-CLIENT-001",
            "Maria Demo",
            f"maria.request@{DEMO_EMAIL_DOMAIN}",
            "+254 700 000 101",
            "lead",
            appointments["requested"],
            None,
        ),
        (
            "DEMO-CLIENT-002",
            "James Demo",
            f"james.confirmed@{DEMO_EMAIL_DOMAIN}",
            "+254 700 000 102",
            "active",
            appointments["confirmed"],
            orders["delivery"],
        ),
        (
            "DEMO-CLIENT-003",
            "Faith Demo",
            f"faith.completed@{DEMO_EMAIL_DOMAIN}",
            "+254 700 000 103",
            "active",
            appointments["completed"],
            orders["fulfilled"],
        ),
    ]
    for number, full_name, email, phone, status, appointment, order in records:
        record = db.scalar(select(ClientRecord).where(ClientRecord.email == email))
        values = {
            "client_number": number,
            "full_name": full_name,
            "phone": phone,
            "status": status,
            "source": DEMO_SOURCE,
            "preferred_contact_method": "email",
            "admin_notes": "Synthetic non-clinical presentation record.",
            "created_by_user_id": None,
        }
        if record is None:
            record = ClientRecord(email=email, **values)
            db.add(record)
        else:
            _update(record, values)
        db.flush()
        links = [
            ("appointment", appointment.id, "Seeded appointment", "Administrative scheduling link."),
        ]
        if order is not None:
            links.append(("commerce_order", order.id, "Seeded order", "Administrative purchase link."))
        for link_type, linked_record_id, label, notes in links:
            link = db.scalar(
                select(ClientRecordLink).where(
                    ClientRecordLink.client_record_id == record.id,
                    ClientRecordLink.link_type == link_type,
                    ClientRecordLink.linked_record_id == linked_record_id,
                )
            )
            if link is None:
                db.add(
                    ClientRecordLink(
                        client_record_id=record.id,
                        link_type=link_type,
                        linked_record_id=linked_record_id,
                        label=label,
                        notes=notes,
                    )
                )


def _png_bytes(primary: tuple[int, int, int], accent: tuple[int, int, int]) -> bytes:
    width, height = 640, 420
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            blend = (x + y) / (width + height)
            color = tuple(int(primary[i] * (1 - blend) + 246 * blend) for i in range(3))
            if ((x - 160) ** 2 + (y - 120) ** 2) < 95**2 or ((x - 500) ** 2 + (y - 330) ** 2) < 125**2:
                color = tuple(int(accent[i] * 0.72 + color[i] * 0.28) for i in range(3))
            row.extend(color)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(name: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def _seed_media_library(db: Session, *, developer: User) -> None:
    if settings.STORAGE_PROVIDER != "local":
        return
    assets = [
        ("practice-welcome-guide.png", (206, 218, 186), (84, 107, 47)),
        ("reflection-resource-preview.png", (239, 231, 215), (91, 119, 95)),
    ]
    storage = LocalStorageProvider()
    for filename, primary, accent in assets:
        existing = db.scalar(select(FileAsset).where(FileAsset.original_filename == filename))
        if existing is not None:
            continue
        content = _png_bytes(primary, accent)
        stored = storage.save(
            original_filename=filename,
            content=content,
            content_type="image/png",
        )
        db.add(
            FileAsset(
                original_filename=stored.original_filename,
                stored_filename=stored.stored_filename,
                content_type=stored.content_type,
                size_bytes=stored.size_bytes,
                storage_provider=stored.storage_provider,
                storage_path=stored.storage_path,
                uploaded_by_user_id=developer.id,
            )
        )


def _update_blog_media(db: Session) -> None:
    media = {
        "what-to-expect-from-a-first-therapy-conversation": (
            "/demo/blog/first-conversation.svg",
            "Two chairs in a calm therapy room.",
        ),
        "a-small-pause-when-everything-feels-like-too-much": (
            "/demo/blog/gentle-pause.svg",
            "Abstract layered shapes suggesting a gentle pause.",
        ),
        "questions-to-ask-when-choosing-a-therapist": (
            "/demo/blog/choosing-support.svg",
            "An open notebook beside a cup and leaves.",
        ),
    }
    for slug, (url, alt) in media.items():
        post = db.scalar(select(BlogPost).where(BlogPost.slug == slug))
        if post is not None:
            post.cover_image_url = url
            post.cover_image_alt = alt
            if post.published_at is None:
                post.published_at = utc_now() - timedelta(days=7)


def seed_therapy_demo_data(db: Session, *, role_map: dict, developer: User) -> None:
    """Seed a coherent, synthetic practice scenario for local presentation review."""
    if settings.is_production:
        raise RuntimeError("Therapy presentation data cannot be seeded in production.")

    _seed_settings(db)
    _seed_landing_sections(db)
    staff = _seed_staff(
        db,
        role_map=role_map,
        developer=developer,
    )
    profiles = _seed_therapist_profiles(db)

    for key in ("amani", "leila", "njeri"):
        profiles[key].user_id = staff[key].id

    _seed_therapist_profile_publications(
        db,
        profiles=profiles,
        staff=staff,
    )

    services = _seed_services(db)
    _seed_availability(db, profiles=profiles, services=services)
    appointments = _seed_appointments(db, profiles=profiles, services=services)
    _seed_contact_messages(db)
    _seed_email_logs(db)
    orders = _seed_commerce_lifecycle(db, services=services)
    _seed_client_records(db, appointments=appointments, orders=orders)
    _seed_media_library(db, developer=developer)
    _update_blog_media(db)
    db.flush()
