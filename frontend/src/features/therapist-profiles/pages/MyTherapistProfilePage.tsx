import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Check,
  Clock3,
  Eye,
  Send,
} from "lucide-react";

import { useAuth } from "../../auth/context/AuthContext";
import {
  ProfileAvatar,
  StatusPill,
  SurfaceCard,
  WorkflowNotice,
} from "../components/ProfileWorkflowUI";
import {
  createMyTherapistProfile,
  fetchMyTherapistProfile,
  submitMyTherapistProfile,
  updateMyTherapistProfile,
  type TherapistProfileRevision,
} from "../lib/therapistProfilesApi";

type FormValues = {
  full_name: string;
  title: string;
  short_bio: string;
  bio: string;
  specialties: string;
  approaches: string;
  languages: string;
  location: string;
  session_formats: string;
  profile_image_url: string;
};

const emptyForm: FormValues = {
  full_name: "",
  title: "",
  short_bio: "",
  bio: "",
  specialties: "",
  approaches: "",
  languages: "",
  location: "",
  session_formats: "",
  profile_image_url: "",
};

function formFromProfile(
  profile:
    | Partial<Record<keyof FormValues, string | null>>
    | null
    | undefined,
): FormValues {
  if (!profile) return emptyForm;

  return {
    full_name: profile.full_name || "",
    title: profile.title || "",
    short_bio: profile.short_bio || "",
    bio: profile.bio || "",
    specialties: profile.specialties || "",
    approaches: profile.approaches || "",
    languages: profile.languages || "",
    location: profile.location || "",
    session_formats: profile.session_formats || "",
    profile_image_url: profile.profile_image_url || "",
  };
}

function splitTags(value?: string | null) {
  return (value || "")
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function statusLabel(
  revision: TherapistProfileRevision | null | undefined,
  isPublished: boolean,
) {
  if (!revision) {
    return isPublished ? "Published" : "Not started";
  }

  const labels = {
    draft: "Draft",
    pending_review: "In review",
    changes_requested: "Changes requested",
    approved: "Approved",
  };

  return labels[revision.review_status];
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-app-ink">
        {label}
      </span>
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-app-border bg-white px-4 py-3 text-sm text-app-ink outline-none transition placeholder:text-[#98a08e] focus:border-app-accent focus:ring-2 focus:ring-[#edf2e7] disabled:cursor-not-allowed disabled:bg-app-tint disabled:text-app-muted"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  hint?: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm font-semibold text-app-ink">
          {label}
        </span>
        {hint ? (
          <span className="text-xs text-app-muted">
            {hint}
          </span>
        ) : null}
      </span>

      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-2xl border border-app-border bg-white px-4 py-3 text-sm leading-6 text-app-ink outline-none transition focus:border-app-accent focus:ring-2 focus:ring-[#edf2e7] disabled:cursor-not-allowed disabled:bg-app-tint disabled:text-app-muted"
      />
    </label>
  );
}

export function MyTherapistProfilePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState<FormValues>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["therapist-profile", "me"],
    queryFn: fetchMyTherapistProfile,
  });

  const profile = profileQuery.data;
  const working = profile?.working_revision;
  const published = profile?.published_profile;

  useEffect(() => {
    if (profileQuery.isLoading) return;

    const source = working || published;

    if (source) {
      setForm(formFromProfile(source));
      return;
    }

    setForm({
      ...emptyForm,
      full_name: user?.full_name || "",
    });
  }, [
    profileQuery.isLoading,
    profile,
    working,
    published,
    user?.full_name,
  ]);

  const editable =
    !working ||
    working.review_status === "draft" ||
    working.review_status === "changes_requested";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile) {
        return createMyTherapistProfile(form);
      }

      return updateMyTherapistProfile(form);
    },
    onSuccess: (nextProfile) => {
      queryClient.setQueryData(
        ["therapist-profile", "me"],
        nextProfile,
      );
      setMessage(
        profile
          ? "Your draft has been saved."
          : "Your professional profile has been created.",
      );
    },
    onError: () => {
      setMessage(
        "We could not save your profile. Please review the details and try again.",
      );
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await updateMyTherapistProfile(form);
      return submitMyTherapistProfile();
    },
    onSuccess: (nextProfile) => {
      queryClient.setQueryData(
        ["therapist-profile", "me"],
        nextProfile,
      );
      setMessage(
        "Your profile has been sent to the practice for review.",
      );
    },
    onError: () => {
      setMessage(
        "We could not save and submit your profile for review. Your profile remains editable.",
      );
    },
  });

  function updateField(
    key: keyof FormValues,
    value: string,
  ) {
    setMessage(null);
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const canSubmit =
    Boolean(working) &&
    (working?.review_status === "draft" ||
      working?.review_status === "changes_requested");

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-[60vh] rounded-[2.5rem] bg-app-canvas p-8">
        <p className="text-sm text-app-muted">
          Loading your profile…
        </p>
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <WorkflowNotice
        eyebrow="My profile"
        title="We could not load your professional profile."
      >
        Refresh the page and try again.
      </WorkflowNotice>
    );
  }

  return (
    <div className="-m-4 min-h-screen bg-app-canvas p-4 md:-m-8 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-app-border pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-app-accent">
              Professional profile
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight text-app-ink md:text-5xl">
              My Profile
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-app-muted md:text-base">
              Keep the professional information clients see about
              you thoughtful, current, and true to your practice.
            </p>
          </div>

          <StatusPill
            tone={
              working?.review_status === "changes_requested"
                ? "attention"
                : profile?.is_published
                  ? "active"
                  : "quiet"
            }
          >
            {statusLabel(
              working,
              Boolean(profile?.is_published),
            )}
          </StatusPill>
        </header>

        <div className="mt-8 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-app-accent">
                Current public profile
              </p>
              <p className="mt-2 text-sm leading-6 text-app-muted">
                This is the version clients can currently see.
              </p>
            </div>

            {published ? (
              <SurfaceCard className="overflow-hidden p-5">
                <ProfileAvatar
                  name={published.full_name}
                  src={published.profile_image_url}
                  className="w-full"
                />

                <div className="px-1 pb-2 pt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-app-accent">
                    {published.title || "Therapist"}
                  </p>

                  <h3 className="mt-2 font-display text-3xl leading-tight text-app-ink">
                    {published.full_name}
                  </h3>

                  {published.location ||
                  published.session_formats ? (
                    <p className="mt-3 text-sm text-app-muted">
                      {[
                        published.location,
                        published.session_formats,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}

                  {published.short_bio ? (
                    <p className="mt-5 text-sm leading-7 text-app-muted">
                      {published.short_bio}
                    </p>
                  ) : null}

                  {splitTags(published.specialties).length ? (
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-app-border pt-5">
                      {splitTags(published.specialties).map(
                        (item) => (
                          <span
                            key={item}
                            className="rounded-full bg-app-tint px-3 py-1.5 text-xs font-medium text-app-muted"
                          >
                            {item}
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}

                  <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-app-accent">
                    <Eye className="h-4 w-4" />
                    Live on your public profile
                  </div>
                </div>
              </SurfaceCard>
            ) : (
              <SurfaceCard className="p-7">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-app-soft text-app-accent">
                  <Eye className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-2xl text-app-ink">
                  Nothing is public yet.
                </h3>
                <p className="mt-3 text-sm leading-7 text-app-muted">
                  Complete your professional profile and send it
                  for review. Your current draft stays private
                  until the practice approves and publishes it.
                </p>
              </SurfaceCard>
            )}

            {working?.review_status === "draft" ? (
              <WorkflowNotice
                eyebrow="Draft saved"
                title="Your private changes are in progress."
              >
                Continue editing your saved draft when you are ready.
                Nothing in this version is visible to clients until
                it has been reviewed, approved, and published.
              </WorkflowNotice>
            ) : null}

            {working?.review_status === "changes_requested" ? (
              <WorkflowNotice
                eyebrow="Practice feedback"
                title="A few changes have been requested."
              >
                <p>
                  {working.review_notes ||
                    "Review the requested changes, update your profile, and submit it again when ready."}
                </p>
              </WorkflowNotice>
            ) : null}

            {working?.review_status === "pending_review" ? (
              <WorkflowNotice
                eyebrow="In review"
                title="Your profile is with the practice."
              >
                You can continue using your current published
                profile while this version is being reviewed.
              </WorkflowNotice>
            ) : null}

            {working?.review_status === "approved" ? (
              <WorkflowNotice
                eyebrow="Approved"
                title="Your update is ready for publication."
              >
                The Practice Admin has approved this version.
                It will become public when they publish it.
              </WorkflowNotice>
            ) : null}
          </div>

          <SurfaceCard className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-app-border pb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-app-accent">
                  Working version
                </p>
                <h3 className="mt-2 font-display text-3xl text-app-ink">
                  {profile
                    ? "Professional details"
                    : "Create your profile"}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-app-muted">
                  {editable
                    ? "Shape how your professional experience and approach are presented to clients."
                    : "This version is locked while it moves through the review workflow."}
                </p>
              </div>

              {working ? (
                <StatusPill
                  tone={
                    working.review_status ===
                    "changes_requested"
                      ? "attention"
                      : "quiet"
                  }
                >
                  v{working.version_number} ·{" "}
                  {statusLabel(
                    working,
                    Boolean(profile?.is_published),
                  )}
                </StatusPill>
              ) : null}
            </div>

            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <Field
                label="Full name"
                value={form.full_name}
                disabled={!editable}
                onChange={(value) =>
                  updateField("full_name", value)
                }
              />

              <Field
                label="Professional title"
                value={form.title}
                disabled={!editable}
                placeholder="Clinical Psychologist"
                onChange={(value) =>
                  updateField("title", value)
                }
              />

              <Field
                label="Location"
                value={form.location}
                disabled={!editable}
                placeholder="Nairobi"
                onChange={(value) =>
                  updateField("location", value)
                }
              />

              <Field
                label="Session formats"
                value={form.session_formats}
                disabled={!editable}
                placeholder="Online, In-person"
                onChange={(value) =>
                  updateField("session_formats", value)
                }
              />

              <Field
                label="Languages"
                value={form.languages}
                disabled={!editable}
                placeholder="English, Kiswahili"
                onChange={(value) =>
                  updateField("languages", value)
                }
              />

              <Field
                label="Profile image URL"
                value={form.profile_image_url}
                disabled={!editable}
                placeholder="/images/profile.jpg"
                onChange={(value) =>
                  updateField("profile_image_url", value)
                }
              />
            </div>

            <div className="mt-5 space-y-5">
              <TextField
                label="Short introduction"
                value={form.short_bio}
                disabled={!editable}
                rows={3}
                hint="Shown on profile cards"
                onChange={(value) =>
                  updateField("short_bio", value)
                }
              />

              <TextField
                label="Areas of support"
                value={form.specialties}
                disabled={!editable}
                rows={3}
                hint="Separate with commas"
                onChange={(value) =>
                  updateField("specialties", value)
                }
              />

              <TextField
                label="Therapeutic approaches"
                value={form.approaches}
                disabled={!editable}
                rows={3}
                hint="Separate with commas"
                onChange={(value) =>
                  updateField("approaches", value)
                }
              />

              <TextField
                label="Professional biography"
                value={form.bio}
                disabled={!editable}
                rows={7}
                onChange={(value) =>
                  updateField("bio", value)
                }
              />
            </div>

            {message ? (
              <div className="mt-6 rounded-2xl bg-app-soft px-4 py-3 text-sm leading-6 text-app-muted">
                {message}
              </div>
            ) : null}

            {editable ? (
              <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-app-border pt-6">
                <button
                  type="button"
                  disabled={
                    saveMutation.isPending ||
                    !form.full_name.trim()
                  }
                  onClick={() => saveMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-full border border-app-border bg-white px-5 py-3 text-sm font-semibold text-app-ink transition hover:bg-app-tint disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saveMutation.isPending
                    ? "Saving…"
                    : profile
                      ? "Save draft"
                      : "Create my profile"}
                </button>

                {canSubmit ? (
                  <button
                    type="button"
                    disabled={
                      saveMutation.isPending ||
                      submitMutation.isPending ||
                      !form.full_name.trim()
                    }
                    onClick={() =>
                      submitMutation.mutate()
                    }
                    className="inline-flex items-center gap-2 rounded-full bg-app-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-app-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitMutation.isPending ? (
                      <Clock3 className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {working?.review_status ===
                    "changes_requested"
                      ? "Resubmit for review"
                      : "Submit for review"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-7 flex items-center gap-3 border-t border-app-border pt-6 text-sm text-app-muted">
                <Clock3 className="h-4 w-4 text-app-accent" />
                Editing will reopen when this workflow
                requires your input.
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
