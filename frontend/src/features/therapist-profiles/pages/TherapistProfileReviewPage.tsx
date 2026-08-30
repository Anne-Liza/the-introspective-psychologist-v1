import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Button } from "../../../components/ui/Button";
import { DataState } from "../../../components/data/DataState";
import { Input } from "../../../components/ui/Input";
import {
  fetchTherapistProfileRevision,
  reviewTherapistProfileRevision,
  updateTherapistProfileRevision,
} from "../lib/therapistProfilesApi";

export function TherapistProfileReviewPage() {
  const { revisionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [approaches, setApproaches] = useState("");
  const [languages, setLanguages] = useState("");
  const [location, setLocation] = useState("");
  const [sessionFormats, setSessionFormats] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const reviewQuery = useQuery({
    queryKey: ["therapist-profile-review", revisionId],
    queryFn: () => fetchTherapistProfileRevision(revisionId ?? ""),
    enabled: Boolean(revisionId),
  });

  useEffect(() => {
    const revision = reviewQuery.data?.revision;
    if (!revision) return;

    setFullName(revision.full_name);
    setTitle(revision.title ?? "");
    setShortBio(revision.short_bio ?? "");
    setBio(revision.bio ?? "");
    setSpecialties(revision.specialties ?? "");
    setApproaches(revision.approaches ?? "");
    setLanguages(revision.languages ?? "");
    setLocation(revision.location ?? "");
    setSessionFormats(revision.session_formats ?? "");
    setProfileImageUrl(revision.profile_image_url ?? "");
    setReviewNotes(revision.review_notes ?? "");
  }, [reviewQuery.data]);

  function refreshQueues() {
    void queryClient.invalidateQueries({
      queryKey: ["therapist-profile-review-queue"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["therapist-profile-publication-queue"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["therapist-profiles"],
    });
  }

  const updateMutation = useMutation({
    mutationFn: updateTherapistProfileRevision,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["therapist-profile-review", revisionId],
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      decision,
      notes,
    }: {
      decision: "changes_requested" | "approved";
      notes?: string;
    }) => {
      if (!revisionId) {
        throw new Error("Missing therapist profile revision.");
      }

      await updateTherapistProfileRevision({
        revisionId,
        data: {
          full_name: fullName,
          title,
          short_bio: shortBio,
          bio,
          specialties,
          approaches,
          languages,
          location,
          session_formats: sessionFormats,
          profile_image_url: profileImageUrl,
        },
      });

      return reviewTherapistProfileRevision({
        revisionId,
        decision,
        notes,
      });
    },
    onSuccess: () => {
      refreshQueues();
      navigate("/dashboard/therapist-profiles");
    },
  });

  function saveSubmission(event: FormEvent) {
    event.preventDefault();
    if (!revisionId) return;

    updateMutation.mutate({
      revisionId,
      data: {
        full_name: fullName,
        title,
        short_bio: shortBio,
        bio,
        specialties,
        approaches,
        languages,
        location,
        session_formats: sessionFormats,
        profile_image_url: profileImageUrl,
      },
    });
  }

  function requestChanges() {
    if (!revisionId || !reviewNotes.trim()) return;

    reviewMutation.mutate({
      decision: "changes_requested",
      notes: reviewNotes.trim(),
    });
  }

  function approve() {
    if (!revisionId) return;

    reviewMutation.mutate({
      decision: "approved",
      notes: reviewNotes.trim() || undefined,
    });
  }

  if (
    reviewQuery.isLoading ||
    reviewQuery.isError ||
    !reviewQuery.data
  ) {
    return (
      <DataState
        isLoading={reviewQuery.isLoading}
        isError={reviewQuery.isError}
        empty={!reviewQuery.data}
      />
    );
  }

  const revision = reviewQuery.data.revision;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/therapist-profiles"
          className="text-sm font-medium text-[#667064] hover:underline"
        >
          ← Back to therapist profiles
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[#718064]">
          Profile review
        </p>

        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#253026]">
          Review {revision.full_name}
        </h2>

        <p className="mt-2 text-[#667064]">
          Version {revision.version_number} · Submitted for review
        </p>
      </div>

      <form
        onSubmit={saveSubmission}
        className="space-y-5 rounded-3xl border border-[#dfe3d4] bg-white p-6 shadow-sm"
      >
        <div>
          <h3 className="text-xl font-semibold text-[#253026]">
            Submitted profile
          </h3>
          <p className="mt-1 text-sm text-[#667064]">
            Review the therapist's submitted information. You may correct
            minor editorial issues before making a decision.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />

          <Input
            label="Professional title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <Input
            label="Languages"
            value={languages}
            onChange={(event) => setLanguages(event.target.value)}
          />

          <Input
            label="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
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
        </div>

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
            rows={8}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save editorial changes"}
        </Button>

        {updateMutation.isSuccess ? (
          <p className="text-sm text-[#45623b]">
            Submission changes saved.
          </p>
        ) : null}

        {updateMutation.isError ? (
          <p className="text-sm text-red-600">
            The submitted profile could not be updated.
          </p>
        ) : null}
      </form>

      <section className="rounded-3xl border border-[#dfe3d4] bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-[#253026]">
          Review decision
        </h3>

        <p className="mt-1 text-sm leading-6 text-[#667064]">
          Add notes for the therapist when requesting changes. Approval moves
          the profile to the publication queue; it does not publish it yet.
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Review notes
          </label>

          <textarea
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            rows={5}
            placeholder="Explain any requested changes, or leave an optional approval note."
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={
              reviewMutation.isPending || !reviewNotes.trim()
            }
            onClick={requestChanges}
          >
            Request changes
          </Button>

          <Button
            type="button"
            disabled={reviewMutation.isPending}
            onClick={approve}
          >
            {reviewMutation.isPending
              ? "Saving decision..."
              : "Approve profile"}
          </Button>
        </div>

        {reviewMutation.isError ? (
          <p className="mt-4 text-sm text-red-600">
            The review decision could not be saved.
          </p>
        ) : null}
      </section>
    </div>
  );
}
