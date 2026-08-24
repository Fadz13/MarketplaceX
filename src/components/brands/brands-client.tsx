"use client";

import { useMemo, useState } from "react";
import {
  BrandTable,
  type Brand,
} from "./brand-table";
import { BrandToolbar } from "./brand-toolbar";
import { AddBrandModal } from "./add-brand-modal";
import { EditBrandModal } from "./edit-brand-modal";
import { deleteBrand } from "@/lib/actions/brand";

type Props = {
  brands: Brand[];
};

const ITEMS_PER_PAGE = 10;

type BrandFilter =
  | "all"
  | "active"
  | "inactive"
  | "verified";

export function BrandsClient({
  brands,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<BrandFilter>("all");

  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const [editingBrand, setEditingBrand] =
    useState<Brand | null>(null);

  const filteredBrands = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return brands.filter((brand) => {
      const matchesSearch =
        !keyword ||
        brand.name
          .toLowerCase()
          .includes(keyword) ||
        brand.slug
          .toLowerCase()
          .includes(keyword);

      const matchesFilter =
        filter === "all" ||
        (filter === "active" &&
          brand.is_active) ||
        (filter === "inactive" &&
          !brand.is_active) ||
        (filter === "verified" &&
          brand.is_verified);

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [brands, search, filter]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredBrands.length /
        ITEMS_PER_PAGE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const paginatedBrands =
    filteredBrands.slice(
      (currentPage - 1) *
        ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE,
    );

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleFilter(
    value: BrandFilter,
  ) {
    setFilter(value);
    setPage(1);
  }

  function handleDelete(brand: Brand) {
    const confirmed = window.confirm(
      `Delete brand "${brand.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    deleteBrand(brand.id)
      .then(() => {
        window.location.reload();
      })
      .catch((error) => {
        window.alert(
          error instanceof Error
            ? error.message
            : "Failed to delete brand.",
        );
      });
  }

  const start =
    filteredBrands.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const end = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredBrands.length,
  );

  return (
    <div className="space-y-6">
      <BrandToolbar
        search={search}
        filter={filter}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onAddClick={() =>
          setAddOpen(true)
        }
      />

      <BrandTable
        brands={paginatedBrands}
        onEdit={(brand: Brand) =>
          setEditingBrand(brand)
        }
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {start}-{end} of{" "}
          {filteredBrands.length} brands
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() =>
              setPage(
                (value) => value - 1,
              )
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
                onClick={() =>
                  setPage(pageNumber)
                }
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
            disabled={
              currentPage === totalPages
            }
            onClick={() =>
              setPage(
                (value) => value + 1,
              )
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <AddBrandModal
        open={addOpen}
        onClose={() =>
          setAddOpen(false)
        }
      />

      <EditBrandModal
        open={editingBrand !== null}
        brand={editingBrand}
        onClose={() =>
          setEditingBrand(null)
        }
      />
    </div>
  );
}