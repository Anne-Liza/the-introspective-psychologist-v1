"""align structured CMS starter content

Revision ID: 0009_structured_cms_defaults
Revises: 0008_landing_section_assets
"""

from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "0009_structured_cms_defaults"

down_revision: Union[str, None] = (
    "0008_landing_section_assets"
)

branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None

depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


SECTIONS = [
    # Branding
    {
        "key": "branding.name",
        "eyebrow": None,
        "title": "The Introspective Psychologist",
        "body": None,
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 1,
        "is_visible": True,
    },
    {
        "key": "branding.label",
        "eyebrow": None,
        "title": "Therapy Practice",
        "body": None,
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 2,
        "is_visible": True,
    },
    {
        "key": "branding.logo",
        "eyebrow": None,
        "title": "Site logo",
        "body": None,
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 3,
        "is_visible": True,
    },
    {
        "key": "branding.footer_tagline",
        "eyebrow": None,
        "title": (
            "A calm space for reflection, healing, "
            "and steady emotional growth."
        ),
        "body": None,
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 4,
        "is_visible": True,
    },
    {
        "key": "branding.footer_description",
        "eyebrow": None,
        "title": (
            "Explore the practice, meet the therapists, "
            "and take a clear next step when you feel ready."
        ),
        "body": None,
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 5,
        "is_visible": True,
    },

    # Home
    {
        "key": "home.hero",
        "eyebrow": "The Introspective Psychologist",
        "title": (
            "Therapy that makes room for reflection, "
            "care, and becoming."
        ),
        "body": (
            "A calm multi-therapist practice where clients "
            "can explore services, meet the team, check "
            "availability, and request a session with ease."
        ),
        "cta_label": "Request an appointment",
        "cta_url": "/book",
        "image_url": "/demo/practice/practice-room.svg",
        "sort_order": 1,
        "is_visible": True,
    },
    {
        "key": "home.approach",
        "eyebrow": "Approach",
        "title": (
            "Grounded, thoughtful care for people "
            "navigating inner and outer change."
        ),
        "body": (
            "This practice is shaped around reflection, "
            "emotional safety, and practical support."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 2,
        "is_visible": True,
    },
    {
        "key": "home.support_areas",
        "eyebrow": "Support areas",
        "title": (
            "Space for what feels heavy, unclear, "
            "or ready to change."
        ),
        "body": (
            "Explore the practice team to find support "
            "aligned with your needs and preferences."
        ),
        "cta_label": "Meet the therapists",
        "cta_url": "/therapists",
        "image_url": None,
        "sort_order": 3,
        "is_visible": True,
    },
    {
        "key": "home.blog",
        "eyebrow": "From the blog",
        "title": (
            "Gentle resources for reflection "
            "and everyday wellbeing."
        ),
        "body": "Explore recent articles from the practice.",
        "cta_label": "View all articles",
        "cta_url": "/blog",
        "image_url": None,
        "sort_order": 4,
        "is_visible": True,
    },
    {
        "key": "home.process",
        "eyebrow": "How it works",
        "title": "A simple path from curiosity to care.",
        "body": (
            "Explore the practice, review availability, "
            "and request a session when you are ready."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 5,
        "is_visible": True,
    },
    {
        "key": "home.cta",
        "eyebrow": "Ready when you are",
        "title": "Begin with a gentle appointment request.",
        "body": (
            "Clients can request a session, send a message, "
            "or check availability. The practice team can "
            "guide the next steps from a private workspace."
        ),
        "cta_label": "Request appointment",
        "cta_url": "/book",
        "image_url": None,
        "sort_order": 6,
        "is_visible": True,
    },

    # About
    {
        "key": "about.hero",
        "eyebrow": "Our practice",
        "title": (
            "Thoughtful therapy, held by "
            "a collaborative team."
        ),
        "body": (
            "A multi-therapist practice offering grounded "
            "support for people seeking reflection, emotional "
            "safety, and practical change."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": "/demo/practice/practice-room.svg",
        "sort_order": 1,
        "is_visible": True,
    },
    {
        "key": "about.profile",
        "eyebrow": "How we work",
        "title": (
            "Care begins with fit, clarity, "
            "and emotional safety."
        ),
        "body": (
            "Our therapists bring different specialties and "
            "approaches while sharing a commitment to "
            "respectful, collaborative care."
        ),
        "cta_label": "Meet the therapists",
        "cta_url": "/therapists",
        "image_url": None,
        "sort_order": 2,
        "is_visible": True,
    },
    {
        "key": "about.principles",
        "eyebrow": "Practice principles",
        "title": "What guides the experience of care.",
        "body": (
            "A calm website is useful only when the care "
            "behind it is understandable, respectful, "
            "and shaped around real people."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 3,
        "is_visible": True,
    },
    {
        "key": "about.team",
        "eyebrow": "Meet the team",
        "title": (
            "Different perspectives, "
            "one thoughtful practice."
        ),
        "body": (
            "Meet the therapists behind the practice "
            "and explore their areas of support."
        ),
        "cta_label": "View all therapist profiles",
        "cta_url": "/therapists",
        "image_url": None,
        "sort_order": 4,
        "is_visible": True,
    },
    {
        "key": "about.cta",
        "eyebrow": "A gentle next step",
        "title": "Not sure which therapist or service fits?",
        "body": (
            "Send the practice an administrative message. "
            "We can explain formats, fees, availability, "
            "and the booking process."
        ),
        "cta_label": "Contact the practice",
        "cta_url": "/contact",
        "image_url": None,
        "sort_order": 5,
        "is_visible": True,
    },

    # Services
    {
        "key": "services.hero",
        "eyebrow": "Services",
        "title": "Support shaped around real life.",
        "body": (
            "Compare the practice's current services, session "
            "formats, typical duration, and fees before "
            "choosing a comfortable next step."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 1,
        "is_visible": True,
    },
    {
        "key": "services.guidance",
        "eyebrow": "Guidance",
        "title": "Not sure where to begin?",
        "body": (
            "Meet the team or send an administrative question. "
            "You do not need to diagnose yourself before "
            "reaching out."
        ),
        "cta_label": "Meet the therapists",
        "cta_url": "/therapists",
        "image_url": None,
        "sort_order": 2,
        "is_visible": True,
    },
    {
        "key": "services.formats",
        "eyebrow": "Session formats",
        "title": "Flexible ways to meet.",
        "body": (
            "Available session formats depend on the "
            "selected service and therapist."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 3,
        "is_visible": True,
    },
    {
        "key": "services.process",
        "eyebrow": "How it works",
        "title": (
            "A clear path from exploring "
            "to confirmation."
        ),
        "body": (
            "Explore available services, request a suitable "
            "option, and let the practice confirm fit "
            "and availability."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 4,
        "is_visible": True,
    },
    {
        "key": "services.cta",
        "eyebrow": "Next step",
        "title": (
            "Ready to ask about the right "
            "kind of support?"
        ),
        "body": (
            "Send an appointment request and the practice "
            "will guide the next step."
        ),
        "cta_label": "Request an appointment",
        "cta_url": "/book",
        "image_url": None,
        "sort_order": 5,
        "is_visible": True,
    },

    # Contact
    {
        "key": "contact.hero",
        "eyebrow": "Contact the practice",
        "title": (
            "A clear, gentle way to begin "
            "a conversation."
        ),
        "body": (
            "Ask about therapist fit, services, availability, "
            "workshops, or the administrative steps involved "
            "in starting care."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": "/demo/practice/practice-room.svg",
        "sort_order": 1,
        "is_visible": True,
    },
    {
        "key": "contact.email",
        "eyebrow": "Email",
        "title": "hello@therapy.demo.example",
        "body": "For general administrative enquiries.",
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 2,
        "is_visible": True,
    },
    {
        "key": "contact.phone",
        "eyebrow": "Phone",
        "title": "+254 700 000 000",
        "body": "For administrative and booking enquiries.",
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 3,
        "is_visible": True,
    },
    {
        "key": "contact.location",
        "eyebrow": "Location",
        "title": "Westlands, Nairobi",
        "body": (
            "Exact appointment details are shared "
            "after confirmation."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 4,
        "is_visible": True,
    },
    {
        "key": "contact.hours",
        "eyebrow": "Office hours",
        "title": "Monday–Friday, 8:00–18:00 EAT",
        "body": (
            "Messages received outside these hours are "
            "reviewed during the next working period."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 5,
        "is_visible": True,
    },
    {
        "key": "contact.faq.fit",
        "eyebrow": "Finding support",
        "title": "How do I choose a therapist?",
        "body": (
            "Start with therapist profiles and areas of focus. "
            "If you are still unsure, send an administrative "
            "message and the practice can explain the options."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 100,
        "is_visible": True,
    },
    {
        "key": "contact.faq.formats",
        "eyebrow": "Session formats",
        "title": (
            "Are online and in-person "
            "sessions available?"
        ),
        "body": (
            "Available formats depend on the therapist, "
            "service, and current schedule."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 101,
        "is_visible": True,
    },
    {
        "key": "contact.faq.request",
        "eyebrow": "Appointments",
        "title": (
            "What happens after I request "
            "an appointment?"
        ),
        "body": (
            "The practice reviews the request, confirms "
            "therapist fit and availability, and contacts "
            "you with the next administrative steps."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 102,
        "is_visible": True,
    },
    {
        "key": "contact.faq.fees",
        "eyebrow": "Fees",
        "title": "Where can I find service fees?",
        "body": (
            "Published fees and session details appear "
            "on the Services page."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 103,
        "is_visible": True,
    },
    {
        "key": "contact.emergency",
        "eyebrow": "Urgent support",
        "title": (
            "This website is not an emergency "
            "or crisis service."
        ),
        "body": (
            "If you or someone else is in immediate danger, "
            "contact local emergency services or go to the "
            "nearest emergency department."
        ),
        "cta_label": None,
        "cta_url": None,
        "image_url": None,
        "sort_order": 200,
        "is_visible": True,
    },
]


def _by_key(key: str) -> dict:
    return next(
        section
        for section in SECTIONS
        if section["key"] == key
    )


def _update_legacy(
    bind,
    *,
    key: str,
    old_title: str,
) -> None:
    section = _by_key(key)

    bind.execute(
        sa.text(
            """
            UPDATE landing_sections
            SET
                eyebrow = :eyebrow,
                title = :title,
                body = :body,
                cta_label = :cta_label,
                cta_url = :cta_url,
                image_url = :image_url,
                sort_order = :sort_order,
                is_visible = :is_visible,
                updated_at = CURRENT_TIMESTAMP
            WHERE key = CAST(:key AS VARCHAR(150))
              AND title = :old_title
            """
        ),
        {
            **section,
            "old_title": old_title,
        },
    )


def upgrade() -> None:
    bind = op.get_bind()

    # Only untouched generic Launch Kit content
    # is replaced. Existing admin edits survive.
    _update_legacy(
        bind,
        key="home.hero",
        old_title="Build a focused digital presence.",
    )

    _update_legacy(
        bind,
        key="home.cta",
        old_title="Ready to start a conversation?",
    )

    _update_legacy(
        bind,
        key="about.profile",
        old_title="About this portfolio.",
    )

    # Obsolete generic portfolio-only sections
    # are removed only when still untouched.
    bind.execute(
        sa.text(
            """
            DELETE FROM landing_sections
            WHERE key = 'home.about'
              AND title = 'A clear space for your story.'
            """
        )
    )

    bind.execute(
        sa.text(
            """
            DELETE FROM landing_sections
            WHERE key = 'home.featured_projects'
              AND title = 'Featured projects and case studies.'
            """
        )
    )

    insert_sql = sa.text(
        """
        INSERT INTO landing_sections (
            id,
            key,
            title,
            eyebrow,
            body,
            cta_label,
            cta_url,
            image_url,
            image_asset_id,
            sort_order,
            is_visible,
            created_at,
            updated_at
        )
        SELECT
            :id,
            CAST(:key AS VARCHAR(150)),
            :title,
            :eyebrow,
            :body,
            :cta_label,
            :cta_url,
            :image_url,
            NULL,
            :sort_order,
            :is_visible,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1
            FROM landing_sections
            WHERE key = :key
        )
        """
    )

    for section in SECTIONS:
        bind.execute(
            insert_sql,
            {
                "id": str(uuid4()),
                **section,
            },
        )


def downgrade() -> None:
    # Content migrations are intentionally
    # non-destructive on downgrade.
    pass
