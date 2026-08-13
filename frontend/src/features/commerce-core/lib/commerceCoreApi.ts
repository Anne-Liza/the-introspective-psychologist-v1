import { apiClient } from "../../../lib/api-client";

export type CommerceItem = {
  id: string;
  name: string;
  slug: string;
  item_type: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  linked_service_id: string | null;
  price_amount: string;
  currency: string;
  sku: string | null;
  stock_quantity: number | null;
  session_credit_count: number | null;
  fulfillment_type: string;
  image_url: string | null;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
};

export type CommerceOrderItem = {
  id: string;
  order_id: string;
  commerce_item_id: string | null;
  item_name: string;
  item_type: string;
  quantity: number;
  unit_amount: string;
  line_total_amount: string;
  currency: string;
  linked_service_id: string | null;
  session_credit_count: number | null;
  sort_order: number;
};

export type CommerceOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  status: string;
  fulfillment_status: string;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: CommerceOrderItem[];
};

export type PublicCommerceOrderPayload = {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  items: Array<{
    commerce_item_id: string;
    quantity: number;
  }>;
};

export async function fetchPublicCommerceItems(): Promise<CommerceItem[]> {
  return (await apiClient.get("/commerce-core/public/items")).data;
}

export async function fetchPublicCommerceItem(slug: string): Promise<CommerceItem> {
  return (await apiClient.get(`/commerce-core/public/items/${encodeURIComponent(slug)}`)).data;
}

export async function createPublicCommerceOrder(
  payload: PublicCommerceOrderPayload,
): Promise<CommerceOrder> {
  return (await apiClient.post("/commerce-core/public/orders", payload)).data;
}

export async function fetchCommerceItems(): Promise<CommerceItem[]> {
  return (await apiClient.get("/commerce-core/items")).data;
}

export async function fetchCommerceOrders(): Promise<CommerceOrder[]> {
  return (await apiClient.get("/commerce-core/orders")).data;
}

export async function updateCommerceOrder({
  id,
  data,
}: {
  id: string;
  data: Partial<Pick<CommerceOrder, "status" | "fulfillment_status" | "notes">>;
}): Promise<CommerceOrder> {
  return (await apiClient.patch(`/commerce-core/orders/${id}`, data)).data;
}

export async function deleteCommerceOrder(id: string): Promise<void> {
  await apiClient.delete(`/commerce-core/orders/${id}`);
}
