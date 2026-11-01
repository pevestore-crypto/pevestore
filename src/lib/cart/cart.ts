"use client";

import { useSyncExternalStore } from "react";

/**
 * Carrito del visitante, guardado en su navegador. No contiene precios:
 * el servidor los calcula siempre desde la base de datos.
 */
export type CustomizationMode = "own_design" | "gallery" | "idea";

export interface CartItem {
  key: string;
  productId: string;
  slug: string;
  name: string;
  imagePath: string | null;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  mode: CustomizationMode | null;
}

const KEY = "pevestore-cart";
const EVENT = "pevestore-cart-change";
const EMPTY: CartItem[] = [];
let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };

function read(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.items;
  let items: CartItem[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) items = parsed.filter((i) => i && typeof i.productId === "string" && Number.isInteger(i.quantity)).slice(0, 30);
  } catch {
    items = EMPTY;
  }
  cache = { raw, items };
  return items;
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado): el carrito dura solo en esta página.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const cart = {
  add(item: Omit<CartItem, "key">) {
    const items = read();
    const same = items.find((i) => i.productId === item.productId && i.variantId === item.variantId && i.mode === item.mode);
    if (same) {
      write(items.map((i) => (i === same ? { ...i, quantity: i.quantity + item.quantity } : i)));
    } else {
      write([...items, { ...item, key: crypto.randomUUID() }]);
    }
  },
  update(key: string, patch: Partial<Pick<CartItem, "quantity" | "mode">>) {
    write(read().map((i) => (i.key === key ? { ...i, ...patch } : i)));
  },
  remove(key: string) {
    write(read().filter((i) => i.key !== key));
  },
  clear() {
    write([]);
  },
};
