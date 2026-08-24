"use client";

import { useState, useTransition } from "react";
import { updateBrand } from "@/lib/actions/brand";

type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  open: boolean;
  brand: Brand | null;
  onClose: () => void;
};

export function EditBrandModal({
  open,
  brand,
  onClose,
}: Props) {
  const [pending, startTransition] =
    useTransition();

  const [error, setError] = useState("");

  if (!open || !brand) {
    return null;
  }

  const brandId = brand.id;

  function handleSubmit(formData: FormData) {
    setError("");

    startTransition(async () => {
      try {
        await updateBrand(
          brandId,
          formData,
        );

        onClose();
        window.location.reload();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to update brand.",
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
              Edit Brand
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Update brand information.
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
                defaultValue={brand.name}
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>

              <textarea
                name="description"
                rows={3}
                defaultValue={
                  brand.description ?? ""
                }
                disabled={pending}
                className="w-full resize-none rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Logo URL
              </label>

              <input
                name="logo_url"
                type="url"
                defaultValue={
                  brand.logo_url ?? ""
                }
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Website
              </label>

              <input
                name="website"
                type="url"
                defaultValue={
                  brand.website ?? ""
                }
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_verified"
                defaultChecked={
                  brand.is_verified
                }
                disabled={pending}
              />
              Verified brand
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={
                  brand.is_active
                }
                disabled={pending}
              />
              Active
            </label>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {pending
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}