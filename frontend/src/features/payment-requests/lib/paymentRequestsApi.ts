import { apiClient } from "../../../lib/api-client";

export type PaymentRequestEvent = {
  id: string;
  payment_request_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  provider: string | null;
  provider_reference: string | null;
  provider_transaction_reference: string | null;
  amount: string | null;
  currency: string | null;
  actor_user_id: string | null;
  notes: string | null;
  created_at: string;
};

export type PaymentRequest = {
  id: string;
  request_number: string;
  commerce_order_id: string | null;
  target_type:
    | "commerce_order"
    | "booking_hold";
  target_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  amount: string;
  currency: string;
  provider: string;
  provider_reference: string | null;
  provider_transaction_reference: string | null;
  settlement_account_label: string | null;
  status: string;
  description: string | null;
  admin_notes: string | null;
  expires_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  events: PaymentRequestEvent[];
};

export type PublicPaymentRequestPayload = {
  commerce_order_id: string;
  customer_email: string;
  provider: "manual" | "mpesa";
  description?: string;
};

export async function createPublicPaymentRequest(
  payload: PublicPaymentRequestPayload,
): Promise<PaymentRequest> {
  return (
    await apiClient.post(
      "/payment-requests/public/from-order",
      payload,
    )
  ).data;
}

export async function fetchPaymentRequests(): Promise<
  PaymentRequest[]
> {
  return (
    await apiClient.get("/payment-requests")
  ).data;
}

export async function updatePaymentRequest({
  id,
  data,
}: {
  id: string;
  data: Partial<
    Pick<
      PaymentRequest,
      | "status"
      | "provider_reference"
      | "admin_notes"
    >
  > & {
    event_notes?: string;
  };
}): Promise<PaymentRequest> {
  return (
    await apiClient.patch(
      `/payment-requests/${id}`,
      data,
    )
  ).data;
}

export type PublicPaymentStatus = {
  payment_request_id: string;
  request_number: string;
  status: string;
  amount: string;
  currency: string;
  provider: string;
  provider_transaction_reference: string | null;

  customer_state:
    | "waiting"
    | "confirming"
    | "paid"
    | "cancelled"
    | "failed"
    | "not_confirmed";
  provider_outcome:
    | "succeeded"
    | "cancelled"
    | "failed"
    | null;
  confirmation_pending: boolean;

  receipt_number: string | null;
  receipt_status: string | null;
};

export async function fetchPublicPaymentStatus(
  paymentRequestId: string,
): Promise<PublicPaymentStatus> {
  return (
    await apiClient.get(
      `/payment-requests/public/${paymentRequestId}/status`,
    )
  ).data;
}
