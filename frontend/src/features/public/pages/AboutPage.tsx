import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";

import { fetchPublicServices } from "../../services/lib/servicesApi";
import {
  fetchPublicTherapistProfiles,
  resolveTherapistProfileImageUrl,
} from "../../therapist-profiles/lib/therapistProfilesApi";
import {
  fetchPublicSections,
  findSection,
  resolveLandingSectionImageUrl,
  splitPublicList,
  type LandingSection,
} from "../lib/publicContent";

const fallbackSections: LandingSection[] = [
  {
    id: "about-hero",
    key: "about.hero",
    eyebrow: "Our practice",
    title: "Thoughtful therapy, held by a collaborative team.",
    body: "A multi-therapist practice offering grounded support for people seeking reflection, emotional safety, and practical change.",
    cta_label: null,
    cta_url: null,
    image_url: "/demo/practice/practice-room.svg",
  },
  {
    id: "about-profile",
    key: "about.profile",
    eyebrow: "How we work",
    title: "Care begins with fit, clarity, and emotional safety.",
    body: "Our therapists bring different specialties and approaches while sharing a commitment to respectful, collaborative care.",
    cta_label: "Meet the therapists",
    cta_url: "/therapists",
    image_url: null,
  },
  {
    id: "about-cta",
    key: "about.cta",
    eyebrow: "A gentle next step",
    title: "Not sure which therapist or service fits?",
    body: "Send the practice an administrative message. We can explain formats, fees, availability, and the booking process without asking you to share sensitive clinical information online.",
    cta_label: "Contact the practice",
    cta_url: "/contact",
    image_url: null,
  },
];

const principles = [
  {
    eyebrow: "Care with context",
    title: "Meet the whole person",
    body: "Therapy is shaped around your context, priorities, relationships, and the pace that feels workable for you.",
  },
  {
    eyebrow: "Clarity",
    title: "Make the process understandable",
    body: "Services, formats, fees, availability, and next steps should be clear before you are asked to commit.",
  },
  {
    eyebrow: "Collaboration",
    title: "Work with, not at",
    body: "The therapeutic relationship is a shared process built through curiosity, consent, reflection, and honest conversation.",
  },
];

function CtaLink({ url, label, light = false }: { url: string; label: string; light?: boolean }) {
  const className = light
    ? "inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#20301d] transition hover:bg-[#edf0e6]"
    : "inline-flex items-center gap-2 rounded-full bg-[#556b2f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#465a27]";

  if (url.startsWith("http")) {
    return (
      <a href={url} className={className}>
        {label}
        <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
      </a>
    );
  }

  return (
    <Link to={url} className={className}>
      {label}
      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  );
}

function uniqueValues(values: Array<string | null>) {
  return new Set(values.flatMap(splitPublicList)).size;
}

export function AboutPage() {
  const sectionsQuery = useQuery({
    queryKey: ["public-landing-sections", "about"],
    queryFn: () => fetchPublicSections("about"),
  });
  const therapistsQuery = useQuery({
    queryKey: ["public-therapist-profiles"],
    queryFn: fetchPublicTherapistProfiles,
  });
  const servicesQuery = useQuery({
    queryKey: ["public-services"],
    queryFn: fetchPublicServices,
  });

  const sections = sectionsQuery.data?.length ? sectionsQuery.data : fallbackSections;
  const hero = findSection(sections, "about.hero") ?? fallbackSections[0];
  const profile = findSection(sections, "about.profile") ?? fallbackSections[1];
  const cta = findSection(sections, "about.cta") ?? fallbackSections[2];

  const principlesSection =
    findSection(sections, "about.principles");

  const teamSection =
    findSection(sections, "about.team");

  const therapists = therapistsQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const stats = [
    {
      value: therapistsQuery.data ? therapists.length : "—",
      label: "Therapists",
      detail: "Published team profiles",
    },
    {
      value: servicesQuery.data ? services.length : "—",
      label: "Services",
      detail: "Current support options",
    },
    {
      value: therapistsQuery.data ? uniqueValues(therapists.map((therapist) => therapist.languages)) : "—",
      label: "Languages",
      detail: "Across the practice team",
    },
    {
      value: therapistsQuery.data ? uniqueValues(therapists.map((therapist) => therapist.session_formats)) : "—",
      label: "Session formats",
      detail: "Based on published profiles",
    },
  ];

  return (
    <main data-ui-contract="public.about" className="bg-[#fbfaf5] text-[#20301d]">
      <section data-ui-section="hero" className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          {hero.eyebrow ? (
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#6f7f50]">
              {hero.eyebrow}
            </p>
          ) : null}
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.98] md:text-7xl">
            {hero.title}
          </h1>
          {hero.body ? <p className="mt-7 max-w-2xl text-lg leading-8 text-[#66704f]">{hero.body}</p> : null}
        </div>

        <div className="relative rounded-[3rem] border border-[#d7dec8] bg-[#edf1e7] p-5 md:p-7">
          <div className="absolute -left-8 top-12 hidden h-28 w-28 rounded-full bg-[#c7d3aa] lg:block" />
          <img
            src={
              resolveLandingSectionImageUrl(
                hero.image_url,
              ) ??
              "/demo/practice/practice-room.svg"
            }
            alt="A calm therapy practice room"
            className="relative aspect-[4/3] w-full rounded-[2.25rem] bg-white object-cover"
          />
        </div>
      </section>

      <section data-ui-section="practice-story" className="border-y border-[#dfe5d6] bg-[#f3f1e8] px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f50]">
              {profile.eyebrow || "Who we are"}
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">{profile.title}</h2>
          </div>
          <div>
            {profile.body ? <p className="max-w-3xl text-lg leading-8 text-[#66704f]">{profile.body}</p> : null}
            {profile.cta_url && profile.cta_label ? (
              <div className="mt-7">
                <CtaLink url={profile.cta_url} label={profile.cta_label} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section data-ui-section="practice-stats" className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f50]">
            Practice at a glance
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
            A multidisciplinary practice, shown through live public information.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-[2rem] border border-[#d7dec8] bg-white p-7">
              <p className="font-serif text-5xl text-[#556b2f]">{stat.value}</p>
              <h3 className="mt-5 font-semibold text-[#20301d]">{stat.label}</h3>
              <p className="mt-2 text-sm leading-6 text-[#66704f]">{stat.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section data-ui-section="practice-principles" className="bg-[#edf1e7] px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f50]">
                {principlesSection?.eyebrow || "Practice principles"}
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
                {principlesSection?.title || "What guides the experience of care."}
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[#66704f]">
              {principlesSection?.body ||
                "A calm website is useful only when the care behind it is understandable, respectful, and shaped around real people."}
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {principles.map((principle) => (
              <article key={principle.title} className="rounded-[2rem] border border-[#d1dac2] bg-[#fbfaf5] p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#748158]">
                  {principle.eyebrow}
                </p>
                <h3 className="mt-4 font-serif text-3xl">{principle.title}</h3>
                <p className="mt-4 leading-7 text-[#66704f]">{principle.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-ui-section="therapist-team" className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f50]">
              {teamSection?.eyebrow || "Meet the team"}
            </p>

            <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
              {teamSection?.title || "Different perspectives, one thoughtful practice."}
            </h2>

            {teamSection?.body ? (
              <p className="mt-4 max-w-2xl leading-7 text-[#66704f]">
                {teamSection.body}
              </p>
            ) : null}
          </div>

          <Link
            to={teamSection?.cta_url || "/therapists"}
            className="text-sm font-semibold text-[#556b2f] hover:text-[#3f5124]"
          >
            {teamSection?.cta_label || "View all therapist profiles"} →
          </Link>
        </div>

        {therapists.length ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {therapists.slice(0, 3).map((therapist) => (
              <Link
                key={therapist.id}
                to={`/therapists/${therapist.slug}`}
                className="group overflow-hidden rounded-[2.25rem] border border-[#d7dec8] bg-white"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#e6eee8]">
                  {therapist.profile_image_url ? (
                    <img
                      src={
                        resolveTherapistProfileImageUrl(
                          therapist.profile_image_url,
                        ) ?? undefined
                      }
                      alt={therapist.full_name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-serif text-6xl text-[#718047]">
                      {therapist.full_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#748158]">
                    {therapist.title || "Therapist"}
                  </p>
                  <h3 className="mt-3 font-serif text-3xl text-[#20301d]">{therapist.full_name}</h3>
                  {therapist.short_bio ? (
                    <p className="mt-4 line-clamp-3 leading-7 text-[#66704f]">{therapist.short_bio}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[2rem] border border-[#d7dec8] bg-white p-8 text-[#66704f]">
            Therapist profiles will appear here when they are published.
          </div>
        )}
      </section>

      <section data-ui-section="cta" className="px-6 pb-16 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-7xl rounded-[3rem] bg-[#22331f] px-7 py-14 text-center text-white md:px-12 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#ccd6b6]">
            {cta.eyebrow || "A gentle next step"}
          </p>
          <h2 className="mx-auto mt-5 max-w-4xl font-serif text-4xl leading-tight md:text-6xl">
            {cta.title}
          </h2>
          {cta.body ? <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-[#e4ead9]">{cta.body}</p> : null}
          {cta.cta_url && cta.cta_label ? (
            <div className="mt-8">
              <CtaLink url={cta.cta_url} label={cta.cta_label} light />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
