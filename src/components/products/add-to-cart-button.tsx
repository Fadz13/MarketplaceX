"use client";

import { useState } from "react";
import { addToCart } from "@/lib/actions/cart";

type Props = {
  productId: string;
  stock: number;
};

export function AddToCartButton({
  productId,
  stock,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function handleAdd() {
    setLoading(true);
    setMessage("");

    try {
      await addToCart(
        productId,
        1,
      );

      setMessage(
        "Product added to cart.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to add product.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-3">
      <button
        type="button"
        disabled={
          loading || stock <= 0
        }
        onClick={() =>
          void handleAdd()
        }
        className="w-full rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading
          ? "Adding..."
          : stock > 0
            ? "Add to Cart"
            : "Out of Stock"}
      </button>

      {message && (
        <p className="text-sm text-gray-600">
          {message}
        </p>
      )}
    </div>
  );
}