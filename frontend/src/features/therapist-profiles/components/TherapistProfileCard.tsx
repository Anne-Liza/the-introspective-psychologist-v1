import { Link } from "react-router";

import {
  resolveTherapistProfileImageUrl,
  type TherapistProfile,
} from "../lib/therapistProfilesApi";

const FALLBACK_PROFILE_IMAGE = "/images/therapist-placeholder.svg";

export function TherapistProfileCard({ profile }: { profile: TherapistProfile }) {
  const imageUrl =
    resolveTherapistProfileImageUrl(
      profile.profile_image_url,
    ) ?? FALLBACK_PROFILE_IMAGE;
  const focusAreas = (profile.specialties || profile.approaches || "")
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <article data-ui-contract="public.therapists.card" className="group flex h-full flex-col rounded-[2rem] border border-[#dce3d3] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <img
        src={imageUrl}
        alt=""
        className="mb-6 aspect-[4/3] w-full rounded-[1.5rem] object-cover"
      />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7f52]">
        {profile.title || "Therapist"}
      </p>

      <h2 className="mt-2 font-serif text-3xl text-[#26311f]">{profile.full_name}</h2>

      {profile.short_bio ? (
        <p className="mt-4 text-sm leading-7 text-[#59654d]">{profile.short_bio}</p>
      ) : null}

      {focusAreas.length ? (
        <div className="mt-5 border-t border-[#e4e9dd] pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#83906f]">Areas of support</p>
          <p className="mt-2 text-sm leading-6 text-[#4f5f43]">{focusAreas.join(" · ")}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#59654d]">
        {profile.location ? <span className="rounded-full bg-[#f0f3eb] px-3 py-1">{profile.location}</span> : null}
        {profile.session_formats ? <span className="rounded-full bg-[#f0f3eb] px-3 py-1">{profile.session_formats}</span> : null}
        {profile.languages ? <span className="rounded-full bg-[#f0f3eb] px-3 py-1">{profile.languages}</span> : null}
      </div>

      <Link
        to={`/therapists/${profile.slug}`}
        className="mt-auto inline-flex w-fit rounded-full bg-[#26311f] px-6 py-3 text-sm font-semibold text-white transition group-hover:bg-[#556b2f]"
      >
        View profile
      </Link>
    </article>
  );
}
