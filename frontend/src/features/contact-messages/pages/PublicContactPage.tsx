import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock3, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api-client";
import {
  contactSectionHref,
  fetchPublicSections,
  findSection,
  isPracticeContactDetail,
  resolveLandingSectionImageUrl,
  type LandingSection,
} from "../../public/lib/publicContent";
import { contactSubmissionErrorMessage } from "../lib/contactSubmission";

type ContactPayload = {
  name: string;
  email: string;
  subject?: string;
  message: string;
  source?: string;
};

const fallbackHero: LandingSection = {
  id: "contact-hero",
  key: "contact.hero",
  eyebrow: "Contact the practice",
  title: "A clear, gentle way to begin a conversation.",
  body:
    "Ask about therapist fit, services, availability, workshops, or the administrative steps involved in starting care.",
  cta_label: null,
  cta_url: null,
  image_url: "/demo/practice/practice-room.svg",
};

const fallbackDetails: LandingSection[] = [
  {
    id: "configuration",
    key: "contact.configuration",
    eyebrow: "Practice details",
    title: "Contact information is being configured.",
    body: "You can still use the secure administrative message form on this page.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
];

const fallbackUrgent: LandingSection = {
  id: "urgent",
  key: "contact.emergency",
  eyebrow: "Urgent support",
  title: "This website is not an emergency or crisis service.",
  body: "If you or someone else is in immediate danger, contact local emergency services or go to the nearest emergency department.",
  cta_label: null,
  cta_url: null,
  image_url: null,
};

const fallbackFaqs: LandingSection[] = [
  {
    id: "faq-fit",
    key: "contact.faq.fit",
    eyebrow: "Finding support",
    title: "How do I choose a therapist?",
    body: "Start with the therapist profiles and areas of focus. If you are still unsure, send an administrative message and the practice can explain the available options.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "faq-formats",
    key: "contact.faq.formats",
    eyebrow: "Session formats",
    title: "Are online and in-person sessions available?",
    body: "Available formats depend on the therapist, service, and current schedule. Review the service and therapist pages or ask the practice before requesting a time.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "faq-request",
    key: "contact.faq.request",
    eyebrow: "Appointments",
    title: "What happens after I request an appointment?",
    body: "The practice reviews the request, confirms therapist fit and availability, and then contacts you with the next administrative steps.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
  {
    id: "faq-fees",
    key: "contact.faq.fees",
    eyebrow: "Fees",
    title: "Where can I find service fees?",
    body: "Published fees and session details appear on the Services page. The practice can clarify payment timing or package details before you book.",
    cta_label: null,
    cta_url: null,
    image_url: null,
  },
];

const detailIcons = {
  "contact.email": Mail,
  "contact.phone": Phone,
  "contact.location": MapPin,
  "contact.hours": Clock3,
};

async function submitContactMessage(payload: ContactPayload) {
  const response = await apiClient.post("/contact-messages", payload);
  return response.data;
}

function PracticeDetail({ detail }: { detail: LandingSection }) {
  const Icon = detailIcons[detail.key as keyof typeof detailIcons] ?? MapPin;
  const href = contactSectionHref(detail);
  const title = href ? (
    <a href={href} className="break-words transition hover:text-[#556b2f]">
      {detail.title}
    </a>
  ) : (
    detail.title
  );

  return (
    <article className="flex gap-4 border-b border-[#d7dec8] pb-5 last:border-0 last:pb-0">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#cfd8bc] text-[#607044]">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#748158]">
          {detail.eyebrow}
        </p>
        <h2 className="mt-2 font-serif text-xl text-[#20301d]">{title}</h2>
        {detail.body ? <p className="mt-2 text-sm leading-6 text-[#66704f]">{detail.body}</p> : null}
      </div>
    </article>
  );
}

export function PublicContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const sectionsQuery = useQuery({
    queryKey: ["public-contact-sections"],
    queryFn: () => fetchPublicSections("contact"),
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: submitContactMessage,
    onSuccess: () => {
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    },
  });

  const hero =
    findSection(
      sectionsQuery.data ?? [],
      "contact.hero",
    ) ?? fallbackHero;

  const heroImage =
    resolveLandingSectionImageUrl(
      hero.image_url,
    ) ??
    "/demo/practice/practice-room.svg";

  const seededDetails = sectionsQuery.data?.filter(isPracticeContactDetail);
  const details = seededDetails?.length ? seededDetails : fallbackDetails;
  const urgent =
    sectionsQuery.data?.find((section) => section.key === "contact.emergency") ?? fallbackUrgent;
  const seededFaqs = sectionsQuery.data?.filter((section) => section.key.startsWith("contact.faq."));
  const faqs = seededFaqs?.length ? seededFaqs : fallbackFaqs;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ name, email, subject, message, source: "therapy_website" });
  }

  return (
    <main data-ui-contract="public.contact" className="bg-[#fbfaf5] text-[#20301d]">
      <section
        data-ui-section="hero"
        className="relative isolate flex min-h-[430px] items-center overflow-hidden bg-[#20301d] px-6 py-20 text-white lg:px-12"
        style={{
          backgroundImage: `url('${heroImage}')`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 -z-10 bg-[#172416]/80" />
        <div className="mx-auto w-full max-w-7xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#ccd6b6]">
            {hero.eyebrow || "Contact the practice"}
          </p>
          <h1 className="mx-auto mt-5 max-w-4xl font-serif text-5xl leading-[0.98] md:text-7xl">
            {hero.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#e3e8d9]">
            {hero.body}
          </p>
        </div>
      </section>

      <section data-ui-section="contact-workflow" className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[0.78fr_1.22fr] lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f50]">
            Practice information
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
            Contact details and office hours.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#66704f]">
            Use these details for practical questions. Please do not send diagnoses, assessment details, medical history, or other sensitive clinical information.
          </p>

          <div className="mt-9 grid gap-5">
            {details.map((detail) => (
              <PracticeDetail key={detail.key} detail={detail} />
            ))}
          </div>

          <aside id="urgent-support" data-ui-contract="public.contact.urgent-support" className="mt-9 scroll-mt-32 rounded-[2rem] bg-[#22331f] p-7 text-[#fbfaf5]">
            <ShieldAlert aria-hidden="true" className="h-6 w-6 text-[#ccd6b6]" />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#ccd6b6]">
              {urgent.eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-2xl">{urgent.title}</h2>
            {urgent.body ? <p className="mt-3 leading-7 text-[#e4ead9]">{urgent.body}</p> : null}
          </aside>
        </div>

        <form data-ui-section="contact-form" onSubmit={handleSubmit} className="rounded-[2.5rem] border border-[#d7dec8] bg-white p-7 shadow-sm md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#6f7f50]">
            Send a message
          </p>
          <h2 className="mt-4 font-serif text-4xl text-[#20301d]">How can we help?</h2>
          <p className="mt-4 leading-7 text-[#66704f]">
            This form goes to the practice team for administrative follow-up.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Input
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="border-[#d7dec8] bg-[#fbfaf5] focus:border-[#718047]"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="border-[#d7dec8] bg-[#fbfaf5] focus:border-[#718047]"
            />
          </div>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-[#20301d]">Reason for contact</span>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              className="w-full rounded-2xl border border-[#d7dec8] bg-[#fbfaf5] px-4 py-3 text-sm outline-none focus:border-[#718047] focus:ring-2 focus:ring-[#dfe6d0]"
            >
              <option value="">Select a reason</option>
              <option value="Therapist fit">Therapist fit</option>
              <option value="Services and fees">Services and fees</option>
              <option value="Appointment availability">Appointment availability</option>
              <option value="Workshops and resources">Workshops and resources</option>
              <option value="General administrative question">General administrative question</option>
            </select>
          </label>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-[#20301d]">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              rows={8}
              className="w-full rounded-2xl border border-[#d7dec8] bg-[#fbfaf5] px-4 py-3 text-sm outline-none focus:border-[#718047] focus:ring-2 focus:ring-[#dfe6d0]"
            />
          </label>

          <p className="mt-4 text-sm leading-6 text-[#66704f]">
            Keep this message administrative. Do not include emergency information or sensitive health details.
          </p>

          <div className="mt-6">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-full bg-[#556b2f] px-7 py-3 text-white hover:bg-[#465a27]"
            >
              {mutation.isPending ? "Sending..." : "Send message"}
            </Button>
          </div>

          {mutation.isSuccess ? (
            <p aria-live="polite" className="mt-4 text-sm text-green-800">
              Message sent. The practice will follow up during office hours.
            </p>
          ) : null}

          {mutation.isError ? (
            <p aria-live="polite" className="mt-4 text-sm text-red-700">
              {contactSubmissionErrorMessage(mutation.error)}
            </p>
          ) : null}
        </form>
      </section>

      <section data-ui-section="faq" className="border-t border-[#dfe5d6] bg-[#f3f1e8] px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f7f50]">
              Support
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
              Frequently asked questions.
            </h2>
            <p className="mt-5 max-w-md leading-7 text-[#66704f]">
              A few practical answers before you contact the practice or request an appointment.
            </p>
          </div>

          <div className="border-t border-[#cfd8bc]">
            {faqs.map((faq) => (
              <details key={faq.key} className="group border-b border-[#cfd8bc] py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-semibold text-[#20301d] marker:hidden">
                  {faq.title}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#b9c69d] text-xl font-normal text-[#607044] transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                {faq.body ? <p className="max-w-3xl pb-6 pr-12 leading-7 text-[#66704f]">{faq.body}</p> : null}
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
