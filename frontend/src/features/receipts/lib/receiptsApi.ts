import { apiClient } from "../../../lib/api-client";

export type ReceiptEvent = {
  id: string;
  receipt_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  notes: string | null;
  created_at: string;
};

export type ReceiptRecord = {
  id: string;
  receipt_number: string;
  payment_request_id: string;
  payment_reference: string;
  target_type: "commerce_order" | "booking_hold";
  target_id: string;
  commerce_order_id: string | null;
  appointment_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  amount: string;
  currency: string;
  provider: string;
  provider_reference: string | null;
  provider_transaction_reference: string | null;
  status: "issued" | "voided";
  notes: string | null;
  issued_at: string;
  voided_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  events: ReceiptEvent[];
};

export type CreateReceiptPayload = {
  payment_request_id: string;
  notes?: string | null;
};

export type UpdateReceiptPayload = {
  status?: "issued" | "voided";
  notes?: string | null;
  event_notes?: string | null;
};

export async function fetchReceipts(): Promise<ReceiptRecord[]> {
  return (await apiClient.get("/receipts")).data;
}

export async function createReceiptFromPaymentRequest(
  payload: CreateReceiptPayload,
): Promise<ReceiptRecord> {
  return (
    await apiClient.post(
      "/receipts/from-payment-request",
      payload,
    )
  ).data;
}

export async function updateReceipt({
  id,
  data,
}: {
  id: string;
  data: UpdateReceiptPayload;
}): Promise<ReceiptRecord> {
  return (
    await apiClient.patch(
      `/receipts/${id}`,
      data,
    )
  ).data;
}
