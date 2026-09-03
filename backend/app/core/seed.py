from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.demo_seed import seed_therapy_demo_data
from app.core.security import hash_password
from app.modules.app_settings.models import AppSetting
from app.modules.blog.models import BlogPost
from app.modules.commerce_core.models import CommerceItem
from app.modules.email_templates.models import EmailTemplate
from app.modules.landing_sections.models import LandingSection
from app.modules.roles.models import Permission, Role
from app.modules.users.models import User

DEFAULT_PERMISSIONS = [
    ('system.all', 'Full system access.'),
    ('settings.read', 'Read settings.'),
    ('settings.manage', 'Manage settings.'),
    ('appointments.read', 'Read appointments.'),
    ('appointments.own.read', 'Read appointments assigned to the current therapist.'),
    ('appointments.create', 'Create appointments.'),
    ('appointments.update', 'Update appointments.'),
    ('appointments.delete', 'Delete appointments.'),
    ('availability.read', 'Read availability.'),
    ('availability.create', 'Create availability.'),
    ('availability.update', 'Update availability.'),
    ('availability.delete', 'Delete availability.'),
    ('availability.own.read', 'Read availability assigned to the current staff resource.'),
    ('availability.own.create', 'Create availability assigned to the current staff resource.'),
    ('availability.own.update', 'Update availability assigned to the current staff resource.'),
    ('availability.own.delete', 'Delete availability assigned to the current staff resource.'),
    ('blog.read', 'Read blog posts.'),
    ('blog.create', 'Create blog posts.'),
    ('blog.update', 'Update blog posts.'),
    ('blog.delete', 'Delete blog posts.'),
    ('blog.review', 'Review submitted blog article revisions.'),
    ('blog.publish', 'Publish or unpublish approved blog article revisions.'),
    ('blog.own.read', 'Read own blog articles and revisions.'),
    ('blog.own.create', 'Create own blog article drafts.'),
    ('blog.own.update', 'Update own editable blog article revisions.'),
    ('blog.own.submit', 'Submit own blog article revisions for review.'),
    ('booking_engine.read', 'Read booking engine holds.'),
    ('booking_engine.update', 'Update booking engine holds.'),
    ('booking_engine.delete', 'Delete booking engine holds.'),
    ('client_records.read', 'Read client records.'),
    ('client_records.create', 'Create client records.'),
    ('client_records.update', 'Update client records.'),
    ('commerce_core.read', 'Read commerce items and orders.'),
    ('commerce_core.create', 'Create commerce items and orders.'),
    ('commerce_core.update', 'Update commerce items and orders.'),
    ('commerce_core.delete', 'Delete commerce items and orders.'),
    ('contact_messages.read', 'Read contact messages.'),
    ('contact_messages.update', 'Update contact messages.'),
    ('contact_messages.delete', 'Delete contact messages.'),
    ('email_logs.read', 'Read email logs.'),
    ('email_templates.read', 'Read email templates.'),
    ('email_templates.create', 'Create email templates.'),
    ('email_templates.update', 'Update email templates.'),
    ('files.read', 'Read files.'),
    ('files.upload', 'Upload files.'),
    ('files.delete', 'Delete files.'),
    ('files.own.read', 'Read files owned by the current user.'),
    ('files.own.upload', 'Upload files owned by the current user.'),
    ('files.own.delete', 'Delete unused files owned by the current user.'),
    ('fulfillment.read', 'Read fulfillment records.'),
    ('fulfillment.create', 'Create fulfillment records.'),
    ('fulfillment.update', 'Update fulfillment records.'),
    ('invitations.read', 'Read staff invitations.'),
    ('invitations.manage', 'Create, revoke, and resend staff invitations.'),
    ('landing_sections.read', 'Read landing page sections.'),
    ('landing_sections.create', 'Create landing page sections.'),
    ('landing_sections.update', 'Update landing page sections.'),
    ('landing_sections.delete', 'Delete landing page sections.'),
    ('mpesa_payments.initiate', 'Prepare M-Pesa payment attempts.'),
    ('mpesa_payments.read', 'Read M-Pesa payment adapter status.'),
    ('payment_attempts.read', 'Read payment attempts and provider events.'),
    ('payment_attempts.create', 'Create payment attempts.'),
    ('payment_attempts.verify', 'Record and verify payment provider events.'),
    ('payment_requests.read', 'Read payment requests.'),
    ('payment_requests.create', 'Create payment requests.'),
    ('payment_requests.update', 'Update payment requests.'),
    ('receipts.read', 'Read receipts.'),
    ('receipts.create', 'Create receipts.'),
    ('receipts.update', 'Update receipts.'),
    ('roles.read', 'Read roles.'),
    ('roles.manage', 'Manage roles.'),
    ('services.read', 'Read services.'),
    ('services.create', 'Create services.'),
    ('services.update', 'Update services.'),
    ('services.delete', 'Delete services.'),
    ('therapist_profiles.read', 'Read therapist profiles.'),
    ('therapist_profiles.create', 'Create therapist profiles.'),
    ('therapist_profiles.update', 'Update therapist profiles.'),
    ('therapist_profiles.delete', 'Delete therapist profiles.'),
    ('therapist_profiles.review', 'Review submitted therapist profile revisions.'),
    ('therapist_profiles.publish', 'Publish or unpublish approved therapist profiles.'),
    ('therapist_profiles.own.read', 'Read own therapist profile and working revision.'),
    ('therapist_profiles.own.create', 'Create own therapist profile and initial revision.'),
    ('therapist_profiles.own.update', 'Update own therapist profile working revision.'),
    ('therapist_profiles.own.submit', 'Submit own therapist profile revision for review.'),
    ('users.read', 'Read users.'),
    ('users.create', 'Create users.'),
    ('users.update', 'Update users.'),
    ('users.delete', 'Delete users.'),
]

DEFAULT_ROLES = [
    ('Super Developer', 'Technical bootstrap, maintenance, and audited break-glass recovery access.', ['system.all']),
    ('Practice Admin', 'Owns and manages this practice, its staff, public content, operations, payments, and configuration.', ['appointments.create', 'appointments.delete', 'appointments.read', 'appointments.update', 'availability.create', 'availability.delete', 'availability.own.create', 'availability.own.delete', 'availability.own.read', 'availability.own.update', 'availability.read', 'availability.update', 'blog.create', 'blog.delete', 'blog.read', 'blog.update', 'blog.review', 'blog.publish', 'booking_engine.delete', 'booking_engine.read', 'booking_engine.update', 'client_records.create', 'client_records.read', 'client_records.update', 'commerce_core.create', 'commerce_core.delete', 'commerce_core.read', 'commerce_core.update', 'contact_messages.delete', 'contact_messages.read', 'contact_messages.update', 'email_logs.read', 'email_templates.create', 'email_templates.read', 'email_templates.update', 'files.delete', 'files.read', 'files.upload', 'fulfillment.create', 'fulfillment.read', 'fulfillment.update', 'invitations.manage', 'invitations.read', 'landing_sections.create', 'landing_sections.delete', 'landing_sections.read', 'landing_sections.update', 'mpesa_payments.initiate', 'mpesa_payments.read', 'payment_attempts.create', 'payment_attempts.read', 'payment_attempts.verify', 'payment_requests.create', 'payment_requests.read', 'payment_requests.update', 'receipts.create', 'receipts.read', 'receipts.update', 'roles.read', 'services.create', 'services.delete', 'services.read', 'services.update', 'settings.manage', 'settings.read', 'therapist_profiles.create', 'therapist_profiles.delete', 'therapist_profiles.own.create', 'therapist_profiles.own.read', 'therapist_profiles.own.submit', 'therapist_profiles.own.update', 'therapist_profiles.publish', 'therapist_profiles.read', 'therapist_profiles.review', 'therapist_profiles.update', 'users.read', 'users.update']),
    ('Therapist', 'Regular therapist staff who manage their own professional profile and availability through current-user scoped workflows.', ['therapist_profiles.own.read', 'therapist_profiles.own.create', 'therapist_profiles.own.update', 'therapist_profiles.own.submit', 'availability.own.read', 'availability.own.create', 'availability.own.update', 'availability.own.delete', 'appointments.own.read', 'blog.own.read', 'blog.own.create', 'blog.own.update', 'blog.own.submit', 'files.own.read', 'files.own.upload', 'files.own.delete']),
]

DEFAULT_SETTINGS = [
    ("app.name", settings.APP_NAME, "string", "branding", "Public app name."),
    ("app.maintenance_mode", "false", "boolean", "system", "Controls maintenance mode."),
    ("storage.provider", settings.STORAGE_PROVIDER, "string", "storage", "Current storage provider."),
]

DEFAULT_PROJECTS = []

DEFAULT_LANDING_SECTIONS = [{'key': 'branding.name',
  'eyebrow': None,
  'title': 'The Introspective Psychologist',
  'body': None,
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 1,
  'is_visible': True},
 {'key': 'branding.label',
  'eyebrow': None,
  'title': 'Therapy Practice',
  'body': None,
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 2,
  'is_visible': True},
 {'key': 'branding.logo',
  'eyebrow': None,
  'title': 'Site logo',
  'body': None,
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 3,
  'is_visible': True},
 {'key': 'branding.footer_tagline',
  'eyebrow': None,
  'title': 'A calm space for reflection, healing, and steady emotional growth.',
  'body': None,
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 4,
  'is_visible': True},
 {'key': 'branding.footer_description',
  'eyebrow': None,
  'title': 'Explore the practice, meet the therapists, and take a clear next step when you feel '
           'ready.',
  'body': None,
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 5,
  'is_visible': True},
 {'key': 'home.hero',
  'eyebrow': 'The Introspective Psychologist',
  'title': 'Therapy that makes room for reflection, care, and becoming.',
  'body': 'A calm multi-therapist practice where clients can explore services, meet the team, '
          'check availability, and request a session with ease.',
  'cta_label': 'Request an appointment',
  'cta_url': '/book',
  'image_url': '/demo/practice/practice-room.svg',
  'sort_order': 1,
  'is_visible': True},
 {'key': 'home.approach',
  'eyebrow': 'Approach',
  'title': 'Grounded, thoughtful care for people navigating inner and outer change.',
  'body': 'This practice is shaped around reflection, emotional safety, and practical support.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 2,
  'is_visible': True},
 {'key': 'home.support_areas',
  'eyebrow': 'Support areas',
  'title': 'Space for what feels heavy, unclear, or ready to change.',
  'body': 'Explore the practice team to find support aligned with your needs and preferences.',
  'cta_label': 'Meet the therapists',
  'cta_url': '/therapists',
  'image_url': None,
  'sort_order': 3,
  'is_visible': True},
 {'key': 'home.blog',
  'eyebrow': 'From the blog',
  'title': 'Gentle resources for reflection and everyday wellbeing.',
  'body': 'Explore recent articles from the practice.',
  'cta_label': 'View all articles',
  'cta_url': '/blog',
  'image_url': None,
  'sort_order': 4,
  'is_visible': True},
 {'key': 'home.process',
  'eyebrow': 'How it works',
  'title': 'A simple path from curiosity to care.',
  'body': 'Explore the practice, review availability, and request a session when you are ready.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 5,
  'is_visible': True},
 {'key': 'home.cta',
  'eyebrow': 'Ready when you are',
  'title': 'Begin with a gentle appointment request.',
  'body': 'Clients can request a session, send a message, or check availability. The practice team '
          'can guide the next steps from a private workspace.',
  'cta_label': 'Request appointment',
  'cta_url': '/book',
  'image_url': None,
  'sort_order': 6,
  'is_visible': True},
 {'key': 'about.hero',
  'eyebrow': 'Our practice',
  'title': 'Thoughtful therapy, held by a collaborative team.',
  'body': 'A multi-therapist practice offering grounded support for people seeking reflection, '
          'emotional safety, and practical change.',
  'cta_label': None,
  'cta_url': None,
  'image_url': '/demo/practice/practice-room.svg',
  'sort_order': 1,
  'is_visible': True},
 {'key': 'about.profile',
  'eyebrow': 'How we work',
  'title': 'Care begins with fit, clarity, and emotional safety.',
  'body': 'Our therapists bring different specialties and approaches while sharing a commitment to '
          'respectful, collaborative care.',
  'cta_label': 'Meet the therapists',
  'cta_url': '/therapists',
  'image_url': None,
  'sort_order': 2,
  'is_visible': True},
 {'key': 'about.principles',
  'eyebrow': 'Practice principles',
  'title': 'What guides the experience of care.',
  'body': 'A calm website is useful only when the care behind it is understandable, respectful, '
          'and shaped around real people.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 3,
  'is_visible': True},
 {'key': 'about.team',
  'eyebrow': 'Meet the team',
  'title': 'Different perspectives, one thoughtful practice.',
  'body': 'Meet the therapists behind the practice and explore their areas of support.',
  'cta_label': 'View all therapist profiles',
  'cta_url': '/therapists',
  'image_url': None,
  'sort_order': 4,
  'is_visible': True},
 {'key': 'about.cta',
  'eyebrow': 'A gentle next step',
  'title': 'Not sure which therapist or service fits?',
  'body': 'Send the practice an administrative message. We can explain formats, fees, '
          'availability, and the booking process.',
  'cta_label': 'Contact the practice',
  'cta_url': '/contact',
  'image_url': None,
  'sort_order': 5,
  'is_visible': True},
 {'key': 'services.hero',
  'eyebrow': 'Services',
  'title': 'Support shaped around real life.',
  'body': "Compare the practice's current services, session formats, typical duration, and fees "
          'before choosing a comfortable next step.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 1,
  'is_visible': True},
 {'key': 'services.guidance',
  'eyebrow': 'Guidance',
  'title': 'Not sure where to begin?',
  'body': 'Meet the team or send an administrative question. You do not need to diagnose yourself '
          'before reaching out.',
  'cta_label': 'Meet the therapists',
  'cta_url': '/therapists',
  'image_url': None,
  'sort_order': 2,
  'is_visible': True},
 {'key': 'services.formats',
  'eyebrow': 'Session formats',
  'title': 'Flexible ways to meet.',
  'body': 'Available session formats depend on the selected service and therapist.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 3,
  'is_visible': True},
 {'key': 'services.process',
  'eyebrow': 'How it works',
  'title': 'A clear path from exploring to confirmation.',
  'body': 'Explore available services, request a suitable option, and let the practice confirm fit '
          'and availability.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 4,
  'is_visible': True},
 {'key': 'services.cta',
  'eyebrow': 'Next step',
  'title': 'Ready to ask about the right kind of support?',
  'body': 'Send an appointment request and the practice will guide the next step.',
  'cta_label': 'Request an appointment',
  'cta_url': '/book',
  'image_url': None,
  'sort_order': 5,
  'is_visible': True},
 {'key': 'contact.hero',
  'eyebrow': 'Contact the practice',
  'title': 'A clear, gentle way to begin a conversation.',
  'body': 'Ask about therapist fit, services, availability, workshops, or the administrative steps '
          'involved in starting care.',
  'cta_label': None,
  'cta_url': None,
  'image_url': '/demo/practice/practice-room.svg',
  'sort_order': 1,
  'is_visible': True},
 {'key': 'contact.email',
  'eyebrow': 'Email',
  'title': 'hello@therapy.demo.example',
  'body': 'For general administrative enquiries.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 2,
  'is_visible': True},
 {'key': 'contact.phone',
  'eyebrow': 'Phone',
  'title': '+254 700 000 000',
  'body': 'For administrative and booking enquiries.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 3,
  'is_visible': True},
 {'key': 'contact.location',
  'eyebrow': 'Location',
  'title': 'Westlands, Nairobi',
  'body': 'Exact appointment details are shared after confirmation.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 4,
  'is_visible': True},
 {'key': 'contact.hours',
  'eyebrow': 'Office hours',
  'title': 'Monday–Friday, 8:00–18:00 EAT',
  'body': 'Messages received outside these hours are reviewed during the next working period.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 5,
  'is_visible': True},
 {'key': 'contact.faq.fit',
  'eyebrow': 'Finding support',
  'title': 'How do I choose a therapist?',
  'body': 'Start with therapist profiles and areas of focus. If you are still unsure, send an '
          'administrative message and the practice can explain the options.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 100,
  'is_visible': True},
 {'key': 'contact.faq.formats',
  'eyebrow': 'Session formats',
  'title': 'Are online and in-person sessions available?',
  'body': 'Available formats depend on the therapist, service, and current schedule.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 101,
  'is_visible': True},
 {'key': 'contact.faq.request',
  'eyebrow': 'Appointments',
  'title': 'What happens after I request an appointment?',
  'body': 'The practice reviews the request, confirms therapist fit and availability, and contacts '
          'you with the next administrative steps.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 102,
  'is_visible': True},
 {'key': 'contact.faq.fees',
  'eyebrow': 'Fees',
  'title': 'Where can I find service fees?',
  'body': 'Published fees and session details appear on the Services page.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 103,
  'is_visible': True},
 {'key': 'contact.emergency',
  'eyebrow': 'Urgent support',
  'title': 'This website is not an emergency or crisis service.',
  'body': 'If you or someone else is in immediate danger, contact local emergency services or go '
          'to the nearest emergency department.',
  'cta_label': None,
  'cta_url': None,
  'image_url': None,
  'sort_order': 200,
  'is_visible': True}]

DEFAULT_EMAIL_TEMPLATES = [
    ('invitation', 'Invitation Email', 'You have been invited to {{ app_name }}', 'You have been invited to join {{ app_name }}.\n\nRole: {{ role_name }}\nAccept invitation: {{ invitation_link }}\n\nThis invitation expires in {{ expiry_hours }} hours.', 'Template used when inviting a user.', True),
    ('password_reset', 'Password Reset Email', 'Reset your {{ app_name }} password', 'Use this link to reset your password: {{ reset_link }}', 'Template for password reset flow.', True),
    ('email_verification', 'Email Verification', 'Verify your {{ app_name }} email', 'Welcome to {{ app_name }}.\n\nUse this link to verify your email address: {{ verification_link }}\n\nIf you did not create this account, you can ignore this email.', 'Template used when verifying a new user email address.', True),
    ('appointment_request_received', 'Appointment request received', 'We received your appointment request', 'Hello {{client_name}},\n\nThank you for reaching out to {{site_name}}. Your appointment request has been received and will be reviewed.\n\nThis message confirms receipt only. It is not a clinical assessment or emergency support response.\n\nBest,\n{{site_name}}', 'Sent after a public appointment request is submitted.', True),
    ('appointment_confirmed', 'Appointment confirmed', 'Your appointment is confirmed', 'Hello {{client_name}},\n\nYour appointment with {{site_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.\n\nIf you need to change the appointment, please reply to this email or use the contact details provided by the practice.\n\nBest,\n{{site_name}}', 'Sent when an appointment is confirmed.', True),
    ('appointment_cancelled', 'Appointment cancelled', 'Your appointment has been cancelled', 'Hello {{client_name}},\n\nYour appointment scheduled for {{appointment_date}} at {{appointment_time}} has been cancelled.\n\nIf you would like to request another time, please contact the practice.\n\nBest,\n{{site_name}}', 'Sent when an appointment is cancelled.', True),
    (
        "therapist_appointment_assigned",
        "Therapist appointment assigned",
        "New appointment assigned",
        "Hello {{therapist_name}},\n\n"
        "A new appointment has been assigned to you.\n\n"
        "Client: {{client_name}}\n"
        "Service: {{service_name}}\n"
        "Date: {{appointment_date}}\n"
        "Time: {{appointment_time}}\n"
        "Format: {{session_format}}\n"
        "Location: {{location}}\n"
        "Status: {{appointment_status}}\n\n"
        "View your appointments:\n"
        "{{appointments_url}}\n\n"
        "Best,\n"
        "{{site_name}}",
        "Sent to a therapist when an appointment is assigned.",
        True,
    ),
    (
        "therapist_appointment_updated",
        "Therapist appointment updated",
        "Appointment updated",
        "Hello {{therapist_name}},\n\n"
        "An appointment on your schedule has been updated.\n\n"
        "Client: {{client_name}}\n"
        "Service: {{service_name}}\n"
        "Date: {{appointment_date}}\n"
        "Time: {{appointment_time}}\n"
        "Format: {{session_format}}\n"
        "Location: {{location}}\n"
        "Status: {{appointment_status}}\n\n"
        "View your appointments:\n"
        "{{appointments_url}}\n\n"
        "Best,\n"
        "{{site_name}}",
        "Sent when therapist-visible appointment details change.",
        True,
    ),
    (
        "therapist_appointment_cancelled",
        "Therapist appointment cancelled",
        "Appointment cancelled",
        "Hello {{therapist_name}},\n\n"
        "An appointment on your schedule has been cancelled.\n\n"
        "Client: {{client_name}}\n"
        "Service: {{service_name}}\n"
        "Date: {{appointment_date}}\n"
        "Time: {{appointment_time}}\n"
        "Format: {{session_format}}\n"
        "Location: {{location}}\n\n"
        "View your appointments:\n"
        "{{appointments_url}}\n\n"
        "Best,\n"
        "{{site_name}}",
        "Sent when an assigned appointment is cancelled.",
        True,
    ),
    ('payment_request_sent', 'Payment request sent', 'Payment request from {{site_name}}', 'Hello {{client_name}},\n\nA payment request for {{payment_amount}} has been created for {{site_name}}.\n\nPlease follow the payment instructions shared with you. Your booking or service may remain pending until payment is confirmed.\n\nBest,\n{{site_name}}', 'Sent when a payment request is created.', True),
    ('payment_received', 'Payment received', 'Payment received by {{site_name}}', 'Hello {{client_name}},\n\nYour payment of {{payment_amount}} has been received. Thank you.\n\nBest,\n{{site_name}}', 'Sent when a payment is verified.', True),
    ('receipt_issued', 'Receipt issued', 'Your receipt from {{site_name}}', 'Hello {{client_name}},\n\nYour receipt has been issued.\n\nReceipt number: {{receipt_number}}\nAmount: {{payment_amount}}\n\nBest,\n{{site_name}}', 'Sent when a receipt record is issued.', True),
    ('fulfillment_completed', 'Service completion update', 'Service update from {{site_name}}', 'Hello {{client_name}},\n\nThis is a confirmation that the related service or package step has been marked as complete in {{site_name}}.\n\nBest,\n{{site_name}}', 'Sent when a fulfillment record is marked fulfilled.', True),
    ('client_follow_up', 'Client follow-up', 'Following up from {{site_name}}', 'Hello {{client_name}},\n\nThank you for connecting with {{site_name}}. This is a follow-up regarding your recent request or appointment.\n\nPlease reply to this email if you need support with scheduling or administrative details.\n\nBest,\n{{site_name}}', 'Reusable non-clinical follow-up email.', True),
]

DEFAULT_BLOG_POSTS = [{'title': 'What to expect from a first therapy conversation', 'slug': 'what-to-expect-from-a-first-therapy-conversation', 'excerpt': 'A gentle overview of the first conversation, the questions you can ask, and how to decide whether the fit feels right.', 'body_markdown': '## The first conversation is an introduction\n\nYou do not need to arrive with everything perfectly explained. A first conversation is a chance to share what brings you in, learn how the therapist works, and notice whether the space feels respectful and manageable.\n\n## You can ask questions too\n\nYou might ask about the therapist’s approach, session format, confidentiality, fees, or what happens next. Good therapy is collaborative, and your questions belong in the room.\n\nThis article offers general information and is not a diagnosis, crisis service, or substitute for individual professional advice.', 'category': 'Starting therapy', 'tags': ['first session', 'therapy process'], 'author_name': 'The Introspective Psychologist', 'status': 'published', 'is_featured': True}, {'title': 'A small pause when everything feels like too much', 'slug': 'a-small-pause-when-everything-feels-like-too-much', 'excerpt': 'A brief grounding practice for creating a little space during an overwhelming day.', 'body_markdown': '## Begin by noticing support\n\nIf it feels comfortable, notice the chair, floor, or surface supporting your body. Let your attention rest on one steady physical sensation.\n\n## Name what is here\n\nWithout trying to solve everything, name one feeling, one need, and one next step small enough to take today.\n\nIf you are in immediate danger or need urgent support, contact local emergency or crisis services. This reflection is not emergency care.', 'category': 'Reflection', 'tags': ['grounding', 'overwhelm'], 'author_name': 'The Introspective Psychologist', 'status': 'published', 'is_featured': False}, {'title': 'Questions to ask when choosing a therapist', 'slug': 'questions-to-ask-when-choosing-a-therapist', 'excerpt': 'Practical questions that can help you understand a therapist’s approach, experience, boundaries, and session process.', 'body_markdown': '## Fit is allowed to matter\n\nCredentials and experience are important, and so is the way a therapist communicates with you. You can ask how they work with concerns similar to yours, how progress is reviewed, and what happens when an approach does not feel helpful.\n\n## Practical details reduce uncertainty\n\nAsk about location, online sessions, availability, fees, cancellation expectations, and how administrative messages are handled. Clear information can make the first step feel more manageable.\n\nThis article provides general information and does not recommend a particular clinician or treatment.', 'category': 'Finding support', 'tags': ['therapist fit', 'questions'], 'author_name': 'The Introspective Psychologist', 'status': 'published', 'is_featured': False}]

DEFAULT_COMMERCE_ITEMS = [{'name': 'Guided Reflection Workbook', 'slug': 'guided-reflection-workbook', 'item_type': 'digital', 'summary': 'A downloadable set of structured prompts for slowing down, noticing patterns, and reflecting with care.', 'description': 'A practical reflection workbook designed for personal use between moments of support. It offers general wellbeing prompts and is not an assessment, diagnosis, crisis resource, or substitute for therapy.', 'category': 'Digital resources', 'linked_service_id': None, 'price_amount': 1200, 'currency': 'KES', 'sku': 'REFLECTION-WORKBOOK', 'stock_quantity': None, 'session_credit_count': None, 'fulfillment_type': 'digital', 'image_url': None, 'sort_order': 1, 'is_featured': True, 'is_published': True}, {'name': 'Grounding Prompt Card Set', 'slug': 'grounding-prompt-card-set', 'item_type': 'physical', 'summary': 'A compact card set with gentle prompts for pausing, orienting, and returning attention to the present.', 'description': 'A physical set of general wellbeing prompts for everyday reflection. Delivery arrangements are confirmed by the practice after payment.', 'category': 'Wellbeing tools', 'linked_service_id': None, 'price_amount': 1800, 'currency': 'KES', 'sku': 'GROUNDING-CARDS', 'stock_quantity': 30, 'session_credit_count': None, 'fulfillment_type': 'physical', 'image_url': None, 'sort_order': 2, 'is_featured': False, 'is_published': True}, {'name': 'Reflective Practice Workshop', 'slug': 'reflective-practice-workshop', 'item_type': 'service', 'summary': 'A guided small-group workshop exploring sustainable reflection, boundaries, and supportive routines.', 'description': 'Workshop dates, facilitator details, and joining instructions are confirmed by the practice. This educational workshop is not group therapy or emergency support.', 'category': 'Workshops', 'linked_service_id': None, 'price_amount': 3500, 'currency': 'KES', 'sku': 'REFLECTIVE-WORKSHOP', 'stock_quantity': None, 'session_credit_count': None, 'fulfillment_type': 'service', 'image_url': None, 'sort_order': 3, 'is_featured': True, 'is_published': True}, {'name': 'Three-Session Support Bundle', 'slug': 'three-session-support-bundle', 'item_type': 'package', 'summary': 'A prepaid bundle of three individual sessions, scheduled with the practice after confirmation.', 'description': 'Purchasing this bundle creates a pending order and does not automatically confirm appointment times. Session suitability, therapist allocation, and scheduling are confirmed separately by the practice.', 'category': 'Therapy packages', 'linked_service_id': None, 'price_amount': 12000, 'currency': 'KES', 'sku': 'THREE-SESSION-BUNDLE', 'stock_quantity': None, 'session_credit_count': 3, 'fulfillment_type': 'session_package', 'image_url': None, 'sort_order': 4, 'is_featured': False, 'is_published': True}, {'name': 'Practice Reflection Notebook', 'slug': 'practice-reflection-notebook', 'item_type': 'physical', 'summary': 'A branded, lay-flat notebook for reflection, planning, and everyday writing.', 'description': 'A physical A5 notebook with a calm practice cover and unstructured writing pages. Delivery or collection arrangements are confirmed after checkout.', 'category': 'Practice merchandise', 'linked_service_id': None, 'price_amount': 1500, 'currency': 'KES', 'sku': 'PRACTICE-NOTEBOOK', 'stock_quantity': 24, 'session_credit_count': None, 'fulfillment_type': 'physical', 'image_url': None, 'sort_order': 5, 'is_featured': True, 'is_published': True}, {'name': 'Grounded Keychain', 'slug': 'grounded-keychain', 'item_type': 'physical', 'summary': 'A small branded keepsake designed as a gentle everyday reminder to pause.', 'description': 'A lightweight practice keychain for everyday use. Delivery or collection arrangements are confirmed after checkout.', 'category': 'Practice merchandise', 'linked_service_id': None, 'price_amount': 650, 'currency': 'KES', 'sku': 'GROUNDED-KEYCHAIN', 'stock_quantity': 40, 'session_credit_count': None, 'fulfillment_type': 'physical', 'image_url': None, 'sort_order': 6, 'is_featured': False, 'is_published': True}, {'name': 'Everyday Practice Tote', 'slug': 'everyday-practice-tote', 'item_type': 'physical', 'summary': 'A reusable cotton tote with understated practice branding.', 'description': 'A practical branded tote for books, notebooks, and daily essentials. Delivery or collection arrangements are confirmed after checkout.', 'category': 'Practice merchandise', 'linked_service_id': None, 'price_amount': 1800, 'currency': 'KES', 'sku': 'PRACTICE-TOTE', 'stock_quantity': 18, 'session_credit_count': None, 'fulfillment_type': 'physical', 'image_url': None, 'sort_order': 7, 'is_featured': False, 'is_published': True}, {'name': 'Practice T-Shirt', 'slug': 'practice-t-shirt', 'item_type': 'physical', 'summary': 'A soft branded T-shirt planned in multiple sizes and calm practice colours.', 'description': 'Coming soon. Apparel remains unavailable until size and stock variants are supported by the store workflow.', 'category': 'Practice merchandise', 'linked_service_id': None, 'price_amount': 2500, 'currency': 'KES', 'sku': 'PRACTICE-TSHIRT', 'stock_quantity': 0, 'session_credit_count': None, 'fulfillment_type': 'physical', 'image_url': None, 'sort_order': 8, 'is_featured': False, 'is_published': True}, {'name': 'Practice Hoodie', 'slug': 'practice-hoodie', 'item_type': 'physical', 'summary': 'A relaxed branded hoodie planned in multiple sizes for cooler days.', 'description': 'Coming soon. Apparel remains unavailable until size and stock variants are supported by the store workflow.', 'category': 'Practice merchandise', 'linked_service_id': None, 'price_amount': 4500, 'currency': 'KES', 'sku': 'PRACTICE-HOODIE', 'stock_quantity': 0, 'session_credit_count': None, 'fulfillment_type': 'physical', 'image_url': None, 'sort_order': 9, 'is_featured': False, 'is_published': True}]


def get_or_create_permission(db: Session, code: str, description: str) -> Permission:
    permission = db.scalar(select(Permission).where(Permission.code == code))
    if permission:
        permission.description = description
        return permission

    permission = Permission(code=code, description=description)
    db.add(permission)
    db.flush()
    return permission


def get_or_create_role(db: Session, name: str, description: str) -> Role:
    role = db.scalar(select(Role).where(Role.name == name))
    if role:
        role.description = description
        return role

    role = Role(name=name, description=description)
    db.add(role)
    db.flush()
    return role


def add_setting_if_missing(db: Session, key: str, values: dict) -> None:
    existing = db.scalar(select(AppSetting).where(AppSetting.key == key))
    if existing is None:
        db.add(AppSetting(key=key, **values))


def seed_configuration(db: Session) -> None:
    for key, value, value_type, group, description in DEFAULT_SETTINGS:
        add_setting_if_missing(
            db,
            key,
            {
                "value": value,
                "value_type": value_type,
                "group": group,
                "description": description,
            },
        )


def seed_portfolio_content(db: Session) -> None:
    return None


def add_landing_section_if_missing(db: Session, values: dict) -> None:
    existing = db.scalar(select(LandingSection).where(LandingSection.key == values["key"]))
    if existing is None:
        db.add(LandingSection(**values))


def seed_landing_sections(db: Session) -> None:
    for section in DEFAULT_LANDING_SECTIONS:
        add_landing_section_if_missing(db, section)


def add_email_template_if_missing(db: Session, values: dict) -> None:
    existing = db.scalar(select(EmailTemplate).where(EmailTemplate.key == values["key"]))
    if existing is None:
        db.add(EmailTemplate(**values))


def seed_email_templates(db: Session) -> None:
    for key, name, subject, body, description, is_active in DEFAULT_EMAIL_TEMPLATES:
        add_email_template_if_missing(
            db,
            {
                "key": key,
                "name": name,
                "subject": subject,
                "body": body,
                "description": description,
                "is_active": is_active,
            },
        )


def add_blog_post_if_missing(db: Session, values: dict) -> None:
    existing = db.scalar(select(BlogPost).where(BlogPost.slug == values["slug"]))
    if existing is None:
        db.add(BlogPost(**values))


def seed_blog_posts(db: Session) -> None:
    for post in DEFAULT_BLOG_POSTS:
        add_blog_post_if_missing(db, post)


def add_commerce_item_if_missing(db: Session, values: dict) -> None:
    existing = db.scalar(select(CommerceItem).where(CommerceItem.slug == values["slug"]))
    if existing is None:
        db.add(CommerceItem(**values))


def seed_commerce_items(db: Session) -> None:
    for item in DEFAULT_COMMERCE_ITEMS:
        add_commerce_item_if_missing(db, item)


def seed_system_data() -> None:
    db = SessionLocal()
    try:
        permission_map = {
            code: get_or_create_permission(db, code, description)
            for code, description in DEFAULT_PERMISSIONS
        }

        role_map = {}
        for role_name, description, permission_codes in DEFAULT_ROLES:
            role = get_or_create_role(db, role_name, description)
            role.permissions = [permission_map[code] for code in permission_codes]
            role_map[role_name] = role

        developer = db.scalar(
            select(User).where(User.email == settings.SUPER_DEVELOPER_EMAIL.lower())
        )

        if developer is None:
            developer = User(
                email=settings.SUPER_DEVELOPER_EMAIL.lower(),
                full_name=settings.SUPER_DEVELOPER_FULL_NAME,
                password_hash=hash_password(settings.SUPER_DEVELOPER_PASSWORD),
                is_active=True,
                is_verified=True,
            )
            db.add(developer)
            db.flush()

        if role_map["Super Developer"] not in developer.roles:
            developer.roles.append(role_map["Super Developer"])

        seed_configuration(db)
        seed_email_templates(db)
        seed_blog_posts(db)
        seed_commerce_items(db)
        seed_portfolio_content(db)
        seed_landing_sections(db)

        if settings.SEED_DEMO_DATA:
            if settings.is_production:
                raise RuntimeError("SEED_DEMO_DATA cannot run in production.")
            db.flush()
            seed_therapy_demo_data(db, role_map=role_map, developer=developer)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_system_data()
