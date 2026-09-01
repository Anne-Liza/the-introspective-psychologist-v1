import { apiClient } from "../../../lib/api-client";
import type { PaymentRequest } from "../../payment-requests/lib/paymentRequestsApi";

export type BookingFormat = {
  key: string;
  label: string;
  requires_location: boolean;
};

export type BookingLocation = {
  key: string;
  label: string;
};

export type PaymentPolicy =
  | "none"
  | "pay_later"
  | "deposit"
  | "full_upfront";

export type ConfirmationMode =
  | "instant"
  | "staff_approval";

export type BookingSettingsSource =
  | "profile"
  | "database";

export type BookingSettings = {
  payment_policy: PaymentPolicy;
  deposit_percentage: number | null;
  confirmation_mode: ConfirmationMode;
  recommended_payment_provider: string | null;
  source: BookingSettingsSource;
};

export type BookingSettingsUpdate = Omit<
  BookingSettings,
  "source"
>;

export type PublicBookingConfig = {
  booking_mode: string;
  client_accounts_required: boolean;
  session_formats: BookingFormat[];
  locations: BookingLocation[];
  therapist_selection: string;
  allocation_mode: string;
  hold_minutes: number;
  booking_window_days: number;
  timezone: string;
  payment_policy: PaymentPolicy;
  deposit_percentage: number | null;
  confirmation_mode: ConfirmationMode;
  payment_before_booking: boolean;
  recommended_payment_provider: string | null;
};

export type BookableSlot = {
  date: string;
  start_time: string;
  end_time: string;
  session_format: string;
  location: string | null;
};

export type PublicBookingHold = {
  id: string;
  hold_date: string;
  start_time: string;
  end_time: string;
  session_format: string | null;
  location: string | null;
  status: "active" | "payment_pending" | "payment_verified" | "expired" | "converted" | "cancelled";
  expires_at: string;
  payment_policy_snapshot: PaymentPolicy | null;
  confirmation_mode_snapshot: ConfirmationMode | null;
  quoted_price_amount: string | number | null;
  advance_payment_amount: string | number | null;
  payment_currency: string | null;
  deposit_percentage_snapshot: number | null;
};

export type PublicBookingConfirmation = {
  appointment_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  session_format: string | null;
  location: string | null;
  therapist_profile_id: string | null;
};

export type BookingHold = {
  id: string;
  hold_date: string;
  start_time: string;
  end_time: string;
  service_id: string | null;
  therapist_profile_id: string | null;
  session_format: string | null;
  location: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  status: "active" | "payment_pending" | "payment_verified" | "expired" | "converted" | "cancelled";
  expires_at: string;
  appointment_id: string | null;
  payment_policy_snapshot: PaymentPolicy | null;
  confirmation_mode_snapshot: ConfirmationMode | null;
  quoted_price_amount: string | number | null;
  advance_payment_amount: string | number | null;
  payment_currency: string | null;
  deposit_percentage_snapshot: number | null;
  sort_order: number;
};

export async function fetchBookingSettings(): Promise<BookingSettings> {
  return (
    await apiClient.get<BookingSettings>(
      "/booking-engine/settings",
    )
  ).data;
}

export async function updateBookingSettings(
  payload: BookingSettingsUpdate,
): Promise<BookingSettings> {
  return (
    await apiClient.put<BookingSettings>(
      "/booking-engine/settings",
      payload,
    )
  ).data;
}

export async function fetchPublicBookingConfig(): Promise<PublicBookingConfig> {
  return (await apiClient.get("/booking-engine/public/config")).data;
}

export async function fetchPublicBookableSlots(params: {
  date: string;
  service_id: string;
  session_format: string;
  location?: string;
  preferred_therapist_profile_id?: string;
}): Promise<BookableSlot[]> {
  return (await apiClient.get("/booking-engine/public/slots", { params })).data;
}

export type PublicBookingDetails = {
  hold_date: string;
  start_time: string;
  end_time: string;
  service_id: string;
  preferred_therapist_profile_id?: string | null;
  session_format: string;
  location?: string | null;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
};

export type PublicBookingPayload =
  PublicBookingDetails & {
    client_message?: string | null;
  };

export async function createPublicBooking(
  payload: PublicBookingPayload,
): Promise<PublicBookingConfirmation> {
  return (
    await apiClient.post(
      "/booking-engine/public/bookings",
      payload,
    )
  ).data;
}

export async function createPublicBookingHold(
  payload: PublicBookingDetails,
): Promise<PublicBookingHold> {
  return (
    await apiClient.post(
      "/booking-engine/public/holds",
      payload,
    )
  ).data;
}


export async function createPublicBookingHoldPaymentRequest(
  payload: {
    holdId: string;
    customer_email: string;
  },
): Promise<PaymentRequest> {
  return (
    await apiClient.post(
      `/booking-engine/public/holds/${payload.holdId}/payment-request`,
      {
        customer_email: payload.customer_email,
      },
    )
  ).data;
}

export async function confirmPublicBookingHold(payload: {
  holdId: string;
  client_message?: string | null;
}): Promise<PublicBookingConfirmation> {
  return (
    await apiClient.post(`/booking-engine/public/holds/${payload.holdId}/confirm`, {
      client_message: payload.client_message ?? null,
    })
  ).data;
}

export async function fetchBookingHolds(): Promise<BookingHold[]> {
  return (await apiClient.get("/booking-engine/holds")).data;
}

export async function updateBookingHold({
  id,
  data,
}: {
  id: string;
  data: Partial<Pick<BookingHold, "status" | "appointment_id">>;
}): Promise<BookingHold> {
  return (await apiClient.patch(`/booking-engine/holds/${id}`, data)).data;
}

export async function deleteBookingHold(id: string): Promise<void> {
  await apiClient.delete(`/booking-engine/holds/${id}`);
}


export type PublicAvailableDate = {
  date: string;
  available_slot_count: number;
  first_start_time: string;
};

export async function fetchPublicAvailableDates(params: {
  service_id: string;
  session_format: string;
  location?: string;
  preferred_therapist_profile_id?: string;
}): Promise<PublicAvailableDate[]> {
  return (
    await apiClient.get(
      "/booking-engine/public/available-dates",
      { params },
    )
  ).data;
}
