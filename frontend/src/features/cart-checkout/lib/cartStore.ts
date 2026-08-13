import { useSyncExternalStore } from "react";

import {
  cartItemCount,
  MAX_CART_ITEM_QUANTITY,
  normalizeCartLines,
  type CartLine,
} from "./cart";

const STORAGE_KEY = "launchkit_public_cart_v1";
const EMPTY_CART: CartLine[] = [];
const listeners = new Set<() => void>();

function readStoredCart(): CartLine[] {
  if (typeof window === "undefined") {
    return EMPTY_CART;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeCartLines(JSON.parse(stored)) : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

let currentCart = readStoredCart();
let listensForStorage = false;

function emit(nextCart: CartLine[]) {
  currentCart = normalizeCartLines(nextCart);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCart));
    } catch {
      // Keep the in-memory cart usable when browser storage is unavailable.
    }
  }
  listeners.forEach((listener) => listener());
}

function ensureStorageListener() {
  if (listensForStorage || typeof window === "undefined") {
    return;
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    currentCart = readStoredCart();
    listeners.forEach((listener) => listener());
  });
  listensForStorage = true;
}

function subscribe(listener: () => void) {
  ensureStorageListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentCart;
}

function getServerSnapshot() {
  return EMPTY_CART;
}

export function addCartItem(commerceItemId: string, quantity = 1) {
  const existing = currentCart.find((line) => line.commerce_item_id === commerceItemId);
  if (existing) {
    emit(
      currentCart.map((line) =>
        line.commerce_item_id === commerceItemId
          ? {
              ...line,
              quantity: Math.min(MAX_CART_ITEM_QUANTITY, line.quantity + quantity),
            }
          : line,
      ),
    );
    return;
  }

  emit([...currentCart, { commerce_item_id: commerceItemId, quantity }]);
}

export function setCartItemQuantity(commerceItemId: string, quantity: number) {
  if (quantity <= 0) {
    removeCartItem(commerceItemId);
    return;
  }

  emit(
    currentCart.map((line) =>
      line.commerce_item_id === commerceItemId
        ? { ...line, quantity: Math.min(MAX_CART_ITEM_QUANTITY, Math.floor(quantity)) }
        : line,
    ),
  );
}

export function removeCartItem(commerceItemId: string) {
  emit(currentCart.filter((line) => line.commerce_item_id !== commerceItemId));
}

export function clearCart() {
  emit([]);
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    lines,
    itemCount: cartItemCount(lines),
    addItem: addCartItem,
    setQuantity: setCartItemQuantity,
    removeItem: removeCartItem,
    clear: clearCart,
  };
}
