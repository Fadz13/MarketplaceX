"use client";

import { useTransition } from "react";
import { deleteCategory } from "@/lib/actions/category";

type Props = {
  open: boolean;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
};

export function DeleteCategoryModal({
  open,
  categoryId,
  categoryName,
  onClose,
}: Props) {
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function handleDelete() {
    startTransition(async () => {
      await deleteCategory(categoryId);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded-2xl bg-white p-6 shadow-xl">

        <h2 className="text-xl font-bold">
          Delete Category
        </h2>

        <p className="mt-3 text-sm text-gray-500">
          Are you sure you want to delete
          <span className="font-semibold text-black">
            {" "}
            {categoryName}
          </span>
          ?
        </p>

        <p className="mt-2 text-sm text-red-500">
          This action cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-3">

          <button
            onClick={onClose}
            className="rounded-lg border px-5 py-2"
          >
            Cancel
          </button>

          <button
            disabled={pending}
            onClick={handleDelete}
            className="rounded-lg bg-red-600 px-5 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Deleting..." : "Delete"}
          </button>

        </div>

      </div>
    </div>
  );
}