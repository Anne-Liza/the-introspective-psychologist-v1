import { apiClient } from "../../../lib/api-client";

export type FulfillmentEvent = {
  id: string;
  fulfillment_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  notes: string | null;
  created_at: string;
};

export type FulfillmentRecord = {
  id: string;
  fulfillment_number: string;
  receipt_id: string;
  payment_request_id: string;
  commerce_order_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  fulfillment_type: "manual" | "digital" | "physical" | "service" | "session_package" | "mixed";
  status: "pending" | "in_progress" | "fulfilled" | "cancelled";
  notes: string | null;
  started_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  events: FulfillmentEvent[];
};

export type CreateFulfillmentPayload = {
  receipt_id: string;
  fulfillment_type?: FulfillmentRecord["fulfillment_type"];
  notes?: string | null;
};

export type UpdateFulfillmentPayload = {
  status?: FulfillmentRecord["status"];
  fulfillment_type?: FulfillmentRecord["fulfillment_type"];
  notes?: string | null;
  event_notes?: string | null;
};

export async function fetchFulfillmentRecords(): Promise<FulfillmentRecord[]> {
  return (await apiClient.get("/fulfillment")).data;
}

export async function createFulfillmentFromReceipt(
  payload: CreateFulfillmentPayload,
): Promise<FulfillmentRecord> {
  return (await apiClient.post("/fulfillment/from-receipt", payload)).data;
}

export async function updateFulfillment({
  id,
  data,
}: {
  id: string;
  data: UpdateFulfillmentPayload;
}): Promise<FulfillmentRecord> {
  return (await apiClient.patch(`/fulfillment/${id}`, data)).data;
}
