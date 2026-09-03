import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { Link, useParams } from "react-router";

import {
  fetchPublicCommerceItem,
  resolveCommerceItemImageUrl,
} from "../../commerce-core/lib/commerceCoreApi";
import { AddToCartButton } from "../components/AddToCartButton";
import { formatMoney } from "../lib/cart";

const fulfillmentLabels: Record<string, string> = {
  digital: "Digital delivery",
  physical: "Physical delivery",
  service: "Service provided by the practice",
  session_package: "Session package",
  manual: "Delivery arranged by the practice",
};

export function PublicStoreItemPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-commerce-item", slug],
    queryFn: () => fetchPublicCommerceItem(slug || ""),
    enabled: Boolean(slug),
  });

  if (isLoading) {
    return <main className="mx-auto max-w-7xl px-5 py-20 text-[#5f6d54]">Loading item…</main>;
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-20">
        <h1 className="font-serif text-4xl text-[#26311f]">Item not found</h1>
        <Link to="/store" className="mt-6 inline-flex font-semibold text-[#4e642c] underline">
          Return to the store
        </Link>
      </main>
    );
  }

  const unavailable = data.stock_quantity === 0;
  const imageUrl =
    resolveCommerceItemImageUrl(
      data.image_url,
    );

  return (
    <main className="bg-[#fbfaf5]">
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-20">
        <Link to="/store" className="inline-flex items-center gap-2 text-sm font-semibold text-[#4e642c]">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to the store
        </Link>

        <div className="mt-8 grid overflow-hidden rounded-[2.5rem] border border-[#dfe5d6] bg-white shadow-sm lg:grid-cols-2">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="min-h-[28rem] h-full w-full object-cover" />
          ) : (
            <div className="min-h-[28rem] bg-[radial-gradient(circle_at_top_left,_#cdd8ba,_transparent_38%),linear-gradient(145deg,_#edf1e6,_#f7f1e7)]" />
          )}

          <div className="p-8 md:p-12 lg:p-14">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#6a7a4e]">
              {data.category || data.item_type}
            </p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.04] tracking-[-0.04em] text-[#26311f]">
              {data.name}
            </h1>
            {data.summary ? <p className="mt-6 text-xl leading-9 text-[#5f6d54]">{data.summary}</p> : null}
            <p className="mt-7 text-2xl font-semibold text-[#26311f]">
              {formatMoney(data.price_amount, data.currency)}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <AddToCartButton commerceItemId={data.id} disabled={unavailable} disabledLabel="Coming soon" className="px-7 py-3.5" />
              <Link to="/cart" className="rounded-full border border-[#cbd5ba] px-6 py-3 text-sm font-semibold text-[#26311f]">
                View cart
              </Link>
            </div>

            {data.description ? (
              <div className="mt-10 border-t border-[#e2e7da] pt-8">
                <h2 className="font-serif text-2xl text-[#26311f]">About this item</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#5f6d54]">{data.description}</p>
              </div>
            ) : null}

            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-[#f1f4eb] p-4 text-sm text-[#52623d]">
              <PackageCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{fulfillmentLabels[data.fulfillment_type] || fulfillmentLabels.manual}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
