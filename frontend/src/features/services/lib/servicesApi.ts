import { apiClient } from "../../../lib/api-client";

export type ServicePaymentPolicy =
  | "none"
  | "pay_later"
  | "deposit"
  | "full_upfront";

export type ServiceConfirmationMode =
  | "instant"
  | "staff_approval";

export type Service = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  service_format: string | null;
  duration_minutes: number | null;
  price_amount: string | number | null;
  currency: string | null;
  payment_policy_override: ServicePaymentPolicy | null;
  deposit_percentage_override: number | null;
  confirmation_mode_override: ServiceConfirmationMode | null;
  cta_label: string | null;
  cta_url: string | null;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
};

export type ServicePayload = Omit<Service, "id">;

export async function fetchServices(): Promise<Service[]> {
  return (await apiClient.get("/services")).data;
}

export async function fetchPublicServices(): Promise<Service[]> {
  return (await apiClient.get("/services/public")).data;
}

export async function fetchPublicService(slug: string): Promise<Service> {
  return (await apiClient.get(`/services/public/${slug}`)).data;
}

export async function createService(payload: ServicePayload): Promise<Service> {
  return (await apiClient.post("/services", payload)).data;
}

export async function updateService({
  id,
  data,
}: {
  id: string;
  data: Partial<ServicePayload>;
}): Promise<Service> {
  return (await apiClient.patch(`/services/${id}`, data)).data;
}

export async function deleteService(id: string): Promise<void> {
  await apiClient.delete(`/services/${id}`);
}
