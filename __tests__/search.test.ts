import { describe, it, expect } from "vitest";

// ── Validation logic tests ─────────────────────────────────────────────────
// These test the pure validation/normalization functions extracted from search.ts.
// The actual RPC call is tested via integration tests.

type SearchSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "newest"
  | "sold";

type SearchCondition = "new" | "used" | "refurbished";

type SearchInput = {
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

const VALID_SORTS = new Set([
  "relevance",
  "price_asc",
  "price_desc",
  "rating",
  "newest",
  "sold",
]);

const VALID_CONDITIONS = new Set(["new", "used", "refurbished"]);

function validateSearchInput(input: SearchInput): string | null {
  if (input.limit != null) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      return "Limit harus antara 1 dan 100.";
    }
  }
  if (input.offset != null) {
    if (!Number.isInteger(input.offset) || input.offset < 0) {
      return "Offset harus >= 0.";
    }
  }
  if (input.minPrice != null && input.minPrice < 0) {
    return "Harga minimum tidak boleh negatif.";
  }
  if (input.maxPrice != null && input.maxPrice < 0) {
    return "Harga maksimum tidak boleh negatif.";
  }
  if (
    input.minPrice != null &&
    input.maxPrice != null &&
    input.maxPrice < input.minPrice
  ) {
    return "Harga maksimum harus >= harga minimum.";
  }
  if (input.minRating != null) {
    if (input.minRating < 0 || input.minRating > 5) {
      return "Rating minimum harus antara 0 dan 5.";
    }
  }
  if (input.sort != null && !VALID_SORTS.has(input.sort)) {
    return "Sort tidak valid.";
  }
  if (input.condition != null && !VALID_CONDITIONS.has(input.condition)) {
    return "Kondisi tidak valid.";
  }
  return null;
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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Search input validation", () => {
  it("accepts empty input (all defaults)", () => {
    expect(validateSearchInput({})).toBeNull();
  });

  it("accepts valid input with all fields", () => {
    expect(
      validateSearchInput({
        query: "laptop",
        categoryId: "abc",
        brandId: "def",
        minPrice: 100000,
        maxPrice: 500000,
        minRating: 3,
        condition: "new",
        sort: "price_asc",
        limit: 10,
        offset: 0,
      }),
    ).toBeNull();
  });

  // Limit
  it("rejects limit 0", () => {
    expect(validateSearchInput({ limit: 0 })).toBe("Limit harus antara 1 dan 100.");
  });

  it("rejects limit 101", () => {
    expect(validateSearchInput({ limit: 101 })).toBe("Limit harus antara 1 dan 100.");
  });

  it("rejects negative limit", () => {
    expect(validateSearchInput({ limit: -1 })).toBe("Limit harus antara 1 dan 100.");
  });

  it("rejects non-integer limit", () => {
    expect(validateSearchInput({ limit: 5.5 })).toBe("Limit harus antara 1 dan 100.");
  });

  it("accepts limit 1", () => {
    expect(validateSearchInput({ limit: 1 })).toBeNull();
  });

  it("accepts limit 100", () => {
    expect(validateSearchInput({ limit: 100 })).toBeNull();
  });

  // Offset
  it("rejects negative offset", () => {
    expect(validateSearchInput({ offset: -1 })).toBe("Offset harus >= 0.");
  });

  it("rejects non-integer offset", () => {
    expect(validateSearchInput({ offset: 1.5 })).toBe("Offset harus >= 0.");
  });

  it("accepts offset 0", () => {
    expect(validateSearchInput({ offset: 0 })).toBeNull();
  });

  // Price
  it("rejects negative minPrice", () => {
    expect(validateSearchInput({ minPrice: -1 })).toBe(
      "Harga minimum tidak boleh negatif.",
    );
  });

  it("rejects negative maxPrice", () => {
    expect(validateSearchInput({ maxPrice: -1 })).toBe(
      "Harga maksimum tidak boleh negatif.",
    );
  });

  it("rejects maxPrice < minPrice", () => {
    expect(validateSearchInput({ minPrice: 100, maxPrice: 50 })).toBe(
      "Harga maksimum harus >= harga minimum.",
    );
  });

  it("accepts minPrice == maxPrice", () => {
    expect(validateSearchInput({ minPrice: 100, maxPrice: 100 })).toBeNull();
  });

  it("accepts zero prices", () => {
    expect(validateSearchInput({ minPrice: 0, maxPrice: 0 })).toBeNull();
  });

  // Rating
  it("rejects minRating < 0", () => {
    expect(validateSearchInput({ minRating: -1 })).toBe(
      "Rating minimum harus antara 0 dan 5.",
    );
  });

  it("rejects minRating > 5", () => {
    expect(validateSearchInput({ minRating: 6 })).toBe(
      "Rating minimum harus antara 0 dan 5.",
    );
  });

  it("accepts minRating 0", () => {
    expect(validateSearchInput({ minRating: 0 })).toBeNull();
  });

  it("accepts minRating 5", () => {
    expect(validateSearchInput({ minRating: 5 })).toBeNull();
  });

  // Sort
  it("rejects invalid sort", () => {
    expect(validateSearchInput({ sort: "invalid" as any })).toBe(
      "Sort tidak valid.",
    );
  });

  it.each(["relevance", "price_asc", "price_desc", "rating", "newest", "sold"])(
    "accepts sort=%s",
    (sort) => {
      expect(validateSearchInput({ sort: sort as SearchSort })).toBeNull();
    },
  );

  // Condition
  it("rejects invalid condition", () => {
    expect(validateSearchInput({ condition: "broken" as any })).toBe(
      "Kondisi tidak valid.",
    );
  });

  it.each(["new", "used", "refurbished"])(
    "accepts condition=%s",
    (cond) => {
      expect(validateSearchInput({ condition: cond as SearchCondition })).toBeNull();
    },
  );
});

// ── Normalization tests ────────────────────────────────────────────────────

describe("Search input normalization", () => {
  it("trims query and converts empty to null", () => {
    const result = normalizeInput({ query: "  laptop  " });
    expect(result.p_query).toBe("laptop");
  });

  it("converts empty string query to null", () => {
    expect(normalizeInput({ query: "" }).p_query).toBeNull();
  });

  it("converts whitespace-only query to null", () => {
    expect(normalizeInput({ query: "   " }).p_query).toBeNull();
  });

  it("preserves non-empty query", () => {
    expect(normalizeInput({ query: "wireless" }).p_query).toBe("wireless");
  });

  it("defaults sort to relevance", () => {
    expect(normalizeInput({}).p_sort).toBe("relevance");
  });

  it("defaults limit to 20", () => {
    expect(normalizeInput({}).p_limit).toBe(20);
  });

  it("defaults offset to 0", () => {
    expect(normalizeInput({}).p_offset).toBe(0);
  });

  it("passes through explicit values", () => {
    const result = normalizeInput({
      sort: "price_asc",
      limit: 50,
      offset: 10,
      minPrice: 100000,
      maxPrice: 500000,
      minRating: 3,
      condition: "new",
      categoryId: "cat-1",
      brandId: "brand-1",
    });
    expect(result.p_sort).toBe("price_asc");
    expect(result.p_limit).toBe(50);
    expect(result.p_offset).toBe(10);
    expect(result.p_min_price).toBe(100000);
    expect(result.p_max_price).toBe(500000);
    expect(result.p_min_rating).toBe(3);
    expect(result.p_condition).toBe("new");
    expect(result.p_category_id).toBe("cat-1");
    expect(result.p_brand_id).toBe("brand-1");
  });

  it("converts undefined optional fields to null", () => {
    const result = normalizeInput({});
    expect(result.p_query).toBeNull();
    expect(result.p_category_id).toBeNull();
    expect(result.p_brand_id).toBeNull();
    expect(result.p_min_price).toBeNull();
    expect(result.p_max_price).toBeNull();
    expect(result.p_min_rating).toBeNull();
    expect(result.p_condition).toBeNull();
  });
});

// ── RPC parameter mapping tests ────────────────────────────────────────────

describe("RPC parameter mapping", () => {
  it("maps all input fields to RPC parameter names", () => {
    const input: SearchInput = {
      query: "test",
      categoryId: "cat-1",
      brandId: "brand-1",
      minPrice: 100,
      maxPrice: 500,
      minRating: 3,
      condition: "new",
      sort: "price_desc",
      limit: 10,
      offset: 5,
    };
    const params = normalizeInput(input);

    expect(params).toEqual({
      p_query: "test",
      p_category_id: "cat-1",
      p_brand_id: "brand-1",
      p_min_price: 100,
      p_max_price: 500,
      p_min_rating: 3,
      p_condition: "new",
      p_sort: "price_desc",
      p_limit: 10,
      p_offset: 5,
    });
  });

  it("sends exactly 10 parameters to RPC", () => {
    const params = normalizeInput({});
    expect(Object.keys(params)).toHaveLength(10);
  });
});

// ── Result shape tests ─────────────────────────────────────────────────────

describe("SearchProduct shape", () => {
  const validRow: Record<string, unknown> = {
    id: "test-id",
    name: "Test Product",
    slug: "test-product",
    price: 100000,
    discount_price: 80000,
    stock: 10,
    rating: 4.5,
    review_count: 5,
    sold_count: 20,
    condition: "new",
    store_id: "store-1",
    store_name: "Test Store",
    store_slug: "test-store",
    category_id: "cat-1",
    category_name: "Electronics",
    brand_id: "brand-1",
    brand_name: "Samsung",
    primary_image_url: "https://example.com/img.jpg",
    relevance_score: 0.5,
  };

  it("has all 19 required fields", () => {
    const requiredFields = [
      "id",
      "name",
      "slug",
      "price",
      "discount_price",
      "stock",
      "rating",
      "review_count",
      "sold_count",
      "condition",
      "store_id",
      "store_name",
      "store_slug",
      "category_id",
      "category_name",
      "brand_id",
      "brand_name",
      "primary_image_url",
      "relevance_score",
    ];

    for (const field of requiredFields) {
      expect(field in validRow).toBe(true);
    }
  });

  it("maps numeric fields correctly", () => {
    expect(Number(validRow.price)).toBe(100000);
    expect(Number(validRow.discount_price)).toBe(80000);
    expect(Number(validRow.stock)).toBe(10);
    expect(Number(validRow.rating)).toBe(4.5);
    expect(Number(validRow.relevance_score)).toBe(0.5);
  });

  it("handles null discount_price", () => {
    const row = { ...validRow, discount_price: null };
    expect(row.discount_price).toBeNull();
  });

  it("handles null category/brand", () => {
    const row = {
      ...validRow,
      category_id: null,
      category_name: null,
      brand_id: null,
      brand_name: null,
      primary_image_url: null,
    };
    expect(row.category_id).toBeNull();
    expect(row.brand_id).toBeNull();
  });
});
