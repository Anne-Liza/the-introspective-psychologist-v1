import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { DataState } from "../../../components/data/DataState";
import { fetchPublicService, Service } from "../lib/servicesApi";

function formatPrice(service: Service) {
  if (service.price_amount === null || service.price_amount === undefined || service.price_amount === "") {
    return null;
  }

  const amount = Number(service.price_amount);
  if (Number.isNaN(amount)) return null;

  return `${service.currency || "KES"} ${amount.toLocaleString()}`;
}

function serviceCtaUrl(service: Service) {
  const configured = service.cta_url;

  if (!configured) {
    return null;
  }

  if (
    configured === "/book" ||
    configured === "/book/"
  ) {
    return `/book?service=${encodeURIComponent(
      service.slug,
    )}`;
  }

  return configured;
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-7 text-slate-700">{value}</p>
    </div>
  );
}

export function PublicServiceDetailPage() {
  const { slug } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-service", slug],
    queryFn: () => fetchPublicService(slug ?? ""),
    enabled: Boolean(slug),
  });

  const showState = isLoading || isError || !data;
  const price = data ? formatPrice(data) : null;

  return (
    <main className="bg-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
        <Link to="/services" className="text-sm font-medium text-slate-600 hover:underline">
          ← Back to services
        </Link>

        <div className="mt-8">
          {showState ? (
            <DataState isLoading={isLoading} isError={isError} empty={!data} />
          ) : (
            <article className="rounded-[2rem] border bg-white p-8 shadow-sm md:p-12 lg:p-16">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {data.category || "Service"}
              </p>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                {data.name}
              </h1>

              {data.summary ? (
                <p className="mt-8 text-xl leading-9 text-slate-700">{data.summary}</p>
              ) : null}

              <div className="mt-10 grid gap-6 rounded-3xl border bg-slate-50 p-6 md:grid-cols-2">
                <DetailRow label="Format" value={data.service_format} />
                <DetailRow
                  label="Duration"
                  value={data.duration_minutes ? `${data.duration_minutes} minutes` : null}
                />
                <DetailRow label="Price" value={price} />
                <DetailRow label="Status" value={data.is_featured ? "Featured" : null} />
              </div>

              {data.description ? (
                <div className="mt-10 whitespace-pre-line text-base leading-8 text-slate-700">
                  {data.description}
                </div>
              ) : null}

              <div className="mt-10 flex flex-wrap gap-4">
                {serviceCtaUrl(data)?.startsWith("/") ? (
                  <Link
                    to={serviceCtaUrl(data) ?? "/book"}
                    className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
                  >
                    {data.cta_label ||
                      "Book this service"}
                  </Link>
                ) : serviceCtaUrl(data) ? (
                  <a
                    href={serviceCtaUrl(data) ?? undefined}
                    className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
                  >
                    {data.cta_label ||
                      "Book this service"}
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
                This service page is for general information only. Booking, payment, intake,
                consent, and client-record workflows are handled through separate modules.
              </p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
