import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { BlogPostCard } from "../../../features/blog/components/BlogPostCard";
import { fetchPublicBlogPosts } from "../../../features/blog/lib/blogApi";
import {
  fetchPublicSections,
  findSection,
  resolveLandingSectionImageUrl,
  type LandingSection,
} from "../lib/publicContent";

const supportAreas = [
  "Anxiety and emotional overwhelm",
  "Life transitions and identity",
  "Stress, burnout, and boundaries",
  "Relationships and communication",
];

const processSteps = [
  {
    title: "Explore the practice",
    body: "Learn about the therapeutic approach, services, and the kind of support available.",
  },
  {
    title: "Check availability",
    body: "View open times and choose a path that feels manageable before reaching out.",
  },
  {
    title: "Request a session",
    body: "Submit an appointment request through a simple, private booking flow.",
  },
];

const serviceCards = [
  {
    title: "Individual therapy",
    body: "One-on-one support for emotional clarity, self-understanding, and healthier patterns.",
  },
  {
    title: "Stress and burnout support",
    body: "A reflective space to slow down, reset, and rebuild steadier rhythms.",
  },
  {
    title: "Life transitions",
    body: "Support through grief, change, uncertainty, identity shifts, and new chapters.",
  },
];

const fallbackSections: LandingSection[] = [
  {
    id: "home-hero",
    key: "home.hero",
    eyebrow: "The Introspective Psychologist",
    title:
      "Therapy that makes room for reflection, care, and becoming.",
    body:
      "A calm multi-therapist practice where clients can explore services, meet the team, check availability, and request a session with ease.",
    cta_label: "Request an appointment",
    cta_url: "/book",
    image_url: "/demo/practice/practice-room.svg",
  },
  {
    id: "home-approach",
    key: "home.approach",
    eyebrow: "Approach",
    title:
      "Grounded, thoughtful care for people navigating inner and outer change.",
    body:
      "This practice is shaped around reflection, emotional safety, and practical support. The experience is intentionally simple so clients can understand the offering and take the next step without overwhelm.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "home-support",
    key: "home.support_areas",
    eyebrow: "Support areas",
    title:
      "Space for what feels heavy, unclear, or ready to change.",
    body:
      "Explore the practice team to find support aligned with your needs and preferences.",
    cta_label: "Meet the therapists",
    cta_url: "/therapists",
    image_url: null,
  },
  {
    id: "home-blog",
    key: "home.blog",
    eyebrow: "From the blog",
    title:
      "Gentle resources for reflection and everyday wellbeing.",
    body: "Explore recent articles from the practice.",
    cta_label: "View all articles",
    cta_url: "/blog",
    image_url: null,
  },
  {
    id: "home-process",
    key: "home.process",
    eyebrow: "How it works",
    title: "A simple path from curiosity to care.",
    body:
      "Explore the practice, review availability, and request a session when you are ready.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "home-cta",
    key: "home.cta",
    eyebrow: "Ready when you are",
    title: "Begin with a gentle appointment request.",
    body:
      "Clients can request a session, send a message, or check availability. The practice team can guide the next steps from a private workspace.",
    cta_label: "Request appointment",
    cta_url: "/book",
    image_url: null,
  },
];

function fallback(key: string) {
  return fallbackSections.find(
    (section) => section.key === key,
  );
}

function CtaLink({
  url,
  label,
  light = false,
}: {
  url: string;
  label: string;
  light?: boolean;
}) {
  const className = light
    ? "inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#26311f] transition hover:bg-[#eef2e7]"
    : "inline-flex min-h-12 items-center justify-center rounded-full bg-[#556b2f] px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#465a27]";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return (
      <a
        href={url}
        className={className}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      to={url}
      className={className}
    >
      {label}
    </Link>
  );
}

export function HomePage() {
  const sectionsQuery = useQuery({
    queryKey: [
      "public-landing-sections",
      "home",
    ],
    queryFn: () =>
      fetchPublicSections("home"),
    retry: 1,
  });

  const {
    data: blogPosts = [],
  } = useQuery({
    queryKey: ["public-blog-posts"],
    queryFn: fetchPublicBlogPosts,
  });

  const sections =
    sectionsQuery.data ?? [];

  function cmsSection(key: string) {
    if (sectionsQuery.isSuccess) {
      return findSection(
        sections,
        key,
      );
    }

    return fallback(key);
  }

  const hero =
    cmsSection("home.hero");

  const approach =
    cmsSection("home.approach");

  const support =
    cmsSection("home.support_areas");

  const blog =
    cmsSection("home.blog");

  const process =
    cmsSection("home.process");

  const cta =
    cmsSection("home.cta");

  const latestPosts =
    blogPosts.slice(0, 3);

  const heroImage =
    resolveLandingSectionImageUrl(
      hero?.image_url,
    ) ??
    "/demo/practice/practice-room.svg";

  return (
    <div data-ui-contract="public.home">
      {hero ? (
        <section
          data-ui-section="hero"
          className="relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#e7ecd9,_transparent_34%),linear-gradient(135deg,_#fbfaf5_0%,_#eef2e7_100%)]" />

          <div className="relative mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
            <div>
              {hero.eyebrow ? (
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#6f7f52]">
                  {hero.eyebrow}
                </p>
              ) : null}

              <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[1.04] tracking-[-0.04em] text-[#26311f] md:text-7xl">
                {hero.title}
              </h1>

              {hero.body ? (
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f6d54]">
                  {hero.body}
                </p>
              ) : null}

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                {hero.cta_label &&
                hero.cta_url ? (
                  <CtaLink
                    label={
                      hero.cta_label
                    }
                    url={
                      hero.cta_url
                    }
                  />
                ) : null}

                <Link
                  to="/services"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#b7c29d] bg-white/70 px-7 py-3 text-sm font-semibold text-[#3f4f2c] transition hover:bg-white"
                >
                  Explore services
                </Link>
              </div>

              <div className="mt-10 grid gap-4 text-sm text-[#5f6d54] sm:grid-cols-3">
                <div className="rounded-3xl border border-[#dfe5d6] bg-white/60 p-4">
                  <p className="font-semibold text-[#26311f]">
                    Collaborative team
                  </p>
                  <p className="mt-1">
                    Different specialties,
                    one thoughtful practice.
                  </p>
                </div>

                <div className="rounded-3xl border border-[#dfe5d6] bg-white/60 p-4">
                  <p className="font-semibold text-[#26311f]">
                    Flexible formats
                  </p>
                  <p className="mt-1">
                    Online and in-person
                    session options.
                  </p>
                </div>

                <div className="rounded-3xl border border-[#dfe5d6] bg-white/60 p-4">
                  <p className="font-semibold text-[#26311f]">
                    Clear next steps
                  </p>
                  <p className="mt-1">
                    Services, availability,
                    and fees in one place.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-10 h-32 w-32 rounded-full bg-[#c7d2ad]" />
              <div className="absolute -bottom-8 right-4 h-40 w-40 rounded-full bg-[#e3d7be]" />

              <div className="relative rounded-[2.5rem] border border-[#d6ddc9] bg-[#f8f6ef] p-4 shadow-2xl shadow-[#9baa7c]/20">
                <div className="rounded-[2rem] bg-white p-8">
                  <img
                    src={heroImage}
                    alt="A calm therapy practice space"
                    className="h-72 w-full rounded-[1.5rem] object-cover"
                  />

                  <div className="mt-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                      Practice note
                    </p>

                    <h2 className="mt-3 font-serif text-3xl text-[#26311f]">
                      A softer first step toward
                      support.
                    </h2>

                    <p className="mt-4 text-sm leading-7 text-[#5f6d54]">
                      The site is designed to
                      help clients feel oriented
                      before they reach out:
                      what support is available,
                      who they will meet, and how
                      to begin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {approach ? (
        <section
          data-ui-section="approach"
          className="bg-[#fbfaf5] px-5 py-20 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              {approach.eyebrow ? (
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                  {approach.eyebrow}
                </p>
              ) : null}

              <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f] md:text-5xl">
                {approach.title}
              </h2>

              {approach.body ? (
                <p className="mt-5 text-lg leading-8 text-[#5f6d54]">
                  {approach.body}
                </p>
              ) : null}
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {serviceCards.map(
                (service) => (
                  <article
                    key={
                      service.title
                    }
                    className="rounded-[2rem] border border-[#dfe5d6] bg-white p-7 shadow-sm"
                  >
                    <h3 className="font-serif text-2xl text-[#26311f]">
                      {
                        service.title
                      }
                    </h3>

                    <p className="mt-4 text-sm leading-7 text-[#5f6d54]">
                      {
                        service.body
                      }
                    </p>
                  </article>
                ),
              )}
            </div>
          </div>
        </section>
      ) : null}

      {support ? (
        <section
          data-ui-section="support-areas"
          className="bg-[#eef2e7] px-5 py-20 lg:px-8"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              {support.eyebrow ? (
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                  {
                    support.eyebrow
                  }
                </p>
              ) : null}

              <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f]">
                {support.title}
              </h2>

              {support.body ? (
                <p className="mt-5 text-sm leading-7 text-[#5f6d54]">
                  {support.body}
                </p>
              ) : null}

              {support.cta_label &&
              support.cta_url ? (
                <div className="mt-8">
                  <CtaLink
                    label={
                      support.cta_label
                    }
                    url={
                      support.cta_url
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {supportAreas.map(
                (area) => (
                  <div
                    key={area}
                    className="rounded-[1.5rem] border border-[#d3dcc5] bg-[#fbfaf5] p-6"
                  >
                    <p className="font-medium text-[#26311f]">
                      {area}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      ) : null}

      {blog ? (
        <section
          data-ui-section="blog"
          className="bg-[#fbfaf5] px-5 py-20 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-3xl">
                {blog.eyebrow ? (
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                    {
                      blog.eyebrow
                    }
                  </p>
                ) : null}

                <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f] md:text-5xl">
                  {blog.title}
                </h2>

                {blog.body ? (
                  <p className="mt-4 text-sm leading-7 text-[#5f6d54]">
                    {blog.body}
                  </p>
                ) : null}
              </div>

              {blog.cta_label &&
              blog.cta_url ? (
                <CtaLink
                  label={
                    blog.cta_label
                  }
                  url={blog.cta_url}
                />
              ) : null}
            </div>

            {latestPosts.length ? (
              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {latestPosts.map(
                  (post) => (
                    <BlogPostCard
                      key={
                        post.id
                      }
                      post={post}
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="mt-10 rounded-[2rem] border border-dashed border-[#cbd5bb] bg-white p-8">
                <p className="font-serif text-2xl text-[#26311f]">
                  New reflections are being
                  prepared.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {process ? (
        <section
          data-ui-section="process"
          className="bg-[#fbfaf5] px-5 py-20 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                {process.eyebrow ? (
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                    {
                      process.eyebrow
                    }
                  </p>
                ) : null}

                <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f]">
                  {process.title}
                </h2>

                {process.body ? (
                  <p className="mt-5 text-sm leading-7 text-[#5f6d54]">
                    {
                      process.body
                    }
                  </p>
                ) : null}
              </div>

              <div className="grid gap-5">
                {processSteps.map(
                  (
                    step,
                    index,
                  ) => (
                    <div
                      key={
                        step.title
                      }
                      className="rounded-[1.75rem] border border-[#dfe5d6] bg-white p-6"
                    >
                      <div className="flex gap-5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef2e7] text-sm font-semibold text-[#556b2f]">
                          {
                            index +
                            1
                          }
                        </div>

                        <div>
                          <h3 className="font-serif text-2xl text-[#26311f]">
                            {
                              step.title
                            }
                          </h3>

                          <p className="mt-2 text-sm leading-7 text-[#5f6d54]">
                            {
                              step.body
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {cta ? (
              <div className="mt-16 rounded-[2.5rem] bg-[#26311f] px-6 py-12 text-center text-white md:px-12">
                {cta.eyebrow ? (
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#c7d2ad]">
                    {
                      cta.eyebrow
                    }
                  </p>
                ) : null}

                <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl tracking-[-0.03em] md:text-5xl">
                  {cta.title}
                </h2>

                {cta.body ? (
                  <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#dfe5d6]">
                    {cta.body}
                  </p>
                ) : null}

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  {cta.cta_label &&
                  cta.cta_url ? (
                    <CtaLink
                      label={
                        cta.cta_label
                      }
                      url={
                        cta.cta_url
                      }
                      light
                    />
                  ) : null}

                  <Link
                    to="/contact"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Contact the practice
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
