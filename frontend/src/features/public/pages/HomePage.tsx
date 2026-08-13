import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { BlogPostCard } from "../../../features/blog/components/BlogPostCard";
import { fetchPublicBlogPosts } from "../../../features/blog/lib/blogApi";

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

export function HomePage() {
  const siteName = import.meta.env.VITE_SITE_NAME || "Therapy Practice";
  const { data: blogPosts = [] } = useQuery({
    queryKey: ["public-blog-posts"],
    queryFn: fetchPublicBlogPosts,
  });
  const latestPosts = blogPosts.slice(0, 3);

  return (
    <div data-ui-contract="public.home">
      <section data-ui-section="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#e7ecd9,_transparent_34%),linear-gradient(135deg,_#fbfaf5_0%,_#eef2e7_100%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#6f7f52]">
              {siteName}
            </p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[1.04] tracking-[-0.04em] text-[#26311f] md:text-7xl">
              Therapy that makes room for reflection, care, and becoming.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f6d54]">
              A calm multi-therapist practice where clients can explore services,
              meet the team, check availability, and request a session with ease.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#556b2f] px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#465a27] focus:outline-none focus:ring-4 focus:ring-[#c8d3b1]"
              >
                Request an appointment
              </Link>
              <Link
                to="/services"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#b7c29d] bg-white/70 px-7 py-3 text-sm font-semibold text-[#3f4f2c] transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#dfe5d6]"
              >
                Explore services
              </Link>
            </div>

            <div className="mt-10 grid gap-4 text-sm text-[#5f6d54] sm:grid-cols-3">
              <div className="rounded-3xl border border-[#dfe5d6] bg-white/60 p-4">
                <p className="font-semibold text-[#26311f]">Collaborative team</p>
                <p className="mt-1">Different specialties, one thoughtful practice.</p>
              </div>
              <div className="rounded-3xl border border-[#dfe5d6] bg-white/60 p-4">
                <p className="font-semibold text-[#26311f]">Flexible formats</p>
                <p className="mt-1">Online and in-person session options.</p>
              </div>
              <div className="rounded-3xl border border-[#dfe5d6] bg-white/60 p-4">
                <p className="font-semibold text-[#26311f]">Clear next steps</p>
                <p className="mt-1">Services, availability, and fees in one place.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 h-32 w-32 rounded-full bg-[#c7d2ad]" />
            <div className="absolute -bottom-8 right-4 h-40 w-40 rounded-full bg-[#e3d7be]" />
            <div className="relative rounded-[2.5rem] border border-[#d6ddc9] bg-[#f8f6ef] p-4 shadow-2xl shadow-[#9baa7c]/20">
              <div className="rounded-[2rem] bg-white p-8">
                <img
                  src="/demo/practice/practice-room.svg"
                  alt="Two chairs in a calm therapy room"
                  className="h-72 w-full rounded-[1.5rem] object-cover"
                />
                <div className="mt-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                    Practice note
                  </p>
                  <h2 className="mt-3 font-serif text-3xl text-[#26311f]">
                    A softer first step toward support.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[#5f6d54]">
                    The site is designed to help clients feel oriented before they reach out:
                    what support is available, who they will meet, and how to begin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-ui-section="approach" className="bg-[#fbfaf5] px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
              Approach
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f] md:text-5xl">
              Grounded, thoughtful care for people navigating inner and outer change.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#5f6d54]">
              This practice is shaped around reflection, emotional safety, and practical
              support. The experience is intentionally simple so clients can understand
              the offering and take the next step without overwhelm.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {serviceCards.map((service) => (
              <article key={service.title} className="rounded-[2rem] border border-[#dfe5d6] bg-white p-7 shadow-sm">
                <h3 className="font-serif text-2xl text-[#26311f]">{service.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[#5f6d54]">{service.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-ui-section="support-areas" className="bg-[#eef2e7] px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
              Support areas
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f]">
              Space for what feels heavy, unclear, or ready to change.
            </h2>
            <Link
              to="/therapists"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#26311f] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2116]"
            >
              Meet the therapists
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {supportAreas.map((area) => (
              <div key={area} className="rounded-[1.5rem] border border-[#d3dcc5] bg-[#fbfaf5] p-6">
                <p className="font-medium text-[#26311f]">{area}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-ui-section="blog" className="bg-[#fbfaf5] px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                From the blog
              </p>
              <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f] md:text-5xl">
                Gentle resources for reflection and everyday wellbeing.
              </h2>
            </div>
            <Link to="/blog" className="text-sm font-semibold text-[#556b2f] underline underline-offset-4">
              View all articles
            </Link>
          </div>

          {latestPosts.length ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {latestPosts.map((post) => <BlogPostCard key={post.id} post={post} />)}
            </div>
          ) : (
            <div className="mt-10 rounded-[2rem] border border-dashed border-[#cbd5bb] bg-white p-8">
              <p className="font-serif text-2xl text-[#26311f]">New reflections are being prepared.</p>
              <p className="mt-2 text-sm text-[#5f6d54]">Visit the blog soon for articles and practical resources.</p>
            </div>
          )}
        </div>
      </section>

      <section data-ui-section="process" className="bg-[#fbfaf5] px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                How it works
              </p>
              <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#26311f]">
                A simple path from curiosity to care.
              </h2>
            </div>
            <div className="grid gap-5">
              {processSteps.map((step, index) => (
                <div key={step.title} className="rounded-[1.75rem] border border-[#dfe5d6] bg-white p-6">
                  <div className="flex gap-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef2e7] text-sm font-semibold text-[#556b2f]">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl text-[#26311f]">{step.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[#5f6d54]">{step.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 rounded-[2.5rem] bg-[#26311f] px-6 py-12 text-center text-white md:px-12">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#c7d2ad]">
              Ready when you are
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl tracking-[-0.03em] md:text-5xl">
              Begin with a gentle appointment request.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#dfe5d6]">
              Clients can request a session, send a message, or check availability.
              The practice team can guide the next steps from a private workspace.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#26311f] transition hover:bg-[#eef2e7]"
              >
                Request appointment
              </Link>
              <Link
                to="/contact"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Contact the practice
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
