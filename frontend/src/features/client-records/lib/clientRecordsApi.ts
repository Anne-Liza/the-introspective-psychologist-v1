import { apiClient } from "../../../lib/api-client";

export type ClientRecordLink = {
  id: string;
  client_record_id: string;
  link_type: string;
  linked_record_id: string;
  label: string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

export type ClientRecord = {
  id: string;
  client_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: "lead" | "active" | "inactive" | "archived";
  source: string;
  preferred_contact_method: "email" | "phone" | "whatsapp" | "none";
  admin_notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  links: ClientRecordLink[];
};

export type CreateClientRecordPayload = {
  full_name: string;
  email: string;
  phone?: string | null;
  status?: ClientRecord["status"];
  source?: string;
  preferred_contact_method?: ClientRecord["preferred_contact_method"];
  admin_notes?: string | null;
};

export type UpdateClientRecordPayload = {
  full_name?: string;
  email?: string;
  phone?: string | null;
  status?: ClientRecord["status"];
  preferred_contact_method?: ClientRecord["preferred_contact_method"];
  admin_notes?: string | null;
};

export async function fetchClientRecords(): Promise<ClientRecord[]> {
  return (await apiClient.get("/client-records")).data;
}

export async function createClientRecord(payload: CreateClientRecordPayload): Promise<ClientRecord> {
  return (await apiClient.post("/client-records", payload)).data;
}

export async function createClientRecordFromAppointment(payload: {
  appointment_id: string;
  admin_notes?: string | null;
}): Promise<ClientRecord> {
  return (await apiClient.post("/client-records/from-appointment", payload)).data;
}

export async function createClientRecordFromCommerceOrder(payload: {
  commerce_order_id: string;
  admin_notes?: string | null;
}): Promise<ClientRecord> {
  return (await apiClient.post("/client-records/from-commerce-order", payload)).data;
}

export async function updateClientRecord({
  id,
  data,
}: {
  id: string;
  data: UpdateClientRecordPayload;
}): Promise<ClientRecord> {
  return (await apiClient.patch(`/client-records/${id}`, data)).data;
}
