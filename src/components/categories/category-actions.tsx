"use client";

import { useEffect, useRef, useState } from "react";
import { deleteCategory } from "@/lib/actions/category";

type Props = {
  categoryId: string;
  categoryName: string;
  onEdit?: () => void;
};

export function CategoryActions({
  categoryId,
  categoryName,
  onEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  async function handleDelete() {
    setOpen(false);

    const confirmed = window.confirm(
      `Delete category "${categoryName}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteCategory(categoryId);
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete category.";

      window.alert(message);
    }
  }

  return (
    <div
      ref={ref}
      className="relative inline-block"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-gray-100"
        aria-label={`Actions for ${categoryName}`}
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit?.();
            }}
            className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
          >
            ✏️ Edit
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
          >
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  );
}