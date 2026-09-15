"use server";

import { createClient } from "@/lib/supabase/server";

// ── Types ──────────────────────────────────────────────────────────────────

export type SearchSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "newest"
  | "sold";

export type SearchCondition = "new" | "used" | "refurbished";

export type SearchInput = {
  query?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  condition?: SearchCondition | null;
  sort?: SearchSort | null;
  limit?: number;
  offset?: number;
};

export type SearchProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  stock: number;
  rating: number;
  review_count: number;
  sold_count: number;
  condition: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  category_id: string | null;
  category_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  primary_image_url: string | null;
  relevance_score: number;
};

export type SearchResult = {
  products: SearchProduct[];
  count: number;
};

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_SORTS: ReadonlySet<string> = new Set([
  "relevance",
  "price_asc",
  "price_desc",
  "rating",
  "newest",
  "sold",
]);

const VALID_CONDITIONS: ReadonlySet<string> = new Set([
  "new",
  "used",
  "refurbished",
]);

// ── Validation ─────────────────────────────────────────────────────────────

function validateSearchInput(input: SearchInput): void {
  if (input.limit != null) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      throw new Error("Limit harus antara 1 dan 100.");
    }
  }

  if (input.offset != null) {
    if (!Number.isInteger(input.offset) || input.offset < 0) {
      throw new Error("Offset harus >= 0.");
    }
  }

  if (input.minPrice != null && input.minPrice < 0) {
    throw new Error("Harga minimum tidak boleh negatif.");
  }

  if (input.maxPrice != null && input.maxPrice < 0) {
    throw new Error("Harga maksimum tidak boleh negatif.");
  }

  if (
    input.minPrice != null &&
    input.maxPrice != null &&
    input.maxPrice < input.minPrice
  ) {
    throw new Error("Harga maksimum harus >= harga minimum.");
  }

  if (input.minRating != null) {
    if (input.minRating < 0 || input.minRating > 5) {
      throw new Error("Rating minimum harus antara 0 dan 5.");
    }
  }

  if (input.sort != null && !VALID_SORTS.has(input.sort)) {
    throw new Error(
      `Sort tidak valid. Pilihan: ${Array.from(VALID_SORTS).join(", ")}.`,
    );
  }

  if (input.condition != null && !VALID_CONDITIONS.has(input.condition)) {
    throw new Error(
      `Kondisi tidak valid. Pilihan: ${Array.from(VALID_CONDITIONS).join(", ")}.`,
    );
  }
}

function normalizeInput(input: SearchInput): Record<string, unknown> {
  const q =
    input.query != null && input.query.trim() !== ""
      ? input.query.trim()
      : null;

  return {
    p_query: q,
    p_category_id: input.categoryId ?? null,
    p_brand_id: input.brandId ?? null,
    p_min_price: input.minPrice ?? null,
    p_max_price: input.maxPrice ?? null,
    p_min_rating: input.minRating ?? null,
    p_condition: input.condition ?? null,
    p_sort: input.sort ?? "relevance",
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  };
}

// ── Server Action ──────────────────────────────────────────────────────────

export async function searchProducts(
  input: SearchInput = {},
): Promise<SearchResult> {
  validateSearchInput(input);

  const supabase = await createClient();
  const params = normalizeInput(input);

  const { data, error, count } = await supabase.rpc(
    "search_products" as never,
    params as never,
    { count: "exact" },
  );

  if (error) {
    throw new Error("Gagal mencari produk. Silakan coba lagi.");
  }

  const products = ((data ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      price: Number(row.price ?? 0),
      discount_price:
        row.discount_price != null ? Number(row.discount_price) : null,
      stock: Number(row.stock ?? 0),
      rating: Number(row.rating ?? 0),
      review_count: Number(row.review_count ?? 0),
      sold_count: Number(row.sold_count ?? 0),
      condition: row.condition as string,
      store_id: row.store_id as string,
      store_name: row.store_name as string,
      store_slug: row.store_slug as string,
      category_id: (row.category_id as string) ?? null,
      category_name: (row.category_name as string) ?? null,
      brand_id: (row.brand_id as string) ?? null,
      brand_name: (row.brand_name as string) ?? null,
      primary_image_url: (row.primary_image_url as string) ?? null,
      relevance_score: Number(row.relevance_score ?? 0),
    }),
  );

  return {
    products,
    count: count ?? products.length,
  };
}
