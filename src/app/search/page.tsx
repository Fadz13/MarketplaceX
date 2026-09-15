import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { searchProducts } from "@/lib/actions/search";
import type { SearchCondition, SearchSort as SortValue } from "@/lib/actions/search";
import { SearchResults } from "@/components/search/search-results";
import { SiteHeader } from "@/components/search/site-header";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchSort } from "@/components/search/search-sort";
import { SearchPagination } from "@/components/search/search-pagination";

const PAGE_SIZE = 20;
const MAX_RPC_LIMIT = 100;
const VALID_CONDITIONS = new Set(["new", "used", "refurbished"]);
const VALID_SORTS = new Set(["relevance", "price_asc", "price_desc", "rating", "newest", "sold"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;

  const rawQuery = params.q?.trim() ?? "";
  const query = rawQuery !== "" ? rawQuery : null;

  const categoryId = params.category && UUID_RE.test(params.category) ? params.category : null;
  const brandId = params.brand && UUID_RE.test(params.brand) ? params.brand : null;
  const condition = params.condition && VALID_CONDITIONS.has(params.condition) ? (params.condition as SearchCondition) : null;
  const sort: SortValue = params.sort && VALID_SORTS.has(params.sort) ? (params.sort as SortValue) : "relevance";

  const minPriceRaw = params.minPrice ? Number(params.minPrice) : null;
  const maxPriceRaw = params.maxPrice ? Number(params.maxPrice) : null;
  const minRatingRaw = params.minRating ? Number(params.minRating) : null;

  const minPrice = minPriceRaw != null && !isNaN(minPriceRaw) && minPriceRaw >= 0 ? minPriceRaw : null;
  const maxPrice = maxPriceRaw != null && !isNaN(maxPriceRaw) && maxPriceRaw >= 0 ? maxPriceRaw : null;
  const minRating = minRatingRaw != null && !isNaN(minRatingRaw) && minRatingRaw >= 0 && minRatingRaw <= 5 ? minRatingRaw : null;

  const rawPage = params.page ? Number(params.page) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const { products, count } = await searchProducts({
    query,
    categoryId,
    brandId,
    condition,
    minPrice,
    maxPrice,
    minRating,
    sort,
    limit: Math.min(PAGE_SIZE, MAX_RPC_LIMIT),
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);

  const heading = query
    ? `Hasil pencarian "${query}"`
    : "Semua Produk";

  const supabase = await createClient();

  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("status", "active")
      .order("sort_order"),
    supabase
      .from("brands")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name"),
  ]);

  const effectiveOffset = (effectivePage - 1) * PAGE_SIZE;
  const startResult = count > 0 ? effectiveOffset + 1 : 0;
  const endResult = Math.min(effectiveOffset + PAGE_SIZE, count);

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader searchQuery={query ?? undefined} />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{heading}</h1>
          <p className="mt-2 text-gray-500">
            {count > 0
              ? `${count} produk ditemukan. Menampilkan ${startResult}–${endResult}.`
              : "Tidak ada produk yang cocok."}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-end">
          <Suspense>
            <SearchSort />
          </Suspense>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Suspense>
            <SearchFilters
              categories={(categories ?? []).map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
              }))}
              brands={(brands ?? []).map((b) => ({
                id: b.id,
                name: b.name,
                slug: b.slug,
              }))}
            />
          </Suspense>

          <div className="min-w-0 flex-1">
            <SearchResults products={products} />
            <Suspense>
              <SearchPagination
                currentPage={effectivePage}
                totalPages={totalPages}
              />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
