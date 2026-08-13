import { Link } from "react-router";

import { Service } from "../lib/servicesApi";

function formatPrice(service: Service) {
  if (service.price_amount === null || service.price_amount === undefined || service.price_amount === "") {
    return null;
  }

  const amount = Number(service.price_amount);
  if (Number.isNaN(amount)) return null;

  return `${service.currency || "KES"} ${amount.toLocaleString()}`;
}

export function ServiceCard({ service, index = 0 }: { service: Service; index?: number }) {
  const price = formatPrice(service);

  return (
    <article data-ui-contract="public.services.card" className="group flex h-full flex-col rounded-[2rem] border border-[#dce3d3] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:p-8">
      <div className="flex items-start justify-between gap-5">
        <div className="flex flex-wrap items-center gap-2">
        {service.category ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {service.category}
          </span>
        ) : null}

        {service.is_featured ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Featured
          </span>
        ) : null}
        </div>
        <span className="font-serif text-4xl text-[#d8dfcb]">{String(index + 1).padStart(2, "0")}</span>
      </div>

      <h2 className="mt-7 font-serif text-3xl leading-tight text-[#26311f]">{service.name}</h2>

      {service.summary ? (
        <p className="mt-4 text-sm leading-7 text-[#59654d]">{service.summary}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#59654d]">
        {service.service_format ? (
          <span className="rounded-full bg-[#f0f3eb] px-3 py-1">{service.service_format}</span>
        ) : null}

        {service.duration_minutes ? (
          <span className="rounded-full bg-[#f0f3eb] px-3 py-1">
            {service.duration_minutes} minutes
          </span>
        ) : null}

        {price ? <span className="rounded-full bg-[#f0f3eb] px-3 py-1">{price}</span> : null}
      </div>

      <Link
        to={`/services/${service.slug}`}
        className="mt-7 inline-flex w-fit rounded-full bg-[#26311f] px-6 py-3 text-sm font-semibold text-white transition group-hover:bg-[#556b2f]"
      >
        View service
      </Link>
    </article>
  );
}
