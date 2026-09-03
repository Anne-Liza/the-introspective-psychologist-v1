import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Monitor, Search } from "lucide-react";
import { Link } from "react-router";

import { DataState } from "../../../components/data/DataState";
import { ServiceCard } from "../components/ServiceCard";
import { fetchPublicServices } from "../lib/servicesApi";
import {
  fetchPublicSections,
  findSection,
  type LandingSection,
} from "../../public/lib/publicContent";

const fallbackSections: LandingSection[] = [
  {
    id: "services-hero",
    key: "services.hero",
    eyebrow: "Services",
    title: "Support shaped around real life.",
    body:
      "Compare the practice's current services, session formats, typical duration, and fees before choosing a comfortable next step.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "services-guidance",
    key: "services.guidance",
    eyebrow: "Guidance",
    title: "Not sure where to begin?",
    body:
      "Meet the team or send an administrative question. You do not need to diagnose yourself before reaching out.",
    cta_label: "Meet the therapists",
    cta_url: "/therapists",
    image_url: null,
  },
  {
    id: "services-formats",
    key: "services.formats",
    eyebrow: "Session formats",
    title: "Flexible ways to meet.",
    body:
      "Available session formats depend on the selected service and therapist.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "services-process",
    key: "services.process",
    eyebrow: "How it works",
    title: "A clear path from exploring to confirmation.",
    body:
      "Explore available services, request a suitable option, and let the practice confirm fit and availability.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "services-cta",
    key: "services.cta",
    eyebrow: "Next step",
    title: "Ready to ask about the right kind of support?",
    body:
      "Send an appointment request and the practice will guide the next step.",
    cta_label: "Request an appointment",
    cta_url: "/book",
    image_url: null,
  },
];

export function PublicServicesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-services"],
    queryFn: fetchPublicServices,
  });

  const sectionsQuery = useQuery({
    queryKey: [
      "public-landing-sections",
      "services",
    ],
    queryFn: () =>
      fetchPublicSections("services"),
    retry: 1,
  });

  const sections =
    sectionsQuery.data ?? [];

  const hero =
    findSection(
      sections,
      "services.hero",
    ) ?? fallbackSections[0];

  const guidance =
    findSection(
      sections,
      "services.guidance",
    ) ?? fallbackSections[1];

  const formats =
    findSection(
      sections,
      "services.formats",
    ) ?? fallbackSections[2];

  const process =
    findSection(
      sections,
      "services.process",
    ) ?? fallbackSections[3];

  const cta =
    findSection(
      sections,
      "services.cta",
    ) ?? fallbackSections[4];

  const showState =
    isLoading ||
    isError ||
    !data?.length;

  return (
    <main data-ui-contract="public.services" className="bg-[#fbfaf5]">
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
            {hero.eyebrow || "Services"}
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-tight tracking-[-0.03em] text-[#26311f] md:text-6xl">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654d]">
            {hero.body}
          </p>
          </div>
          <aside className="rounded-[2rem] bg-[#edf2e7] p-7 lg:justify-self-end">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6f7f52]">
              {guidance.eyebrow || "Guidance"}
            </p>
            <h2 className="mt-3 font-serif text-2xl text-[#26311f]">
              {guidance.title}
            </h2>
            {guidance.body ? (
              <p className="mt-3 max-w-md text-sm leading-7 text-[#59654d]">
                {guidance.body}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-[#3f512e]">
              <Link to="/therapists" className="inline-flex items-center gap-2">Meet the therapists <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/contact">Ask a question</Link>
            </div>
          </aside>
        </div>

        <div className="mt-12">
          {showState ? (
            <DataState isLoading={isLoading} isError={isError} empty={!data?.length} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {data?.map((service, index) => (
                <ServiceCard service={service} index={index} key={service.id} />
              ))}
            </div>
          )}
        </div>
        <section className="mt-20 rounded-[2.5rem] bg-[#edf2e7] p-7 md:p-10">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
              {formats.eyebrow}
            </p>
            <h2 className="mt-4 font-serif text-4xl text-[#26311f]">
              {formats.title}
            </h2>
            {formats.body ? (
              <p className="mt-4 leading-7 text-[#59654d]">
                {formats.body}
              </p>
            ) : null}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-[2rem] bg-white p-7">
            <Monitor className="h-6 w-6 text-[#6f7f52]" aria-hidden="true" />
            <h2 className="mt-5 font-serif text-3xl text-[#26311f]">Online support</h2>
            <p className="mt-3 text-sm leading-7 text-[#59654d]">Meet from a private, suitable space using the secure session instructions supplied after confirmation.</p>
          </article>
          <article className="rounded-[2rem] bg-white p-7">
            <Building2 className="h-6 w-6 text-[#6f7f52]" aria-hidden="true" />
            <h2 className="mt-5 font-serif text-3xl text-[#26311f]">In-person support</h2>
            <p className="mt-3 text-sm leading-7 text-[#59654d]">Attend at the confirmed practice location. In-person availability depends on the service and therapist selected.</p>
          </article>
          </div>
        </section>

        <section className="mt-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
              {process.eyebrow || "How it works"}
            </p>
            <h2 className="mt-4 font-serif text-4xl text-[#26311f]">
              {process.title}
            </h2>
            {process.body ? (
              <p className="mt-4 leading-7 text-[#59654d]">
                {process.body}
              </p>
            ) : null}
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {[
              ["01", "Explore", "Review services, formats, therapist profiles, and practical details."],
              ["02", "Request", "Share your preferred service, format, therapist, and suitable time."],
              ["03", "Confirm", "The practice checks fit and availability before finalizing the appointment."],
            ].map(([number, title, body]) => (
              <article key={number} className="rounded-[2rem] border border-[#dce3d3] bg-white p-7">
                <span className="font-serif text-3xl text-[#a8b491]">{number}</span>
                <h3 className="mt-5 text-xl font-semibold text-[#26311f]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#59654d]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2.5rem] bg-[#26311f] p-8 text-white md:flex md:items-center md:justify-between md:p-12">
          <div>
            <Search className="h-6 w-6 text-[#b9c69d]" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b9c69d]">
              {cta.eyebrow}
            </p>
            <h2 className="mt-5 max-w-2xl font-serif text-4xl">
              {cta.title}
            </h2>
            {cta.body ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#dfe5d6]">
                {cta.body}
              </p>
            ) : null}
          </div>
          {cta.cta_label && cta.cta_url ? (
            <Link
              to={cta.cta_url}
              className="mt-7 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#26311f] md:mt-0"
            >
              {cta.cta_label}
            </Link>
          ) : null}
        </section>
      </section>
    </main>
  );
}
