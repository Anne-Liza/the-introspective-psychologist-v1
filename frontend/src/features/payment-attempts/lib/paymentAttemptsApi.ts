import { apiClient } from "../../../lib/api-client";

export type PaymentProviderEvent = {
  id: string;
  payment_attempt_id: string | null;
  payment_request_id: string | null;
  provider: string;
  provider_reference: string | null;
  provider_transaction_reference: string | null;
  external_event_id: string | null;
  event_type: string;
  event_status: string;
  verification_status: string;
  amount: string | null;
  currency: string | null;
  event_fingerprint: string;
  payload_hash: string;
  payload_json: string | null;
  is_duplicate: boolean;
  original_event_id: string | null;
  notes: string | null;
  received_at: string;
  processed_at: string | null;
  created_at: string;
};

export type PaymentAttempt = {
  id: string;
  attempt_number: string;
  payment_request_id: string;
  provider: string;
  provider_reference: string | null;
  provider_transaction_reference: string | null;
  provider_session_id: string | null;
  idempotency_key: string | null;
  amount: string;
  currency: string;
  status: string;
  verification_status: string;

  reconciliation_status: string;
  reconciliation_retry_count: number;
  reconciliation_last_attempt_at: string | null;
  reconciliation_next_attempt_at: string | null;
  reconciliation_completed_at: string | null;
  reconciliation_last_error_code: string | null;
  reconciliation_last_error_message: string | null;

  checkout_url: string | null;
  error_code: string | null;
  error_message: string | null;
  initiated_by_user_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  provider_events: PaymentProviderEvent[];
};

export async function fetchPaymentAttempts(): Promise<
  PaymentAttempt[]
> {
  return (
    await apiClient.get("/payment-attempts")
  ).data;
}
