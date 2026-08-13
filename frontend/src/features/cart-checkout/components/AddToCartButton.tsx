import { Check, ShoppingBag } from "lucide-react";
import { useState } from "react";

import { useCart } from "../lib/cartStore";

type AddToCartButtonProps = {
  commerceItemId: string;
  disabled?: boolean;
  disabledLabel?: string;
  className?: string;
};

export function AddToCartButton({ commerceItemId, disabled, disabledLabel = "Unavailable", className = "" }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addItem(commerceItemId);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#556b2f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#465a27] focus:outline-none focus:ring-4 focus:ring-[#c8d3b1] disabled:cursor-not-allowed disabled:bg-[#aab49a] ${className}`}
    >
      {added ? <Check aria-hidden="true" className="h-4 w-4" /> : <ShoppingBag aria-hidden="true" className="h-4 w-4" />}
      {disabled ? disabledLabel : added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
