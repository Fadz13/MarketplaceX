"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCategory } from "@/lib/actions/category";

type ParentOption = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  categories: ParentOption[];
  onClose: () => void;
};

export function AddCategoryModal({
  open,
  categories,
  onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5">
          <h2 className="text-xl font-bold">
            Add Category
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create a new category.
          </p>
        </div>

        <form
          action={(formData) => {
            setError(null);

            startTransition(async () => {
              try {
                await createCategory(formData);

                router.refresh();
                onClose();
              } catch (caughtError) {
                setError(
                  caughtError instanceof Error
                    ? caughtError.message
                    : "Category gagal dibuat.",
                );
              }
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Category Name
            </label>

            <input
              name="name"
              required
              disabled={pending}
              placeholder="Example: Smartphones"
              className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Parent Category
            </label>

            <select
              name="parent_id"
              disabled={pending}
              defaultValue=""
              className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
            >
              <option value="">
                None
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
              Status
            </label>

            <select
              name="status"
              disabled={pending}
              defaultValue="active"
              className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
            >
              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {pending
                ? "Saving..."
                : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}