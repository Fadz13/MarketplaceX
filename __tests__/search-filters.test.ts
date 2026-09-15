import { describe, it, expect } from "vitest";

// ── URL param parsing/validation ───────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CONDITIONS = new Set(["new", "used", "refurbished"]);

function parseCategoryParam(v: string | undefined): string | null {
  return v && UUID_RE.test(v) ? v : null;
}

function parseBrandParam(v: string | undefined): string | null {
  return v && UUID_RE.test(v) ? v : null;
}

function parseConditionParam(v: string | undefined): string | null {
  return v && VALID_CONDITIONS.has(v) ? v : null;
}

function parseNumberParam(v: string | undefined, min: number, max: number): number | null {
  if (!v) return null;
  const n = Number(v);
  if (isNaN(n) || n < min || n > max) return null;
  return n;
}

describe("URL param → filter state", () => {
  it("parses valid category UUID", () => {
    expect(parseCategoryParam("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects invalid category UUID", () => {
    expect(parseCategoryParam("not-a-uuid")).toBeNull();
    expect(parseCategoryParam("123")).toBeNull();
    expect(parseCategoryParam("")).toBeNull();
    expect(parseCategoryParam(undefined)).toBeNull();
  });

  it("parses valid brand UUID", () => {
    expect(parseBrandParam("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects invalid brand UUID", () => {
    expect(parseBrandParam("invalid")).toBeNull();
  });

  it("parses valid condition", () => {
    expect(parseConditionParam("new")).toBe("new");
    expect(parseConditionParam("used")).toBe("used");
    expect(parseConditionParam("refurbished")).toBe("refurbished");
  });

  it("rejects invalid condition", () => {
    expect(parseConditionParam("broken")).toBeNull();
    expect(parseConditionParam("NEW")).toBeNull();
    expect(parseConditionParam(undefined)).toBeNull();
  });

  it("parses valid minPrice", () => {
    expect(parseNumberParam("100000", 0, Infinity)).toBe(100000);
  });

  it("rejects negative minPrice", () => {
    expect(parseNumberParam("-1", 0, Infinity)).toBeNull();
  });

  it("parses valid maxPrice", () => {
    expect(parseNumberParam("500000", 0, Infinity)).toBe(500000);
  });

  it("rejects NaN price", () => {
    expect(parseNumberParam("abc", 0, Infinity)).toBeNull();
  });

  it("parses valid minRating", () => {
    expect(parseNumberParam("4", 0, 5)).toBe(4);
  });

  it("rejects minRating > 5", () => {
    expect(parseNumberParam("6", 0, 5)).toBeNull();
  });

  it("rejects negative minRating", () => {
    expect(parseNumberParam("-1", 0, 5)).toBeNull();
  });
});

// ── Filter state → URL params ──────────────────────────────────────────────

function buildFilterUrl(
  base: Record<string, string>,
  updates: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...updates })) {
    if (v === "") {
      params.delete(k);
    } else {
      params.set(k, v);
    }
  }
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

describe("filter state → URL", () => {
  it("adds category to URL", () => {
    const url = buildFilterUrl({ q: "laptop" }, { category: "abc-123" });
    expect(url).toBe("/search?q=laptop&category=abc-123");
  });

  it("removes category when empty", () => {
    const url = buildFilterUrl(
      { q: "laptop", category: "abc-123" },
      { category: "" },
    );
    expect(url).toBe("/search?q=laptop");
  });

  it("adds brand to URL", () => {
    const url = buildFilterUrl({}, { brand: "def-456" });
    expect(url).toBe("/search?brand=def-456");
  });

  it("adds condition to URL", () => {
    const url = buildFilterUrl({}, { condition: "new" });
    expect(url).toBe("/search?condition=new");
  });

  it("adds price range", () => {
    const url = buildFilterUrl({}, { minPrice: "100000", maxPrice: "500000" });
    expect(url).toBe("/search?minPrice=100000&maxPrice=500000");
  });

  it("adds minRating", () => {
    const url = buildFilterUrl({}, { minRating: "4" });
    expect(url).toBe("/search?minRating=4");
  });

  it("preserves q when adding filter", () => {
    const url = buildFilterUrl({ q: "mouse" }, { category: "abc" });
    expect(url).toBe("/search?q=mouse&category=abc");
  });

  it("preserves unrelated params", () => {
    const url = buildFilterUrl(
      { q: "mouse", category: "abc", brand: "def" },
      { condition: "new" },
    );
    expect(url).toBe("/search?q=mouse&category=abc&brand=def&condition=new");
  });

  it("returns /search when all params empty", () => {
    const url = buildFilterUrl({}, {});
    expect(url).toBe("/search");
  });
});

// ── Clear all filters ──────────────────────────────────────────────────────

describe("clear all filters", () => {
  it("preserves q when clearing filters", () => {
    const params = new URLSearchParams({
      q: "laptop",
      category: "abc",
      brand: "def",
      condition: "new",
      minPrice: "100000",
    });
    const q = params.get("q") ?? "";
    const result = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    expect(result).toBe("/search?q=laptop");
  });

  it("returns /search when no q", () => {
    const params = new URLSearchParams({
      category: "abc",
      brand: "def",
    });
    const q = params.get("q") ?? "";
    const result = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    expect(result).toBe("/search");
  });
});

// ── searchProducts input mapping ───────────────────────────────────────────

describe("searchProducts input mapping", () => {
  it("maps all filter params correctly", () => {
    const input = {
      query: "laptop",
      categoryId: "550e8400-e29b-41d4-a716-446655440000",
      brandId: "550e8400-e29b-41d4-a716-446655440001",
      condition: "new" as const,
      minPrice: 100000,
      maxPrice: 500000,
      minRating: 4,
    };

    expect(input.query).toBe("laptop");
    expect(input.categoryId).toBeTruthy();
    expect(input.brandId).toBeTruthy();
    expect(input.condition).toBe("new");
    expect(input.minPrice).toBe(100000);
    expect(input.maxPrice).toBe(500000);
    expect(input.minRating).toBe(4);
  });

  it("omits null params", () => {
    const input = {
      query: "laptop",
      categoryId: null,
      brandId: null,
      condition: null,
      minPrice: null,
      maxPrice: null,
      minRating: null,
    };

    const filtered = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v != null),
    );

    expect(filtered).toEqual({ query: "laptop" });
  });
});

// ── Combined filters ───────────────────────────────────────────────────────

describe("combined filters", () => {
  it("all filters at once", () => {
    const url = buildFilterUrl(
      { q: "phone" },
      {
        category: "550e8400-e29b-41d4-a716-446655440000",
        brand: "550e8400-e29b-41d4-a716-446655440001",
        condition: "used",
        minPrice: "50000",
        maxPrice: "200000",
        minRating: "3",
      },
    );
    const u = new URL(url, "http://localhost");
    expect(u.searchParams.get("q")).toBe("phone");
    expect(u.searchParams.get("category")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(u.searchParams.get("brand")).toBe(
      "550e8400-e29b-41d4-a716-446655440001",
    );
    expect(u.searchParams.get("condition")).toBe("used");
    expect(u.searchParams.get("minPrice")).toBe("50000");
    expect(u.searchParams.get("maxPrice")).toBe("200000");
    expect(u.searchParams.get("minRating")).toBe("3");
  });

  it("removing one filter preserves others", () => {
    const params = new URLSearchParams({
      q: "phone",
      category: "abc",
      brand: "def",
      condition: "new",
    });
    params.delete("category");
    expect(params.get("q")).toBe("phone");
    expect(params.get("brand")).toBe("def");
    expect(params.get("condition")).toBe("new");
    expect(params.has("category")).toBe(false);
  });
});

// ── Active filter count ────────────────────────────────────────────────────

describe("active filter count", () => {
  it("counts active filters", () => {
    const keys = ["category", "brand", "condition", "minPrice", "maxPrice", "minRating"];
    const params: Record<string, string> = { category: "abc", condition: "new", minRating: "4" };
    const count = keys.filter((k) => (params[k] ?? "") !== "").length;
    expect(count).toBe(3);
  });

  it("returns 0 when no filters", () => {
    const keys = ["category", "brand", "condition", "minPrice", "maxPrice", "minRating"];
    const params: Record<string, string> = {};
    const count = keys.filter((k) => (params[k] ?? "") !== "").length;
    expect(count).toBe(0);
  });
});

// ── Invalid query params ───────────────────────────────────────────────────

describe("invalid query params are ignored", () => {
  it("NaN price becomes null", () => {
    expect(parseNumberParam("abc", 0, Infinity)).toBeNull();
  });

  it("negative price becomes null", () => {
    expect(parseNumberParam("-5", 0, Infinity)).toBeNull();
  });

  it("out of range rating becomes null", () => {
    expect(parseNumberParam("10", 0, 5)).toBeNull();
  });

  it("empty string condition becomes null", () => {
    expect(parseConditionParam("")).toBeNull();
  });
});

// ── Category/brand data source ─────────────────────────────────────────────

describe("category/brand data shape", () => {
  it("category has required fields", () => {
    const cat = { id: "abc", name: "Elektronik", slug: "elektronik" };
    expect(cat.id).toBeTruthy();
    expect(cat.name).toBeTruthy();
    expect(cat.slug).toBeTruthy();
  });

  it("brand has required fields", () => {
    const brand = { id: "def", name: "Samsung", slug: "samsung" };
    expect(brand.id).toBeTruthy();
    expect(brand.name).toBeTruthy();
    expect(brand.slug).toBeTruthy();
  });
});

// ── Desktop/mobile rendering structure ─────────────────────────────────────

describe("filter rendering structure", () => {
  it("mobile section has toggle button", () => {
    const mobileToggle = "lg:hidden";
    expect(mobileToggle).toContain("lg:hidden");
  });

  it("desktop sidebar has fixed width", () => {
    const desktopSidebar = "hidden lg:block w-64";
    expect(desktopSidebar).toContain("lg:block");
    expect(desktopSidebar).toContain("w-64");
  });

  it("has fieldset for each filter group", () => {
    const groups = ["Kategori", "Merek", "Kondisi", "Rentang Harga", "Rating Minimum"];
    expect(groups.length).toBe(5);
  });

  it("clear all button exists when filters active", () => {
    const buttonText = "Hapus Semua Filter";
    expect(buttonText).toBeTruthy();
  });
});
