import { ShoppingBag } from "lucide-react";
import { Link } from "react-router";

import { useCart } from "../lib/cartStore";

export function CartLink() {
  const { itemCount } = useCart();

  return (
    <Link
      to="/cart"
      aria-label={`Shopping cart with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#cbd5ba] bg-white text-[#26311f] transition hover:border-[#556b2f] hover:bg-[#f1f4eb] focus:outline-none focus:ring-4 focus:ring-[#c8d3b1]"
    >
      <ShoppingBag aria-hidden="true" className="h-5 w-5" />
      {itemCount ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#556b2f] px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}
