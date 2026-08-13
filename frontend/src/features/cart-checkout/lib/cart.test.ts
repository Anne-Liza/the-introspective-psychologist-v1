import { describe, expect, it } from "vitest";

import { cartItemCount, normalizeCartLines } from "./cart";

describe("cart helpers", () => {
  it("keeps only item identifiers and bounded quantities", () => {
    expect(
      normalizeCartLines([
        { commerce_item_id: "item-1", quantity: 2, customer_email: "private@example.com" },
        { commerce_item_id: "item-2", quantity: 101 },
        { commerce_item_id: "", quantity: 1 },
        { commerce_item_id: "item-3", quantity: 0 },
        { commerce_item_id: "item-4", quantity: Number.NaN },
      ]),
    ).toEqual([
      { commerce_item_id: "item-1", quantity: 2 },
      { commerce_item_id: "item-2", quantity: 100 },
    ]);
  });

  it("merges duplicate item identifiers", () => {
    const lines = normalizeCartLines([
      { commerce_item_id: "item-1", quantity: 2 },
      { commerce_item_id: "item-1", quantity: 3 },
    ]);

    expect(lines).toEqual([{ commerce_item_id: "item-1", quantity: 5 }]);
    expect(cartItemCount(lines)).toBe(5);
  });
});
