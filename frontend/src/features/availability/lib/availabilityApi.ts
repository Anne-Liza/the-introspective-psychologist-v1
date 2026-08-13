import { apiClient } from "../../../lib/api-client";

export type AvailabilityRule = {
  id: string;
  title: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  capacity: number;
  service_id: string | null;
  therapist_profile_id: string | null;
  session_format: string | null;
  location: string | null;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
};

export type AvailabilityException = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  exception_type: "available" | "blocked";
  reason: string | null;
  service_id: string | null;
  therapist_profile_id: string | null;
  is_active: boolean;
  is_public: boolean;
};

export type AvailabilityRulePayload = Omit<AvailabilityRule, "id">;
export type AvailabilityExceptionPayload = Omit<AvailabilityException, "id">;

export type MyAvailabilityRulePayload = Omit<
  AvailabilityRulePayload,
  "therapist_profile_id"
>;

export type MyAvailabilityExceptionPayload = Omit<
  AvailabilityExceptionPayload,
  "therapist_profile_id"
>;

export async function fetchAvailabilityRules(): Promise<AvailabilityRule[]> {
  return (await apiClient.get("/availability/rules")).data;
}

export async function createAvailabilityRule(payload: AvailabilityRulePayload): Promise<AvailabilityRule> {
  return (await apiClient.post("/availability/rules", payload)).data;
}

export async function updateAvailabilityRule({
  id,
  data,
}: {
  id: string;
  data: Partial<AvailabilityRulePayload>;
}): Promise<AvailabilityRule> {
  return (await apiClient.patch(`/availability/rules/${id}`, data)).data;
}

export async function deleteAvailabilityRule(id: string): Promise<void> {
  await apiClient.delete(`/availability/rules/${id}`);
}

export async function fetchAvailabilityExceptions(): Promise<AvailabilityException[]> {
  return (await apiClient.get("/availability/exceptions")).data;
}

export async function createAvailabilityException(payload: AvailabilityExceptionPayload): Promise<AvailabilityException> {
  return (await apiClient.post("/availability/exceptions", payload)).data;
}

export async function updateAvailabilityException({
  id,
  data,
}: {
  id: string;
  data: Partial<AvailabilityExceptionPayload>;
}): Promise<AvailabilityException> {
  return (await apiClient.patch(`/availability/exceptions/${id}`, data)).data;
}

export async function deleteAvailabilityException(id: string): Promise<void> {
  await apiClient.delete(`/availability/exceptions/${id}`);
}


export async function fetchMyAvailabilityRules(): Promise<AvailabilityRule[]> {
  return (await apiClient.get("/availability/my/rules")).data;
}

export async function createMyAvailabilityRule(
  payload: MyAvailabilityRulePayload,
): Promise<AvailabilityRule> {
  return (await apiClient.post("/availability/my/rules", payload)).data;
}

export async function updateMyAvailabilityRule({
  id,
  data,
}: {
  id: string;
  data: Partial<MyAvailabilityRulePayload>;
}): Promise<AvailabilityRule> {
  return (
    await apiClient.patch(
      `/availability/my/rules/${id}`,
      data,
    )
  ).data;
}

export async function deleteMyAvailabilityRule(
  id: string,
): Promise<void> {
  await apiClient.delete(`/availability/my/rules/${id}`);
}

export async function fetchMyAvailabilityExceptions(): Promise<
  AvailabilityException[]
> {
  return (
    await apiClient.get("/availability/my/exceptions")
  ).data;
}

export async function createMyAvailabilityException(
  payload: MyAvailabilityExceptionPayload,
): Promise<AvailabilityException> {
  return (
    await apiClient.post(
      "/availability/my/exceptions",
      payload,
    )
  ).data;
}

export async function updateMyAvailabilityException({
  id,
  data,
}: {
  id: string;
  data: Partial<MyAvailabilityExceptionPayload>;
}): Promise<AvailabilityException> {
  return (
    await apiClient.patch(
      `/availability/my/exceptions/${id}`,
      data,
    )
  ).data;
}

export async function deleteMyAvailabilityException(
  id: string,
): Promise<void> {
  await apiClient.delete(
    `/availability/my/exceptions/${id}`,
  );
}
