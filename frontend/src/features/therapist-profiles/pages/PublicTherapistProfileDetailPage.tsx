import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { DataState } from "../../../components/data/DataState";
import { fetchPublicTherapistProfile } from "../lib/therapistProfilesApi";

const FALLBACK_PROFILE_IMAGE = "/images/therapist-placeholder.svg";

function therapistBookingHref(
  bookingUrl: string,
  therapistSlug: string,
) {
  const localBase = "https://booking.local";

  try {
    const url = new URL(
      bookingUrl,
      localBase,
    );

    if (url.pathname !== "/book") {
      return bookingUrl;
    }

    url.searchParams.set(
      "therapist",
      therapistSlug,
    );

    if (url.origin === localBase) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.toString();
  } catch {
    return bookingUrl;
  }
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-7 text-slate-700">{value}</p>
    </div>
  );
}

export function PublicTherapistProfileDetailPage() {
  const { slug } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-therapist-profile", slug],
    queryFn: () => fetchPublicTherapistProfile(slug ?? ""),
    enabled: Boolean(slug),
  });

  const showState = isLoading || isError || !data;
  const imageUrl = data?.profile_image_url || FALLBACK_PROFILE_IMAGE;

  const bookingHref =
    data?.booking_cta_url
      ? therapistBookingHref(
          data.booking_cta_url,
          data.slug,
        )
      : null;

  return (
    <main className="bg-slate-50">
      <section className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
        <Link to="/therapists" className="text-sm font-medium text-slate-600 hover:underline">
          ← Back to therapists
        </Link>

        <div className="mt-8">
          {showState ? (
            <DataState isLoading={isLoading} isError={isError} empty={!data} />
          ) : (
            <article className="overflow-hidden rounded-[2rem] border bg-white shadow-sm">
              <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
                <div className="relative min-h-[420px] bg-emerald-50 lg:min-h-[760px]">
                  <img
                    src={imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/45 to-transparent p-8">
                    <p className="max-w-md text-3xl font-bold tracking-tight text-white">
                      {data.full_name}
                    </p>
                    {data.title ? (
                      <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-white/80">
                        {data.title}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="p-8 md:p-12 lg:p-16">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Therapy practice
                  </p>

                  <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                    {data.full_name}
                  </h1>

                  {data.title ? (
                    <p className="mt-4 text-lg font-medium text-slate-600">{data.title}</p>
                  ) : null}

                  {data.short_bio ? (
                    <p className="mt-8 text-xl leading-9 text-slate-700">{data.short_bio}</p>
                  ) : null}

                  <div className="mt-10 grid gap-6 rounded-3xl border bg-slate-50 p-6 md:grid-cols-2">
                    <DetailRow label="Specialties" value={data.specialties} />
                    <DetailRow label="Approaches" value={data.approaches} />
                    <DetailRow label="Languages" value={data.languages} />
                    <DetailRow label="Location" value={data.location} />
                    <DetailRow label="Sessions" value={data.session_formats} />
                  </div>

                  {data.bio ? (
                    <div className="mt-10 whitespace-pre-line text-base leading-8 text-slate-700">
                      {data.bio}
                    </div>
                  ) : null}

                  <div className="mt-10 flex flex-wrap gap-4">
                    {bookingHref ? (
                      <a
                        href={bookingHref}
                        className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
                      >
                        {data.booking_cta_label || "Book a session"}
                      </a>
                    ) : null}

                    <Link
                      to="/contact"
                      className="rounded-2xl border bg-white px-6 py-3 text-sm font-semibold text-slate-800"
                    >
                      Ask a question
                    </Link>
                  </div>

                  <p className="mt-10 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-200">
                    This profile is for general information only. Therapy, assessment, booking,
                    consent, and crisis-support workflows are handled through separate practice processes.
                  </p>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
