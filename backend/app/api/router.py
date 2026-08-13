from fastapi import APIRouter

from app.modules.app_settings.routes import router as app_settings_router
from app.modules.appointments.routes import router as appointments_router
from app.modules.auth.routes import router as auth_router
from app.modules.availability.routes import router as availability_router
from app.modules.blog.routes import router as blog_router
from app.modules.booking_engine.routes import router as booking_engine_router
from app.modules.client_records.routes import router as client_records_router
from app.modules.commerce_core.routes import router as commerce_core_router
from app.modules.contact_messages.routes import router as contact_messages_router
from app.modules.email.routes import router as email_router
from app.modules.email_templates.routes import router as email_templates_router
from app.modules.files.routes import router as files_router
from app.modules.fulfillment.routes import router as fulfillment_router
from app.modules.health.routes import router as health_router
from app.modules.invitations.routes import router as invitations_router
from app.modules.landing_sections.routes import router as landing_sections_router
from app.modules.mpesa_payments.routes import router as mpesa_payments_router
from app.modules.payment_attempts.routes import router as payment_attempts_router
from app.modules.payment_requests.routes import router as payment_requests_router
from app.modules.receipts.routes import router as receipts_router
from app.modules.roles.routes import router as roles_router
from app.modules.services.routes import router as services_router
from app.modules.therapist_profiles.routes import router as therapist_profiles_router
from app.modules.users.routes import router as users_router

api_router = APIRouter()

api_router.include_router(app_settings_router, prefix="/app-settings", tags=["app-settings"])
api_router.include_router(appointments_router, prefix="/appointments", tags=["appointments"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(availability_router, prefix="/availability", tags=["availability"])
api_router.include_router(blog_router, prefix="/blog", tags=["blog"])
api_router.include_router(booking_engine_router, prefix="/booking-engine", tags=["booking-engine"])
api_router.include_router(client_records_router, prefix="/client-records", tags=["client-records"])
api_router.include_router(commerce_core_router, prefix="/commerce-core", tags=["commerce-core"])
api_router.include_router(contact_messages_router, prefix="/contact-messages", tags=["contact-messages"])
api_router.include_router(email_router, prefix="/email", tags=["email"])
api_router.include_router(email_templates_router, prefix="/email-templates", tags=["email-templates"])
api_router.include_router(files_router, prefix="/files", tags=["files"])
api_router.include_router(fulfillment_router, prefix="/fulfillment", tags=["fulfillment"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(invitations_router, prefix="/invitations", tags=["invitations"])
api_router.include_router(landing_sections_router, prefix="/landing-sections", tags=["landing-sections"])
api_router.include_router(mpesa_payments_router, prefix="/mpesa-payments", tags=["mpesa-payments"])
api_router.include_router(payment_attempts_router, prefix="/payment-attempts", tags=["payment-attempts"])
api_router.include_router(payment_requests_router, prefix="/payment-requests", tags=["payment-requests"])
api_router.include_router(receipts_router, prefix="/receipts", tags=["receipts"])
api_router.include_router(roles_router, prefix="/roles", tags=["roles"])
api_router.include_router(services_router, prefix="/services", tags=["services"])
api_router.include_router(therapist_profiles_router, prefix="/therapist-profiles", tags=["therapist-profiles"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
