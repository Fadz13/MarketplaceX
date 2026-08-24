"use client";

import { useState, useTransition } from "react";
import {
  deleteProductImage,
  setPrimaryProductImage,
  uploadProductImage,
} from "@/lib/actions/product";

type ProductImage = {
  id: string;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
};

type Props = {
  productId: string;
  images: ProductImage[];
  onImagesChange?: () => void;
};

export function ProductImages({
  productId,
  images,
  onImagesChange,
}: Props) {
  const [pending, startTransition] =
    useTransition();

  const [error, setError] = useState("");

  function refreshImages() {
    onImagesChange?.();
  }

  function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      try {
        await uploadProductImage(
          productId,
          formData,
        );

        refreshImages();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to upload image.",
        );
      }
    });
  }

  function handleSetPrimary(
    imageId: string,
  ) {
    setError("");

    startTransition(async () => {
      try {
        await setPrimaryProductImage(
          imageId,
        );

        refreshImages();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to set primary image.",
        );
      }
    });
  }

  function handleDelete(imageId: string) {
    const confirmed = window.confirm(
      "Delete this product image?",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        await deleteProductImage(imageId);

        refreshImages();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to delete image.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label
          className={`inline-flex cursor-pointer items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 ${
            pending
              ? "cursor-not-allowed opacity-50"
              : ""
          }`}
        >
          {pending
            ? "Processing..."
            : "Upload Image"}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleUpload}
            disabled={pending}
          />
        </label>

        <p className="mt-2 text-xs text-gray-500">
          JPG, PNG, WEBP, or GIF. Maximum 6 MB.
        </p>
      </div>

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
          No product images yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="overflow-hidden rounded-xl border bg-gray-50"
            >
              <div className="relative">
                <img
                  src={image.image_url}
                  alt="Product"
                  className="aspect-square w-full object-cover"
                />

                {image.is_primary && (
                  <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-1 text-xs font-medium text-white">
                    Primary
                  </span>
                )}
              </div>

              <div className="flex gap-2 p-2">
                {!image.is_primary && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSetPrimary(image.id)
                    }
                    disabled={pending}
                    className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
                  >
                    Set Primary
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    handleDelete(image.id)
                  }
                  disabled={pending}
                  className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}