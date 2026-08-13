import { apiClient } from "../../../lib/api-client";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "no_show";

export type AppointmentSource =
  | "public_request"
  | "admin_created"
  | "presentation_seed";

export type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  service_id: string | null;
  therapist_profile_id: string | null;
  status: AppointmentStatus;
  session_format: string | null;
  location: string | null;
  client_message: string | null;
  admin_notes: string | null;
  source: AppointmentSource;
  sort_order: number;
};

export type AppointmentPayload = Omit<
  Appointment,
  "id"
>;

export async function fetchAppointments(): Promise<
  Appointment[]
> {
  return (
    await apiClient.get("/appointments")
  ).data;
}

export async function createAppointment(
  payload: AppointmentPayload,
): Promise<Appointment> {
  return (
    await apiClient.post(
      "/appointments",
      payload,
    )
  ).data;
}

export async function updateAppointment({
  id,
  data,
}: {
  id: string;
  data: Partial<AppointmentPayload>;
}): Promise<Appointment> {
  return (
    await apiClient.patch(
      `/appointments/${id}`,
      data,
    )
  ).data;
}

export async function deleteAppointment(
  id: string,
): Promise<void> {
  await apiClient.delete(
    `/appointments/${id}`,
  );
}
