import { Link, useLocation } from "react-router";

type Policy = {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: Array<{ heading: string; body: string }>;
};

const policies: Record<string, Policy> = {
  "/privacy": {
    eyebrow: "Privacy",
    title: "How we handle website information",
    introduction: "This starter notice explains the information submitted through this website and the care expected when handling it.",
    sections: [
      { heading: "Information you provide", body: "Contact, appointment, and checkout forms collect only the details needed to respond to your request or complete the selected transaction." },
      { heading: "How it is used", body: "Information is used for practice administration, scheduling, communication, payment records, and service delivery. It is not a substitute for a confidential clinical record." },
      { heading: "Your choices", body: "Contact the practice to ask about access, correction, or deletion options that apply to your information." },
    ],
  },
  "/terms": {
    eyebrow: "Terms",
    title: "Using this website",
    introduction: "These starter terms describe the boundary between general website information and services formally agreed with the practice.",
    sections: [
      { heading: "General information", body: "Website articles, profiles, services, and resources are provided for general information and do not create a therapist-client relationship." },
      { heading: "Requests and confirmation", body: "Submitting a form does not confirm an appointment or purchase until the practice accepts it and provides the relevant confirmation." },
      { heading: "Appropriate use", body: "Do not misuse the website, attempt unauthorized access, or submit emergency or highly sensitive clinical information through public forms." },
    ],
  },
  "/accessibility": {
    eyebrow: "Accessibility",
    title: "A website more people can use",
    introduction: "The practice aims to keep its public information understandable, keyboard accessible, responsive, and readable across common devices.",
    sections: [
      { heading: "Need another format?", body: "If a page, document, or form is difficult to use, contact the practice and describe the barrier and the format that would help." },
      { heading: "Ongoing improvement", body: "Accessibility feedback is reviewed as part of ongoing website maintenance and content updates." },
    ],
  },
  "/cancellations": {
    eyebrow: "Appointments",
    title: "Cancellation and rescheduling guidance",
    introduction: "Appointment changes depend on the policy confirmed for your service and therapist.",
    sections: [
      { heading: "Requesting a change", body: "Contact the practice as early as possible using the details on this website. A request is complete only after the practice confirms it." },
      { heading: "Fees and timing", body: "Any notice period, late-cancellation fee, or rescheduling limit will be communicated before a booking is finalized." },
    ],
  },
  "/shipping-returns": {
    eyebrow: "Store",
    title: "Shipping, collection, and returns",
    introduction: "Physical products require delivery or collection arrangements confirmed by the practice after checkout.",
    sections: [
      { heading: "Order confirmation", body: "An order request is not a dispatch promise. Availability, destination, delivery cost, and expected timing are confirmed separately." },
      { heading: "Returns", body: "Return eligibility depends on the item condition, product type, and applicable consumer rules. Contact the practice before returning an item." },
      { heading: "Digital and service items", body: "Digital resources, workshops, and therapy packages follow the access or cancellation terms shown when the order is confirmed." },
    ],
  },
};

export function PublicLegalPage() {
  const { pathname } = useLocation();
  const policy = policies[pathname] ?? policies["/terms"];

  return (
    <section data-ui-contract="public.legal" className="mx-auto max-w-5xl px-5 py-20 lg:px-8 lg:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">{policy.eyebrow}</p>
      <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-tight text-[#26311f] md:text-6xl">{policy.title}</h1>
      <p className="mt-7 max-w-3xl text-lg leading-8 text-[#59654d]">{policy.introduction}</p>
      <div className="mt-12 grid gap-5">
        {policy.sections.map((section) => (
          <article key={section.heading} className="rounded-[2rem] border border-[#dce3d3] bg-white p-7 md:p-9">
            <h2 className="font-serif text-2xl text-[#26311f]">{section.heading}</h2>
            <p className="mt-3 leading-7 text-[#59654d]">{section.body}</p>
          </article>
        ))}
      </div>
      <div className="mt-10 rounded-3xl bg-[#edf2e7] p-6 text-sm leading-7 text-[#4d5d3a]">
        This is starter website copy, not legal advice. The practice owner must review and adapt it for the services, jurisdiction, and operating policies before launch. Need help now? <Link to="/contact" className="font-semibold underline">Contact the practice</Link>.
      </div>
    </section>
  );
}
