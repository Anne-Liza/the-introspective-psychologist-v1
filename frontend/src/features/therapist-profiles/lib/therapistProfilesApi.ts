import { isAxiosError } from "axios";
import { apiClient } from "../../../lib/api-client";

export type TherapistProfile = {
  id: string;
  user_id?: string | null;
  full_name: string;
  slug: string;
  title: string | null;
  short_bio: string | null;
  bio: string | null;
  specialties: string | null;
  approaches: string | null;
  languages: string | null;
  location: string | null;
  session_formats: string | null;
  profile_image_url: string | null;
  booking_cta_label: string | null;
  booking_cta_url: string | null;
  sort_order: number;
  is_published: boolean;
};



export type TherapistAccountOption = {
  id: string;
  email: string;
  full_name: string | null;
  linked_profile_id: string | null;
};

export type TherapistProfileRevision = {
  id: string;
  therapist_profile_id: string;
  version_number: number;
  full_name: string;
  title: string | null;
  short_bio: string | null;
  bio: string | null;
  specialties: string | null;
  approaches: string | null;
  languages: string | null;
  location: string | null;
  session_formats: string | null;
  profile_image_url: string | null;
  review_status:
    | "draft"
    | "pending_review"
    | "changes_requested"
    | "approved";
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  is_current_publication: boolean;
  published_at: string | null;
};

export type TherapistProfileAdminReview = {
  profile_id: string;
  slug: string;
  is_published: boolean;
  published_profile: TherapistProfile | null;
  revision: TherapistProfileRevision;
};

export type TherapistProfileSelf = {
  id: string;
  slug: string;
  is_published: boolean;
  published_profile: TherapistProfile | null;
  working_revision: TherapistProfileRevision | null;
};

export type TherapistProfileSelfCreatePayload = {
  full_name: string;
  title?: string;
  short_bio?: string;
  bio?: string;
  specialties?: string;
  approaches?: string;
  languages?: string;
  location?: string;
  session_formats?: string;
  profile_image_url?: string;
};

export type TherapistProfileSelfUpdatePayload =
  Partial<TherapistProfileSelfCreatePayload>;

export type TherapistProfileCreatePayload = {
  full_name: string;
  slug: string;
  title?: string;
  short_bio?: string;
  bio?: string;
  specialties?: string;
  approaches?: string;
  languages?: string;
  location?: string;
  session_formats?: string;
  profile_image_url?: string;
  booking_cta_label?: string;
  booking_cta_url?: string;
  sort_order: number;
};

export type TherapistProfileUpdatePayload = {
  slug?: string;
  booking_cta_label?: string;
  booking_cta_url?: string;
  sort_order?: number;
};


export async function fetchTherapistProfiles() {
  const response = await apiClient.get<TherapistProfile[]>("/therapist-profiles");
  return response.data;
}

export async function fetchPublicTherapistProfiles() {
  const response = await apiClient.get<TherapistProfile[]>("/therapist-profiles/public");
  return response.data;
}

export async function fetchPublicTherapistProfile(slug: string) {
  const response = await apiClient.get<TherapistProfile>(`/therapist-profiles/public/${slug}`);
  return response.data;
}

export async function createTherapistProfile(payload: TherapistProfileCreatePayload) {
  const response = await apiClient.post<TherapistProfile>("/therapist-profiles", payload);
  return response.data;
}

export async function updateTherapistProfile(payload: { id: string; data: TherapistProfileUpdatePayload }) {
  const response = await apiClient.patch<TherapistProfile>(`/therapist-profiles/${payload.id}`, payload.data);
  return response.data;
}

export async function deleteTherapistProfile(id: string) {
  await apiClient.delete(`/therapist-profiles/${id}`);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}


export async function fetchTherapistAccountOptions() {
  const response = await apiClient.get<
    TherapistAccountOption[]
  >("/therapist-profiles/account-options");

  return response.data;
}

export async function linkTherapistProfileAccount({
  profileId,
  userId,
}: {
  profileId: string;
  userId: string | null;
}) {
  const response = await apiClient.patch<
    TherapistProfile
  >(
    `/therapist-profiles/${profileId}/account`,
    {
      user_id: userId,
    },
  );

  return response.data;
}

export async function fetchTherapistProfilePublicationQueue() {
  const response = await apiClient.get<TherapistProfileAdminReview[]>(
    "/therapist-profiles/publication-queue",
  );
  return response.data;
}

export async function startTherapistProfileRevision(profileId: string) {
  const response = await apiClient.post<TherapistProfileAdminReview>(
    `/therapist-profiles/${profileId}/revisions`,
  );
  return response.data;
}

export async function publishTherapistProfileRevision(
  revisionId: string,
) {
  const response = await apiClient.post<TherapistProfileAdminReview>(
    `/therapist-profiles/revisions/${revisionId}/publish`,
  );
  return response.data;
}

export async function unpublishTherapistProfile(profileId: string) {
  const response = await apiClient.post<TherapistProfile>(
    `/therapist-profiles/${profileId}/unpublish`,
  );
  return response.data;
}


export async function fetchMyTherapistProfile() {
  try {
    const response = await apiClient.get<TherapistProfileSelf>(
      "/therapist-profiles/me",
    );
    return response.data;
  } catch (error) {
    if (
      isAxiosError(error) &&
      error.response?.status === 404
    ) {
      return null;
    }
    throw error;
  }
}

export async function createMyTherapistProfile(
  payload: TherapistProfileSelfCreatePayload,
) {
  const response = await apiClient.post<TherapistProfileSelf>(
    "/therapist-profiles/me",
    payload,
  );
  return response.data;
}

export async function updateMyTherapistProfile(
  payload: TherapistProfileSelfUpdatePayload,
) {
  const response = await apiClient.patch<TherapistProfileSelf>(
    "/therapist-profiles/me",
    payload,
  );
  return response.data;
}

export async function submitMyTherapistProfile() {
  const response = await apiClient.post<TherapistProfileSelf>(
    "/therapist-profiles/me/submit",
  );
  return response.data;
}
