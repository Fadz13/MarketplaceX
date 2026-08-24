"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateCategory } from "@/lib/actions/category";

export type EditableCategory = {
  id: string;
  name: string;
  parent_id: string | null;
  status: string;
};

type ParentOption = {
  id: string;
  name: string;
};

type Props = {
  category: EditableCategory | null;
  categories: ParentOption[];
  onClose: () => void;
};

export function EditCategoryModal({ category, categories, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [category]);

  if (!category) return null;

  const parentOptions = categories.filter((item) => item.id !== category.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Edit Category</h2>
          <p className="text-sm text-gray-500">Ubah nama, parent, atau status kategori.</p>
        </div>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              try {
                await updateCategory(category.id, formData);
                router.refresh();
                onClose();
              } catch (caughtError) {
                setError(
                  caughtError instanceof Error
                    ? caughtError.message
                    : "Category gagal diperbarui."
                );
              }
            });
          }}
          className="space-y-5"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">Category Name</label>
            <input
              name="name"
              defaultValue={category.name}
              required
              disabled={pending}
              className="w-full rounded-lg border px-4 py-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Parent Category</label>
            <select
              name="parent_id"
              defaultValue={category.parent_id ?? ""}
              disabled={pending}
              className="w-full rounded-lg border px-4 py-2 disabled:bg-gray-100"
            >
              <option value="">None</option>
              {parentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select
              name="status"
              defaultValue={category.status}
              disabled={pending}
              className="w-full rounded-lg border px-4 py-2 disabled:bg-gray-100"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border px-4 py-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              className="rounded-lg bg-black px-5 py-2 text-white disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
