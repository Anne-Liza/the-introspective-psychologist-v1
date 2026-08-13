from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class MpesaAdapterConfig:
    consumer_key: str
    consumer_secret: str
    shortcode: str
    passkey: str
    environment: str
    callback_url: str
    transaction_type: str
    account_reference: str

    @property
    def is_configured(self) -> bool:
        return all(
            [
                self.consumer_key,
                self.consumer_secret,
                self.shortcode,
                self.passkey,
                self.callback_url,
            ]
        )

    @property
    def is_sandbox(self) -> bool:
        return self.environment.lower() == "sandbox"


    @property
    def api_base_url(self) -> str:
        if self.is_sandbox:
            return (
                "https://sandbox.safaricom.co.ke"
            )

        return "https://api.safaricom.co.ke"

    @property
    def oauth_url(self) -> str:
        return (
            f"{self.api_base_url}"
            "/oauth/v1/generate"
        )

    @property
    def stk_push_url(self) -> str:
        return (
            f"{self.api_base_url}"
            "/mpesa/stkpush/v1/processrequest"
        )


    @property
    def stk_query_url(self) -> str:
        return (
            f"{self.api_base_url}"
            "/mpesa/stkpushquery/v1/query"
        )

def get_mpesa_config() -> MpesaAdapterConfig:
    return MpesaAdapterConfig(
        consumer_key=settings.MPESA_CONSUMER_KEY,
        consumer_secret=settings.MPESA_CONSUMER_SECRET,
        shortcode=settings.MPESA_SHORTCODE,
        passkey=settings.MPESA_PASSKEY,
        environment=settings.MPESA_ENVIRONMENT,
        callback_url=settings.MPESA_CALLBACK_URL,
        transaction_type=settings.MPESA_TRANSACTION_TYPE,
        account_reference=settings.MPESA_ACCOUNT_REFERENCE,
    )
