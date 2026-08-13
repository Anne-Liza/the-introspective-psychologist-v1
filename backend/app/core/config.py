from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "The Introspective Psychologist Production Proof"
    APP_PROFILE_NAME: str = "therapy_practice"
    APP_ENV: str = "development"
    APP_VERSION: str = "1.0.0"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    DEPLOYMENT_TARGET: str = "local"
    CLIENT_NAME: str = "The Introspective Psychologist Production Proof"
    APP_RELEASE_CHANNEL: str = "starter"
    API_DOCS_ENABLED: bool = True
    SEED_DEMO_DATA: bool = False
    DEMO_STAFF_PASSWORD: str = ""

    DATABASE_URL: str = "sqlite:///./dev.sqlite3"
    TEST_DATABASE_URL: str = "sqlite:///./test.sqlite3"

    JWT_SECRET_KEY: str = "change-this-access-secret"
    JWT_REFRESH_SECRET_KEY: str = "change-this-refresh-secret"
    INVITATION_TOKEN_SECRET: str = "change-this-invitation-secret"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATA_ENCRYPTION_KEY: str = ""

    SUPER_DEVELOPER_EMAIL: str = "developer@example.com"
    SUPER_DEVELOPER_PASSWORD: str = "ChangeMe123!"
    SUPER_DEVELOPER_FULL_NAME: str = "The Introspective Psychologist Production Proof Developer"

    EMAIL_PROVIDER: str = "smtp"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = False
    EMAIL_FROM: str = "noreply@example.com"

    STORAGE_PROVIDER: str = "local"
    LOCAL_UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_UPLOAD_TYPES: str = "image/jpeg,image/png,image/webp,application/pdf,text/plain"

    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = "auto"

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_SHORTCODE: str = ""
    MPESA_PASSKEY: str = ""
    MPESA_ENVIRONMENT: str = "sandbox"
    MPESA_CALLBACK_URL: str = ""
    MPESA_TRANSACTION_TYPE: str = "CustomerPayBillOnline"
    MPESA_ACCOUNT_REFERENCE: str = "LaunchKit"

    SENTRY_DSN: str = ""

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_GLOBAL_REQUESTS: int = 300
    RATE_LIMIT_GLOBAL_WINDOW_SECONDS: int = 300
    RATE_LIMIT_AUTH_IP_REQUESTS: int = 10
    RATE_LIMIT_AUTH_IP_WINDOW_SECONDS: int = 60
    RATE_LIMIT_AUTH_IDENTIFIER_REQUESTS: int = 5
    RATE_LIMIT_AUTH_IDENTIFIER_WINDOW_SECONDS: int = 900
    RATE_LIMIT_INVITATION_MANAGE_REQUESTS: int = 30
    RATE_LIMIT_INVITATION_MANAGE_WINDOW_SECONDS: int = 3600
    RATE_LIMIT_CONTACT_REQUESTS: int = 3
    RATE_LIMIT_CONTACT_WINDOW_SECONDS: int = 600
    RATE_LIMIT_APPOINTMENT_REQUEST_REQUESTS: int = 10
    RATE_LIMIT_APPOINTMENT_REQUEST_WINDOW_SECONDS: int = 600
    RATE_LIMIT_BOOKING_HOLD_REQUESTS: int = 10
    RATE_LIMIT_BOOKING_HOLD_WINDOW_SECONDS: int = 600
    RATE_LIMIT_CHECKOUT_ORDER_REQUESTS: int = 10
    RATE_LIMIT_CHECKOUT_ORDER_WINDOW_SECONDS: int = 600
    RATE_LIMIT_CHECKOUT_PAYMENT_REQUESTS: int = 10
    RATE_LIMIT_CHECKOUT_PAYMENT_WINDOW_SECONDS: int = 600
    RATE_LIMIT_PAYMENT_INITIATION_REQUESTS: int = 10
    RATE_LIMIT_PAYMENT_INITIATION_WINDOW_SECONDS: int = 600
    RATE_LIMIT_PROVIDER_CALLBACK_REQUESTS: int = 120
    RATE_LIMIT_PROVIDER_CALLBACK_WINDOW_SECONDS: int = 60
    RATE_LIMIT_UPLOAD_REQUESTS: int = 20
    RATE_LIMIT_UPLOAD_WINDOW_SECONDS: int = 3600

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production" or self.DEPLOYMENT_TARGET.lower() == "production"

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    @cached_property
    def allowed_upload_types(self) -> set[str]:
        return {item.strip() for item in self.ALLOWED_UPLOAD_TYPES.split(",") if item.strip()}

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    def validate_production_security(self) -> None:
        if not self.is_production:
            return

        errors: list[str] = []

        placeholder_values = {
            "",
            "change-this-access-secret",
            "change-this-refresh-secret",
            "change-this-invitation-secret",
            "replace-with-generated-secret",
            "replace-with-generated-refresh-secret",
            "replace-with-generated-invitation-secret",
            "replace-with-generated-data-encryption-key",
            "ChangeMe123!",
            "developer@example.com",
        }

        if self.API_DOCS_ENABLED:
            errors.append("API_DOCS_ENABLED must be false in production.")

        if self.SEED_DEMO_DATA:
            errors.append("SEED_DEMO_DATA must be false in production.")

        if self.JWT_SECRET_KEY in placeholder_values or len(self.JWT_SECRET_KEY) < 32:
            errors.append("JWT_SECRET_KEY must be replaced with a strong production secret.")

        if self.JWT_REFRESH_SECRET_KEY in placeholder_values or len(self.JWT_REFRESH_SECRET_KEY) < 32:
            errors.append("JWT_REFRESH_SECRET_KEY must be replaced with a different strong production secret.")

        if self.JWT_SECRET_KEY == self.JWT_REFRESH_SECRET_KEY:
            errors.append("JWT_SECRET_KEY and JWT_REFRESH_SECRET_KEY must be different.")

        from app.core.profile_policy import invitation_onboarding_enabled

        if invitation_onboarding_enabled():
            if (
                self.INVITATION_TOKEN_SECRET in placeholder_values
                or len(self.INVITATION_TOKEN_SECRET) < 32
            ):
                errors.append(
                    "INVITATION_TOKEN_SECRET must be replaced with a strong production secret."
                )
            if self.INVITATION_TOKEN_SECRET in {
                self.JWT_SECRET_KEY,
                self.JWT_REFRESH_SECRET_KEY,
            }:
                errors.append(
                    "INVITATION_TOKEN_SECRET must differ from both JWT token secrets."
                )

        if self.DATA_ENCRYPTION_KEY in placeholder_values:
            errors.append("DATA_ENCRYPTION_KEY must be set to a valid production encryption key.")
        else:
            try:
                from cryptography.fernet import Fernet

                Fernet(self.DATA_ENCRYPTION_KEY.encode("utf-8"))
            except Exception:
                errors.append("DATA_ENCRYPTION_KEY must be a valid Fernet key.")

        if self.SUPER_DEVELOPER_PASSWORD in placeholder_values or len(self.SUPER_DEVELOPER_PASSWORD) < 12:
            errors.append("SUPER_DEVELOPER_PASSWORD must be changed before production deployment.")

        if self.SUPER_DEVELOPER_EMAIL in placeholder_values:
            errors.append("SUPER_DEVELOPER_EMAIL must be set to a real admin email.")

        if not self.cors_origins:
            errors.append("BACKEND_CORS_ORIGINS must define at least one production origin.")

        for origin in self.cors_origins:
            if origin == "*":
                errors.append("BACKEND_CORS_ORIGINS cannot include '*' in production.")
            if "localhost" in origin or "127.0.0.1" in origin or "0.0.0.0" in origin:
                errors.append(f"BACKEND_CORS_ORIGINS cannot use local origin in production: {origin}")
            if origin.startswith("http://"):
                errors.append(f"BACKEND_CORS_ORIGINS must use https:// in production: {origin}")

        if not self.FRONTEND_BASE_URL.startswith("https://"):
            errors.append("FRONTEND_BASE_URL must use https:// in production.")

        if "localhost" in self.FRONTEND_BASE_URL or "127.0.0.1" in self.FRONTEND_BASE_URL:
            errors.append("FRONTEND_BASE_URL cannot use localhost in production.")

        if errors:
            message = "Production security validation failed:\n- " + "\n- ".join(errors)
            raise RuntimeError(message)


settings = Settings()
