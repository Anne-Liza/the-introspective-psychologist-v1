import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import type { CommerceItem } from "../../commerce-core/lib/commerceCoreApi";
import { formatMoney } from "../lib/cart";
import { AddToCartButton } from "./AddToCartButton";

export function CommerceItemCard({ item }: { item: CommerceItem }) {
  const unavailable = item.stock_quantity === 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#dfe5d6] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      {item.image_url ? (
        <img src={item.image_url} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] bg-[radial-gradient(circle_at_top_left,_#cdd8ba,_transparent_38%),linear-gradient(145deg,_#edf1e6,_#f7f1e7)]" />
      )}

      <div className="flex flex-1 flex-col p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7a4e]">
            {item.category || item.item_type}
          </p>
          {unavailable ? (
            <span className="rounded-full bg-[#f2eadb] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#765f37]">
              Coming soon
            </span>
          ) : item.is_featured ? (
            <span className="rounded-full bg-[#eef2e7] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#52623d]">
              Featured
            </span>
          ) : null}
        </div>

        <h2 className="mt-4 font-serif text-3xl leading-tight text-[#26311f]">
          <Link to={`/store/${item.slug}`} className="transition group-hover:text-[#556b2f]">
            {item.name}
          </Link>
        </h2>

        {item.summary ? (
          <p className="mt-4 line-clamp-3 text-sm leading-7 text-[#5f6d54]">{item.summary}</p>
        ) : null}

        <p className="mt-5 text-lg font-semibold text-[#26311f]">
          {formatMoney(item.price_amount, item.currency)}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          <AddToCartButton commerceItemId={item.id} disabled={unavailable} disabledLabel="Coming soon" />
          <Link
            to={`/store/${item.slug}`}
            className="inline-flex items-center gap-1.5 px-2 py-3 text-sm font-semibold text-[#4e642c]"
          >
            Details <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
