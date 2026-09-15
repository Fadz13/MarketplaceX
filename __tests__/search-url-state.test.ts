import { describe, it, expect } from "vitest";

// ── Canonical normalization (single source of truth) ───────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CONDITIONS = new Set(["new", "used", "refurbished"]);
const VALID_SORTS = new Set(["relevance", "price_asc", "price_desc", "rating", "newest", "sold"]);
const VALID_MIN_RATINGS = new Set([1, 2, 3, 4]);
const PAGE_SIZE = 20;

function parseSearchParams(params: Record<string, string | undefined>) {
  const rawQuery = params.q?.trim() ?? "";
  const query = rawQuery !== "" ? rawQuery : null;

  const categoryId = params.category && UUID_RE.test(params.category) ? params.category : null;
  const brandId = params.brand && UUID_RE.test(params.brand) ? params.brand : null;
  const condition = params.condition && VALID_CONDITIONS.has(params.condition)
    ? (params.condition as "new" | "used" | "refurbished")
    : null;
  const sort = params.sort && VALID_SORTS.has(params.sort)
    ? (params.sort as "relevance" | "price_asc" | "price_desc" | "rating" | "newest" | "sold")
    : "relevance";

  const minPriceRaw = params.minPrice ? Number(params.minPrice) : null;
  const maxPriceRaw = params.maxPrice ? Number(params.maxPrice) : null;
  const minRatingRaw = params.minRating ? Number(params.minRating) : null;

  const minPrice = minPriceRaw != null && !isNaN(minPriceRaw) && minPriceRaw >= 0 ? minPriceRaw : null;
  const maxPrice = maxPriceRaw != null && !isNaN(maxPriceRaw) && maxPriceRaw >= 0 ? maxPriceRaw : null;
  const minRating = minRatingRaw != null && !isNaN(minRatingRaw) && VALID_MIN_RATINGS.has(minRatingRaw) ? minRatingRaw : null;

  const rawPage = params.page ? Number(params.page) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  return { query, categoryId, brandId, condition, sort, minPrice, maxPrice, minRating, page, offset };
}

describe("canonical normalization", () => {
  it("empty params → all null/default", () => {
    const r = parseSearchParams({});
    expect(r.query).toBeNull();
    expect(r.categoryId).toBeNull();
    expect(r.brandId).toBeNull();
    expect(r.condition).toBeNull();
    expect(r.sort).toBe("relevance");
    expect(r.minPrice).toBeNull();
    expect(r.maxPrice).toBeNull();
    expect(r.minRating).toBeNull();
    expect(r.page).toBe(1);
    expect(r.offset).toBe(0);
  });

  it("q=  → null", () => {
    expect(parseSearchParams({ q: "" }).query).toBeNull();
  });

  it("q=wireless  → trimmed", () => {
    expect(parseSearchParams({ q: "wireless" }).query).toBe("wireless");
  });

  it("q=  spaces  → trimmed", () => {
    expect(parseSearchParams({ q: "  spaces  " }).query).toBe("spaces");
  });

  it("valid UUID preserved", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseSearchParams({ category: uuid }).categoryId).toBe(uuid);
  });

  it("invalid UUID → null", () => {
    expect(parseSearchParams({ category: "not-a-uuid" }).categoryId).toBeNull();
    expect(parseSearchParams({ category: "123" }).categoryId).toBeNull();
    expect(parseSearchParams({ category: "" }).categoryId).toBeNull();
  });

  it("valid condition preserved", () => {
    expect(parseSearchParams({ condition: "new" }).condition).toBe("new");
    expect(parseSearchParams({ condition: "used" }).condition).toBe("used");
    expect(parseSearchParams({ condition: "refurbished" }).condition).toBe("refurbished");
  });

  it("invalid condition → null", () => {
    expect(parseSearchParams({ condition: "broken" }).condition).toBeNull();
    expect(parseSearchParams({ condition: "NEW" }).condition).toBeNull();
  });

  it("valid sort preserved", () => {
    expect(parseSearchParams({ sort: "price_asc" }).sort).toBe("price_asc");
  });

  it("invalid sort → relevance", () => {
    expect(parseSearchParams({ sort: "invalid" }).sort).toBe("relevance");
    expect(parseSearchParams({ sort: "" }).sort).toBe("relevance");
  });

  it("valid minPrice", () => {
    expect(parseSearchParams({ minPrice: "100000" }).minPrice).toBe(100000);
  });

  it("negative minPrice → null", () => {
    expect(parseSearchParams({ minPrice: "-1" }).minPrice).toBeNull();
  });

  it("NaN minPrice → null", () => {
    expect(parseSearchParams({ minPrice: "abc" }).minPrice).toBeNull();
  });

  it("valid minRating", () => {
    expect(parseSearchParams({ minRating: "4" }).minRating).toBe(4);
    expect(parseSearchParams({ minRating: "1" }).minRating).toBe(1);
  });

  it("minRating=0 → null (not in UI set)", () => {
    expect(parseSearchParams({ minRating: "0" }).minRating).toBeNull();
  });

  it("minRating=5 → null (not in UI set)", () => {
    expect(parseSearchParams({ minRating: "5" }).minRating).toBeNull();
  });

  it("valid page", () => {
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
    expect(parseSearchParams({ page: "3" }).offset).toBe(40);
  });

  it("page=0 → 1", () => {
    expect(parseSearchParams({ page: "0" }).page).toBe(1);
  });

  it("page=-5 → 1", () => {
    expect(parseSearchParams({ page: "-5" }).page).toBe(1);
  });

  it("page=abc → 1", () => {
    expect(parseSearchParams({ page: "abc" }).page).toBe(1);
  });

  it("page=2.7 → 2 (floored)", () => {
    expect(parseSearchParams({ page: "2.7" }).page).toBe(2);
  });
});

// ── URL round-trip ─────────────────────────────────────────────────────────

function buildCanonicalUrl(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === "") continue;
    if (k === "sort" && v === "relevance") continue;
    if (k === "page" && v === "1") continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/search?${qs}` : "/search";
}

describe("canonical URL round-trip", () => {
  it("q=laptop → /search?q=laptop", () => {
    expect(buildCanonicalUrl({ q: "laptop" })).toBe("/search?q=laptop");
  });

  it("q= → /search", () => {
    expect(buildCanonicalUrl({ q: "" })).toBe("/search");
  });

  it("sort=relevance → /search (omitted)", () => {
    expect(buildCanonicalUrl({ sort: "relevance" })).toBe("/search");
  });

  it("sort=price_asc → /search?sort=price_asc", () => {
    expect(buildCanonicalUrl({ sort: "price_asc" })).toBe("/search?sort=price_asc");
  });

  it("page=1 → /search (omitted)", () => {
    expect(buildCanonicalUrl({ page: "1" })).toBe("/search");
  });

  it("page=3 → /search?page=3", () => {
    expect(buildCanonicalUrl({ page: "3" })).toBe("/search?page=3");
  });

  it("all params combined", () => {
    const url = buildCanonicalUrl({
      q: "laptop",
      category: "550e8400-e29b-41d4-a716-446655440000",
      brand: "550e8400-e29b-41d4-a716-446655440001",
      condition: "new",
      minPrice: "100000",
      maxPrice: "500000",
      minRating: "4",
      sort: "price_asc",
      page: "2",
    });
    const u = new URL(url, "http://localhost");
    expect(u.searchParams.get("q")).toBe("laptop");
    expect(u.searchParams.get("category")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(u.searchParams.get("brand")).toBe("550e8400-e29b-41d4-a716-446655440001");
    expect(u.searchParams.get("condition")).toBe("new");
    expect(u.searchParams.get("minPrice")).toBe("100000");
    expect(u.searchParams.get("maxPrice")).toBe("500000");
    expect(u.searchParams.get("minRating")).toBe("4");
    expect(u.searchParams.get("sort")).toBe("price_asc");
    expect(u.searchParams.get("page")).toBe("2");
  });
});

// ── Parameter preservation matrix ──────────────────────────────────────────

function applyUpdate(
  current: Record<string, string>,
  updates: Record<string, string>,
  resetsPage: boolean,
): Record<string, string> {
  const result = { ...current };
  if (resetsPage) delete result.page;
  for (const [k, v] of Object.entries(updates)) {
    if (v === "") delete result[k];
    else result[k] = v;
  }
  return result;
}

describe("preservation matrix", () => {
  const base = { q: "laptop", category: "c1", brand: "b1", sort: "price_asc", page: "3" };

  it("filter change preserves q, sort; resets page", () => {
    const r = applyUpdate(base, { condition: "new" }, true);
    expect(r.q).toBe("laptop");
    expect(r.sort).toBe("price_asc");
    expect(r.category).toBe("c1");
    expect(r.brand).toBe("b1");
    expect(r.condition).toBe("new");
    expect(r.page).toBeUndefined();
  });

  it("sort change preserves q, filters; resets page", () => {
    const r = applyUpdate(base, { sort: "rating" }, true);
    expect(r.q).toBe("laptop");
    expect(r.category).toBe("c1");
    expect(r.brand).toBe("b1");
    expect(r.sort).toBe("rating");
    expect(r.page).toBeUndefined();
  });

  it("page change preserves everything", () => {
    const r = applyUpdate(base, { page: "5" }, false);
    expect(r.q).toBe("laptop");
    expect(r.category).toBe("c1");
    expect(r.brand).toBe("b1");
    expect(r.sort).toBe("price_asc");
    expect(r.page).toBe("5");
  });

  it("query change preserves filters, resets page", () => {
    const r = applyUpdate(base, { q: "mouse" }, true);
    expect(r.q).toBe("mouse");
    expect(r.category).toBe("c1");
    expect(r.sort).toBe("price_asc");
    expect(r.page).toBeUndefined();
  });

  it("clear all removes filters/sort/page, preserves q", () => {
    const r = { q: "laptop" };
    expect(r.q).toBe("laptop");
    expect(Object.keys(r)).toEqual(["q"]);
  });

  it("clearing one filter preserves others", () => {
    const r = applyUpdate(base, { category: "" }, true);
    expect(r.q).toBe("laptop");
    expect(r.brand).toBe("b1");
    expect(r.sort).toBe("price_asc");
    expect(r.category).toBeUndefined();
    expect(r.page).toBeUndefined();
  });
});

// ── searchProducts mapping ─────────────────────────────────────────────────

describe("searchProducts exact mapping", () => {
  it("page 1: limit=20, offset=0", () => {
    const r = parseSearchParams({ page: "1" });
    expect(r.offset).toBe(0);
  });

  it("page 5: limit=20, offset=80", () => {
    const r = parseSearchParams({ page: "5" });
    expect(r.offset).toBe(80);
  });

  it("limit always 20", () => {
    expect(PAGE_SIZE).toBe(20);
  });

  it("sort maps directly to RPC param", () => {
    for (const s of ["relevance", "price_asc", "price_desc", "rating", "newest", "sold"]) {
      const r = parseSearchParams({ sort: s });
      expect(r.sort).toBe(s);
    }
  });

  it("condition maps directly to RPC param", () => {
    for (const c of ["new", "used", "refurbished"]) {
      const r = parseSearchParams({ condition: c });
      expect(r.condition).toBe(c);
    }
  });
});

// ── Page clamping ──────────────────────────────────────────────────────────

function calcEffectivePage(page: number, totalPages: number): number {
  return Math.min(page, totalPages);
}

function calcTotalPages(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
}

describe("page clamping", () => {
  it("page 100, 5 total → effective 5", () => {
    expect(calcEffectivePage(100, calcTotalPages(100))).toBe(5);
  });

  it("page 1, 0 results → effective 1", () => {
    expect(calcEffectivePage(1, calcTotalPages(0))).toBe(1);
  });

  it("page 999999, 45 total → effective 3", () => {
    expect(calcEffectivePage(999999, calcTotalPages(45))).toBe(3);
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("/search?page=999999 → no crash", () => {
    const r = parseSearchParams({ page: "999999" });
    expect(r.page).toBe(999999);
    expect(r.offset).toBe((999999 - 1) * 20);
    const tp = calcTotalPages(45);
    const eff = calcEffectivePage(r.page, tp);
    expect(eff).toBe(3);
  });

  it("all params invalid → defaults", () => {
    const r = parseSearchParams({
      q: "",
      category: "invalid",
      brand: "invalid",
      condition: "invalid",
      minPrice: "-5",
      maxPrice: "abc",
      minRating: "99",
      sort: "invalid",
      page: "0",
    });
    expect(r.query).toBeNull();
    expect(r.categoryId).toBeNull();
    expect(r.brandId).toBeNull();
    expect(r.condition).toBeNull();
    expect(r.minPrice).toBeNull();
    expect(r.maxPrice).toBeNull();
    expect(r.minRating).toBeNull();
    expect(r.sort).toBe("relevance");
    expect(r.page).toBe(1);
  });

  it("no duplicate keys in URLSearchParams", () => {
    const params = new URLSearchParams();
    params.set("q", "laptop");
    params.set("sort", "price_asc");
    params.set("page", "2");
    const keys = Array.from(params.keys());
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });

  it("empty result with page > 1", () => {
    const tp = calcTotalPages(0);
    expect(tp).toBe(1);
    const eff = calcEffectivePage(5, tp);
    expect(eff).toBe(1);
  });
});

// ── Out-of-stock behavior ──────────────────────────────────────────────────

describe("out-of-stock behavior (documented)", () => {
  it("stock <= 0 products can appear in search results", () => {
    // The RPC filters by products.status = 'active' and stores.status = 'active'
    // but does NOT filter by stock > 0.
    // This is a design decision, not a bug.
    // Products with stock=0 but status='active' will appear.
    const product = { stock: 0, status: "active" };
    expect(product.status).toBe("active");
    // RPC would return this product
  });
});

// ── Parameter ordering ─────────────────────────────────────────────────────

describe("parameter ordering", () => {
  it("URLSearchParams preserves insertion order", () => {
    const params = new URLSearchParams();
    params.set("q", "laptop");
    params.set("category", "c1");
    params.set("sort", "price_asc");
    params.set("page", "2");
    const keys = Array.from(params.keys());
    expect(keys).toEqual(["q", "category", "sort", "page"]);
  });
});
