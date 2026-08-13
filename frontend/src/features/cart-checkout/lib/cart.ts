export const MAX_CART_ITEM_QUANTITY = 100;

export type CartLine = {
  commerce_item_id: string;
  quantity: number;
};

export function normalizeCartLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const quantities = new Map<string, number>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const itemId = "commerce_item_id" in candidate ? candidate.commerce_item_id : null;
    const quantity = "quantity" in candidate ? candidate.quantity : null;
    if (
      typeof itemId !== "string" ||
      !itemId.trim() ||
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      continue;
    }

    const normalizedQuantity = Math.min(
      MAX_CART_ITEM_QUANTITY,
      Math.max(1, Math.floor(quantity)),
    );
    const existing = quantities.get(itemId) || 0;
    quantities.set(
      itemId,
      Math.min(MAX_CART_ITEM_QUANTITY, existing + normalizedQuantity),
    );
  }

  return Array.from(quantities, ([commerce_item_id, quantity]) => ({
    commerce_item_id,
    quantity,
  }));
}

export function cartItemCount(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function formatMoney(amount: string | number, currency: string) {
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
}
