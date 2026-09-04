"use client";

import { useState } from "react";
import Link from "next/link";
import {
  updateCartItemQuantity,
  removeCartItem,
} from "@/lib/actions/cart";
import type { CartItem } from "@/lib/actions/cart";

type Props = {
  items: CartItem[];
  total: number;
};

export function CartPageClient({
  items: initialItems,
  total: initialTotal,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function recalculate(newItems: CartItem[]) {
    return newItems.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
  }

  async function handleQuantityChange(
    cartItemId: string,
    newQuantity: number,
  ) {
    const item = items.find((i) => i.id === cartItemId);
    if (!item) return;

    if (newQuantity < 1) return;

    if (newQuantity > item.product_stock) {
      setMessage(`Only ${item.product_stock} item(s) available.`);
      return;
    }

    setLoadingId(cartItemId);
    setMessage("");

    try {
      await updateCartItemQuantity(cartItemId, newQuantity);

      const updated = items.map((i) =>
        i.id === cartItemId ? { ...i, quantity: newQuantity } : i,
      );
      setItems(updated);
      setTotal(recalculate(updated));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to update.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(cartItemId: string) {
    setLoadingId(cartItemId);
    setMessage("");

    try {
      await removeCartItem(cartItemId);

      const updated = items.filter((i) => i.id !== cartItemId);
      setItems(updated);
      setTotal(recalculate(updated));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to remove.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center">
        <p className="text-gray-500">Keranjang kosong.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-sm text-white"
        >
          Belanja Sekarang
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {message}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const isUpdating = loadingId === item.id;

          return (
            <div
              key={item.id}
              className="flex gap-4 rounded-2xl border bg-white p-4"
            >
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                {item.product_image_url ? (
                  <img
                    src={item.product_image_url}
                    alt={item.product_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    No image
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="text-xs text-gray-500">
                    {item.store_name ?? "MarketplaceX Store"}
                  </p>
                  <Link
                    href={`/products/${item.product_id}`}
                    className="mt-0.5 line-clamp-1 font-medium hover:underline"
                  >
                    {item.product_name}
                  </Link>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="font-bold">
                    Rp{" "}
                    {item.unit_price.toLocaleString("id-ID")}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUpdating || item.quantity <= 1}
                      onClick={() =>
                        void handleQuantityChange(
                          item.id,
                          item.quantity - 1,
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded border text-sm disabled:opacity-40"
                    >
                      -
                    </button>

                    <span className="w-8 text-center text-sm">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      disabled={
                        isUpdating ||
                        item.quantity >= item.product_stock
                      }
                      onClick={() =>
                        void handleQuantityChange(
                          item.id,
                          item.quantity + 1,
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded border text-sm disabled:opacity-40"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        void handleRemove(item.id)
                      }
                      className="ml-2 text-sm text-red-500 hover:underline disabled:opacity-40"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-xl font-bold">
            Rp {total.toLocaleString("id-ID")}
          </span>
        </div>

        <Link
          href="/checkout"
          className="mt-4 block w-full rounded-lg bg-black py-3 text-center font-semibold text-white hover:bg-gray-800"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
