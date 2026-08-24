"use client";

import { useMemo, useState } from "react";
import { CategoryTable } from "./category-table";
import { CategoryToolbar } from "./category-toolbar";
import { AddCategoryModal } from "./add-category-modal";

type ParentCategory = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  parent_id: string | null;
  parent: ParentCategory | null;
  status: "active" | "inactive";
  depth: number;
};

type Props = {
  categories: Category[];
};

const ITEMS_PER_PAGE = 10;

export function CategoriesClient({ categories }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] =
    useState<"all" | "active" | "inactive">("all");

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        !keyword ||
        category.name.toLowerCase().includes(keyword) ||
        category.slug.toLowerCase().includes(keyword);

      const matchesStatus =
        status === "all" ||
        category.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, status]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / ITEMS_PER_PAGE),
  );

  const currentPage = Math.min(page, totalPages);

  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(
    value: "all" | "active" | "inactive",
  ) {
    setStatus(value);
    setPage(1);
  }

  const start =
    filtered.length === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const end = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filtered.length,
  );

  return (
    <div className="space-y-6">
      <CategoryToolbar
        onSearch={handleSearch}
        onStatusChange={handleStatusChange}
        onAddClick={() => setOpen(true)}
        status={status}
      />

    <CategoryTable categories={paginated} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {start}-{end} of {filtered.length} categories
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() =>
              setPage((value) => value - 1)
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from(
              { length: totalPages },
              (_, index) => index + 1,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`h-9 min-w-9 rounded-lg px-3 text-sm ${
                  currentPage === pageNumber
                    ? "bg-black text-white"
                    : "border hover:bg-gray-100"
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() =>
              setPage((value) => value + 1)
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <AddCategoryModal
        open={open}
        onClose={() => setOpen(false)}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          parent_id: category.parent_id,
          depth: category.depth,
        }))}
      />
    </div>
  );
}