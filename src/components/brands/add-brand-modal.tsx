"use client";

import { useState, useTransition } from "react";
import { createBrand } from "@/lib/actions/brand";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AddBrandModal({
  open,
  onClose,
}: Props) {
  const [pending, startTransition] =
    useTransition();

  const [error, setError] = useState("");

  if (!open) return null;

  function handleSubmit(formData: FormData) {
    setError("");

    startTransition(async () => {
      try {
        await createBrand(formData);

        onClose();
        window.location.reload();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to create brand.",
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
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Add Brand
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Create a new product brand.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            action={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Brand Name
              </label>

              <input
                name="name"
                required
                placeholder="Example: Razer"
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>

              <textarea
                name="description"
                rows={3}
                disabled={pending}
                className="w-full resize-none rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Logo URL
              </label>

              <input
                name="logo_url"
                type="url"
                placeholder="https://..."
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Website
              </label>

              <input
                name="website"
                type="url"
                placeholder="https://..."
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_verified"
                disabled={pending}
              />
              Verified brand
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked
                disabled={pending}
              />
              Active
            </label>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                {pending
                  ? "Saving..."
                  : "Save Brand"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}