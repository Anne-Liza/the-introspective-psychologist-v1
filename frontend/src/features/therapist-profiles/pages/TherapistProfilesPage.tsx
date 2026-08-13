import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { DataState } from "../../../components/data/DataState";
import { useAuth } from "../../auth/context/AuthContext";
import { TherapistAccountLinkPanel } from "../components/TherapistAccountLinkPanel";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  TherapistProfile,
  TherapistProfileCreatePayload,
  TherapistProfileUpdatePayload,
  createTherapistProfile,
  deleteTherapistProfile,
  fetchTherapistProfilePublicationQueue,
  fetchTherapistProfiles,
  publishTherapistProfileRevision,
  slugify,
  startTherapistProfileRevision,
  unpublishTherapistProfile,
  updateTherapistProfile,
} from "../lib/therapistProfilesApi";

export function TherapistProfilesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const canManageAccounts = hasPermission(
    "therapist_profiles.update"
  );
  const canReviewProfiles = hasPermission(
    "therapist_profiles.review"
  );
  const canPublishProfiles = hasPermission(
    "therapist_profiles.publish"
  );

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [approaches, setApproaches] = useState("");
  const [languages, setLanguages] = useState("");
  const [location, setLocation] = useState("");
  const [sessionFormats, setSessionFormats] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [bookingCtaLabel, setBookingCtaLabel] = useState("Book a session");
  const [bookingCtaUrl, setBookingCtaUrl] = useState("/contact");
  const [sortOrder, setSortOrder] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["therapist-profiles"],
    queryFn: fetchTherapistProfiles,
  });

  const {
    data: publicationQueue = [],
  } = useQuery({
    queryKey: ["therapist-profile-publication-queue"],
    queryFn: fetchTherapistProfilePublicationQueue,
    enabled: canPublishProfiles,
  });

  function publicationActionFor(profileId: string) {
    return (
      publicationQueue.find(
        (item) =>
          item.profile_id === profileId &&
          !item.revision.is_current_publication,
      ) ??
      publicationQueue.find(
        (item) => item.profile_id === profileId,
      )
    );
  }

  function resetForm() {
    setEditingProfileId(null);
    setFullName("");
    setSlug("");
    setTitle("");
    setShortBio("");
    setBio("");
    setSpecialties("");
    setApproaches("");
    setLanguages("");
    setLocation("");
    setSessionFormats("");
    setProfileImageUrl("");
    setBookingCtaLabel("Book a session");
    setBookingCtaUrl("/contact");
    setSortOrder(0);
  }

  function loadProfileForEdit(profile: TherapistProfile) {
    setEditingProfileId(profile.id);
    setFullName(profile.full_name);
    setSlug(profile.slug);
    setTitle(profile.title ?? "");
    setShortBio(profile.short_bio ?? "");
    setBio(profile.bio ?? "");
    setSpecialties(profile.specialties ?? "");
    setApproaches(profile.approaches ?? "");
    setLanguages(profile.languages ?? "");
    setLocation(profile.location ?? "");
    setSessionFormats(profile.session_formats ?? "");
    setProfileImageUrl(profile.profile_image_url ?? "");
    setBookingCtaLabel(profile.booking_cta_label ?? "Book a session");
    setBookingCtaUrl(profile.booking_cta_url ?? "/contact");
    setSortOrder(profile.sort_order ?? 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const createMutation = useMutation({
    mutationFn: createTherapistProfile,
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["therapist-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["public-therapist-profiles"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateTherapistProfile,
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["therapist-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["public-therapist-profiles"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTherapistProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapist-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["public-therapist-profiles"] });
    },
  });

  const startRevisionMutation = useMutation({
    mutationFn: startTherapistProfileRevision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapist-profiles"] });
      queryClient.invalidateQueries({
        queryKey: ["therapist-profile-review-queue"],
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishTherapistProfileRevision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapist-profiles"] });
      queryClient.invalidateQueries({
        queryKey: ["therapist-profile-publication-queue"],
      });
      queryClient.invalidateQueries({
        queryKey: ["public-therapist-profiles"],
      });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: unpublishTherapistProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapist-profiles"] });
      queryClient.invalidateQueries({
        queryKey: ["therapist-profile-publication-queue"],
      });
      queryClient.invalidateQueries({
        queryKey: ["public-therapist-profiles"],
      });
    },
  });

  function handleNameChange(value: string) {
    setFullName(value);
    if (!slug) setSlug(slugify(value));
  }

  function buildCreatePayload(): TherapistProfileCreatePayload {
    return {
      full_name: fullName,
      slug: slugify(slug || fullName),
      title,
      short_bio: shortBio,
      bio,
      specialties,
      approaches,
      languages,
      location,
      session_formats: sessionFormats,
      profile_image_url: profileImageUrl,
      booking_cta_label: bookingCtaLabel,
      booking_cta_url: bookingCtaUrl,
      sort_order: sortOrder,
    };
  }

  function buildUpdatePayload(): TherapistProfileUpdatePayload {
    return {
      slug: slugify(slug),
      booking_cta_label: bookingCtaLabel,
      booking_cta_url: bookingCtaUrl,
      sort_order: sortOrder,
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (editingProfileId) {
      updateMutation.mutate({
        id: editingProfileId,
        data: buildUpdatePayload(),
      });
      return;
    }

    createMutation.mutate(buildCreatePayload());
  }

  const showState = isLoading || isError || !data?.length;
  const formIsSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Therapy practice</p>
        <h2 className="text-3xl font-bold">Therapist Profiles</h2>
        <p className="mt-2 text-slate-600">
          Create therapist profiles, manage profile settings, review content changes, and control publication.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              {editingProfileId ? "Edit profile settings" : "Create therapist profile"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {editingProfileId
  ? "Settings changes apply directly. Professional content changes use the reviewed revision workflow."
  : "New profiles enter review before they can be published. Do not store client notes, intake details, or assessment results here."}
            </p>
          </div>

          {editingProfileId ? (
            <Button type="button" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {!editingProfileId ? (
            <>
              <Input
                label="Full name"
                value={fullName}
                onChange={(event) => handleNameChange(event.target.value)}
                required
              />
              <Input
                label="Professional title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Input
                label="Location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <Input
                label="Languages"
                value={languages}
                onChange={(event) => setLanguages(event.target.value)}
              />
              <Input
                label="Session formats"
                value={sessionFormats}
                onChange={(event) => setSessionFormats(event.target.value)}
              />
              <Input
                label="Profile image URL"
                value={profileImageUrl}
                onChange={(event) => setProfileImageUrl(event.target.value)}
              />
            </>
          ) : null}

          <Input
            label="Slug"
            value={slug}
            onChange={(event) => setSlug(slugify(event.target.value))}
            required
          />
          <Input
            label="Booking CTA label"
            value={bookingCtaLabel}
            onChange={(event) => setBookingCtaLabel(event.target.value)}
          />
          <Input
            label="Booking CTA URL"
            value={bookingCtaUrl}
            onChange={(event) => setBookingCtaUrl(event.target.value)}
          />
          <Input
            label="Sort order"
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(Number(event.target.value))}
          />
        </div>

        {!editingProfileId ? (
          <div className="mt-4 grid gap-4">
            <Input
              label="Short bio"
              value={shortBio}
              onChange={(event) => setShortBio(event.target.value)}
            />
            <Input
              label="Specialties"
              value={specialties}
              onChange={(event) => setSpecialties(event.target.value)}
            />
            <Input
              label="Approaches"
              value={approaches}
              onChange={(event) => setApproaches(event.target.value)}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Long bio
              </label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
            Professional details such as name, title, bio, specialties, approaches,
            languages, location, session formats, and profile image are versioned.
            Use <strong>Start content revision</strong> below to change them.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit" disabled={formIsSaving}>
            {formIsSaving ? "Saving..." : editingProfileId ? "Save changes" : "Create therapist profile"}
          </Button>
        </div>

        {createMutation.isError || updateMutation.isError ? (
          <p className="mt-3 text-sm text-red-600">Therapist profile save failed. Check required fields and try again.</p>
        ) : null}
      </form>

      <TherapistAccountLinkPanel
        profiles={data ?? []}
        canManage={canManageAccounts}
      />

      {showState ? (
        <DataState isLoading={isLoading} isError={isError} empty={!data?.length} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Therapist</th>
                <th className="p-4">Practice details</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((profile) => (
                <tr key={profile.id} className="border-t align-top">
                  <td className="p-4">
                    <div className="font-medium">{profile.full_name}</div>
                    <div className="text-slate-500">/{profile.slug}</div>
                    {profile.title ? <div className="mt-1 text-slate-600">{profile.title}</div> : null}
                    {profile.short_bio ? <div className="mt-1 text-slate-600">{profile.short_bio}</div> : null}
                  </td>
                  <td className="p-4">
                    <div>{profile.specialties || "—"}</div>
                    <div className="text-slate-500">{profile.approaches || ""}</div>
                    <div className="text-slate-500">{profile.session_formats || ""}</div>
                  </td>
                  <td className="p-4">
                    <div>
                      {profile.is_published
                        ? "Published"
                        : "Not published"}
                    </div>

                    {publicationActionFor(profile.id) ? (
                      <div className="mt-1 text-slate-500">
                        {publicationActionFor(profile.id)!
                          .revision.is_current_publication
                          ? "Current version is hidden"
                          : "Approved update ready to publish"}
                      </div>
                    ) : null}

                    <div className="text-slate-500">
                      Order: {profile.sort_order}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => loadProfileForEdit(profile)}
                      >
                        Edit settings
                      </Button>

                      {canReviewProfiles ? (
                        <Button
                          type="button"
                          onClick={() =>
                            startRevisionMutation.mutate(profile.id)
                          }
                          disabled={startRevisionMutation.isPending}
                        >
                          Start content revision
                        </Button>
                      ) : null}

                      {canPublishProfiles &&
                      publicationActionFor(profile.id) ? (
                        <Button
                          type="button"
                          onClick={() =>
                            publishMutation.mutate(
                              publicationActionFor(profile.id)!.revision.id,
                            )
                          }
                          disabled={publishMutation.isPending}
                        >
                          {publicationActionFor(profile.id)!
                            .revision.is_current_publication
                            ? "Republish"
                            : "Publish approved version"}
                        </Button>
                      ) : null}

                      {canPublishProfiles && profile.is_published ? (
                        <Button
                          type="button"
                          onClick={() =>
                            unpublishMutation.mutate(profile.id)
                          }
                          disabled={unpublishMutation.isPending}
                        >
                          Unpublish
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        onClick={() =>
                          deleteMutation.mutate(profile.id)
                        }
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
