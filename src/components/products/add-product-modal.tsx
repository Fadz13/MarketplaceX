"use client";

import { useState, useTransition } from "react";
import { createProduct } from "@/lib/actions/product";

type Category = {
  id: string;
  name: string;
};

type Brand = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  brands: Brand[];
};

export function AddProductModal({
  open,
  onClose,
  categories,
  brands,
}: Props) {
  const [pending, startTransition] =
    useTransition();

  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  function handleSubmit(formData: FormData) {
    setError("");

    startTransition(async () => {
      try {
        await createProduct(formData);
        onClose();
        window.location.reload();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to create product.",
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Add Product
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Create a new product for MarketplaceX.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            action={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Product Name
              </label>

              <input
                name="name"
                required
                placeholder="Example: iPhone 16 Pro"
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Category
                </label>

                <select
                  name="category_id"
                  defaultValue=""
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm"
                >
                  <option value="">
                    No category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Brand
                </label>

                <select
                  name="brand_id"
                  defaultValue=""
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm"
                >
                  <option value="">
                    No brand
                  </option>

                  {brands.map((brand) => (
                    <option
                      key={brand.id}
                      value={brand.id}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>

              <textarea
                name="description"
                rows={3}
                disabled={pending}
                className="w-full resize-none rounded-lg border px-3.5 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Price
                </label>

                <input
                  name="price"
                  type="number"
                  min="1"
                  required
                  disabled={pending}
                  className="w-full rounded-lg border px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Discount Price
                </label>

                <input
                  name="discount_price"
                  type="number"
                  min="0"
                  disabled={pending}
                  className="w-full rounded-lg border px-3.5 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Stock
                </label>

                <input
                  name="stock"
                  type="number"
                  min="0"
                  defaultValue="0"
                  disabled={pending}
                  className="w-full rounded-lg border px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Condition
                </label>

                <select
                  name="condition"
                  defaultValue="new"
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm"
                >
                  <option value="new">
                    New
                  </option>
                  <option value="used">
                    Used
                  </option>
                  <option value="refurbished">
                    Refurbished
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Status
                </label>

                <select
                  name="status"
                  defaultValue="draft"
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm"
                >
                  <option value="draft">
                    Draft
                  </option>
                  <option value="active">
                    Active
                  </option>
                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
              >
                {pending
                  ? "Creating..."
                  : "Create Product"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}