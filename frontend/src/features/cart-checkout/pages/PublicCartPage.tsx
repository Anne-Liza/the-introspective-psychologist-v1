import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router";

import {
  fetchPublicCommerceItems,
  resolveCommerceItemImageUrl,
} from "../../commerce-core/lib/commerceCoreApi";
import { formatMoney } from "../lib/cart";
import { useCart } from "../lib/cartStore";

export function PublicCartPage() {
  const { lines, itemCount, setQuantity, removeItem } = useCart();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-commerce-items"],
    queryFn: fetchPublicCommerceItems,
  });

  const itemsById = new Map((data || []).map((item) => [item.id, item]));
  const resolvedLines = lines.map((line) => ({ ...line, item: itemsById.get(line.commerce_item_id) }));
  const availableLines = resolvedLines.filter((line) => line.item);
  const unavailableLines = resolvedLines.filter((line) => !line.item);
  const hasStockIssue = resolvedLines.some(
    (line) =>
      line.item?.stock_quantity !== null &&
      line.item?.stock_quantity !== undefined &&
      line.quantity > line.item.stock_quantity,
  );
  const currencies = new Set(availableLines.map((line) => line.item?.currency));
  const currency = availableLines[0]?.item?.currency || "KES";
  const subtotal = availableLines.reduce(
    (total, line) => total + Number(line.item?.price_amount || 0) * line.quantity,
    0,
  );
  const canCheckout =
    availableLines.length > 0 &&
    unavailableLines.length === 0 &&
    !hasStockIssue &&
    currencies.size === 1;

  if (!lines.length) {
    return (
      <main className="bg-[#fbfaf5]">
        <section className="mx-auto flex min-h-[32rem] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef2e7] text-[#556b2f]">
            <ShoppingBag aria-hidden="true" className="h-7 w-7" />
          </span>
          <h1 className="mt-6 font-serif text-5xl text-[#26311f]">Your cart is empty.</h1>
          <p className="mt-4 max-w-xl leading-7 text-[#5f6d54]">
            Explore the store to find resources, workshops, and support packages from the practice.
          </p>
          <Link to="/store" className="mt-7 rounded-full bg-[#556b2f] px-6 py-3 font-semibold text-white">
            Browse the store
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-[#fbfaf5]">
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6a7a4e]">Your cart</p>
        <h1 className="mt-3 font-serif text-5xl tracking-[-0.04em] text-[#26311f]">Review your selections.</h1>
        <p className="mt-4 text-[#5f6d54]">{itemCount} item{itemCount === 1 ? "" : "s"} in your cart.</p>

        {isLoading ? (
          <p className="mt-10 rounded-3xl border border-[#dfe5d6] bg-white p-6 text-[#5f6d54]">Loading your cart…</p>
        ) : isError ? (
          <p className="mt-10 rounded-3xl border border-[#ead4cd] bg-[#fff8f5] p-6 text-[#7a4538]">
            Your cart could not be checked against the current catalogue. Please try again.
          </p>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
            <div className="space-y-4">
              {resolvedLines.map((line) => (
                <article key={line.commerce_item_id} className="grid gap-5 rounded-[2rem] border border-[#dfe5d6] bg-white p-5 shadow-sm sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                  {line.item?.image_url ? (
                    <img
                      src={
                        resolveCommerceItemImageUrl(
                          line.item.image_url,
                        ) ?? ""
                      }
                      alt=""
                      className="aspect-square w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full rounded-2xl bg-[linear-gradient(145deg,_#e6ecdc,_#f7f1e7)]" />
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7a4e]">
                      {line.item?.category || "Unavailable item"}
                    </p>
                    <h2 className="mt-2 font-serif text-2xl text-[#26311f]">
                      {line.item?.name || "This item is no longer available"}
                    </h2>
                    {line.item ? (
                      <>
                        <p className="mt-2 text-sm font-semibold text-[#52623d]">
                          {formatMoney(line.item.price_amount, line.item.currency)} each
                        </p>
                        {line.item.stock_quantity !== null && line.quantity > line.item.stock_quantity ? (
                          <p className="mt-2 text-sm text-[#8b4a3a]">
                            Only {line.item.stock_quantity} currently available. Reduce the quantity or remove this item.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[#8b4a3a]">Remove this item before checkout.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    {line.item ? (
                      <div className="flex items-center rounded-full border border-[#cbd5ba] bg-[#fbfaf5] p-1">
                        <button type="button" aria-label={`Decrease ${line.item.name} quantity`} onClick={() => setQuantity(line.commerce_item_id, line.quantity - 1)} className="rounded-full p-2 hover:bg-[#e7ecdf]">
                          <Minus aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold">{line.quantity}</span>
                        <button type="button" aria-label={`Increase ${line.item.name} quantity`} onClick={() => setQuantity(line.commerce_item_id, line.quantity + 1)} disabled={line.item.stock_quantity !== null && line.quantity >= line.item.stock_quantity} className="rounded-full p-2 hover:bg-[#e7ecdf] disabled:cursor-not-allowed disabled:opacity-40">
                          <Plus aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                    <button type="button" onClick={() => removeItem(line.commerce_item_id)} className="inline-flex items-center gap-1.5 p-2 text-xs font-semibold text-[#7a4538]">
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <aside className="rounded-[2rem] bg-[#26311f] p-7 text-white lg:sticky lg:top-28">
              <h2 className="font-serif text-3xl">Order summary</h2>
              <div className="mt-6 flex justify-between border-t border-white/20 pt-5">
                <span className="text-[#dfe5d6]">Subtotal</span>
                <strong>{formatMoney(subtotal, currency)}</strong>
              </div>
              <p className="mt-4 text-xs leading-6 text-[#cbd5ba]">
                Final prices are verified securely against the catalogue when you submit checkout.
              </p>
              {currencies.size > 1 ? (
                <p className="mt-4 rounded-xl bg-[#fff3cd] p-3 text-xs leading-5 text-[#5f4810]">
                  Items using different currencies cannot be checked out together.
                </p>
              ) : null}
              {canCheckout ? (
                <Link to="/checkout" className="mt-6 flex w-full justify-center rounded-full bg-white px-5 py-3 font-semibold text-[#26311f]">
                  Continue to checkout
                </Link>
              ) : (
                <span className="mt-6 flex w-full justify-center rounded-full bg-white/20 px-5 py-3 font-semibold text-white/70">
                  Resolve cart to continue
                </span>
              )}
              <Link to="/store" className="mt-4 flex justify-center text-sm font-semibold text-[#dfe5d6]">
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
