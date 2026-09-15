"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevansi" },
  { value: "price_asc", label: "Harga Terendah" },
  { value: "price_desc", label: "Harga Tertinggi" },
  { value: "rating", label: "Rating Tertinggi" },
  { value: "newest", label: "Terbaru" },
  { value: "sold", label: "Terlaris" },
] as const;

const VALID_SORTS: ReadonlySet<string> = new Set(SORT_OPTIONS.map((o) => o.value));

export function SearchSort() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = searchParams.get("sort") ?? "relevance";
  const value = VALID_SORTS.has(current) ? current : "relevance";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const sort = e.target.value;
    if (sort === "relevance") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="search-sort" className="shrink-0 text-sm text-gray-600">
        Urutkan:
      </label>
      <select
        id="search-sort"
        value={value}
        onChange={handleChange}
        className="h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
