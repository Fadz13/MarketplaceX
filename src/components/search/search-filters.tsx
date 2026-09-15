"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  categories: Category[];
  brands: Brand[];
};

const CONDITIONS = [
  { value: "new", label: "Baru" },
  { value: "used", label: "Bekas" },
  { value: "refurbished", label: "Refurbished" },
] as const;

const RATINGS = [4, 3, 2, 1] as const;

export function SearchFilters({ categories, brands }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  function getParam(key: string): string {
    return searchParams.get(key) ?? "";
  }

  function buildUrl(updates: Record<string, string>): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, val] of Object.entries(updates)) {
      if (val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  }

  function navigate(updates: Record<string, string>) {
    router.push(buildUrl(updates));
  }

  function clearAll() {
    const q = getParam("q");
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const hasActiveFilters = ["category", "brand", "condition", "minPrice", "maxPrice", "minRating"].some(
    (k) => getParam(k) !== "",
  );

  const activeCount = ["category", "brand", "condition", "minPrice", "maxPrice", "minRating"].filter(
    (k) => getParam(k) !== "",
  ).length;

  const filterContent = (
    <div className="space-y-5">
      {/* Category */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-gray-900">
          Kategori
        </legend>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100"
            >
              <input
                type="radio"
                name="category"
                checked={getParam("category") === cat.id}
                onChange={() =>
                  navigate({
                    category: getParam("category") === cat.id ? "" : cat.id,
                  })
                }
                className="h-3.5 w-3.5 accent-black"
              />
              <span className="truncate">{cat.name}</span>
            </label>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-gray-400">Tidak ada kategori</p>
          )}
        </div>
      </fieldset>

      {/* Brand */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-gray-900">
          Merek
        </legend>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {brands.map((brand) => (
            <label
              key={brand.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100"
            >
              <input
                type="radio"
                name="brand"
                checked={getParam("brand") === brand.id}
                onChange={() =>
                  navigate({
                    brand: getParam("brand") === brand.id ? "" : brand.id,
                  })
                }
                className="h-3.5 w-3.5 accent-black"
              />
              <span className="truncate">{brand.name}</span>
            </label>
          ))}
          {brands.length === 0 && (
            <p className="text-xs text-gray-400">Tidak ada merek</p>
          )}
        </div>
      </fieldset>

      {/* Condition */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-gray-900">
          Kondisi
        </legend>
        <div className="space-y-1.5">
          {CONDITIONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100"
            >
              <input
                type="radio"
                name="condition"
                checked={getParam("condition") === value}
                onChange={() =>
                  navigate({
                    condition: getParam("condition") === value ? "" : value,
                  })
                }
                className="h-3.5 w-3.5 accent-black"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Price Range */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-gray-900">
          Rentang Harga
        </legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={getParam("minPrice")}
            onChange={(e) => navigate({ minPrice: e.target.value })}
            className="h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
          />
          <span className="shrink-0 text-gray-400">–</span>
          <input
            type="number"
            min={0}
            placeholder="Maks"
            value={getParam("maxPrice")}
            onChange={(e) => navigate({ maxPrice: e.target.value })}
            className="h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
          />
        </div>
      </fieldset>

      {/* Rating */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-gray-900">
          Rating Minimum
        </legend>
        <div className="space-y-1.5">
          {RATINGS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100"
            >
              <input
                type="radio"
                name="minRating"
                checked={getParam("minRating") === String(r)}
                onChange={() =>
                  navigate({
                    minRating: getParam("minRating") === String(r) ? "" : String(r),
                  })
                }
                className="h-3.5 w-3.5 accent-black"
              />
              <span className="text-amber-500">
                {"★".repeat(r)}
              </span>
              <span className="text-gray-400">&amp; di atasnya</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Clear All */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="w-full rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Hapus Semua Filter
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-lg border bg-white px-4 py-3 text-sm font-medium"
        >
          <span>
            Filter
            {activeCount > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </span>
          <span className="text-gray-500">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="mt-2 rounded-lg border bg-white p-4">
            {filterContent}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-6 rounded-2xl border bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Filter</h2>
          {filterContent}
        </div>
      </aside>
    </>
  );
}
