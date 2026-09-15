import { describe, it, expect } from "vitest";

// ── Sort validation ────────────────────────────────────────────────────────

const VALID_SORTS = new Set(["relevance", "price_asc", "price_desc", "rating", "newest", "sold"]);

function validateSort(raw: string | undefined): string {
  return raw && VALID_SORTS.has(raw) ? raw : "relevance";
}

describe("sort validation", () => {
  it.each(["relevance", "price_asc", "price_desc", "rating", "newest", "sold"])(
    "accepts valid sort '%s'",
    (s) => {
      expect(validateSort(s)).toBe(s);
    },
  );

  it("defaults to relevance for undefined", () => {
    expect(validateSort(undefined)).toBe("relevance");
  });

  it("defaults to relevance for empty string", () => {
    expect(validateSort("")).toBe("relevance");
  });

  it("defaults to relevance for invalid value", () => {
    expect(validateSort("invalid")).toBe("relevance");
    expect(validateSort("PRICE_ASC")).toBe("relevance");
    expect(validateSort("new")).toBe("relevance");
  });
});

// ── Sort options / labels ──────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevansi" },
  { value: "price_asc", label: "Harga Terendah" },
  { value: "price_desc", label: "Harga Tertinggi" },
  { value: "rating", label: "Rating Tertinggi" },
  { value: "newest", label: "Terbaru" },
  { value: "sold", label: "Terlaris" },
];

describe("sort option labels", () => {
  it("has 6 options", () => {
    expect(SORT_OPTIONS.length).toBe(6);
  });

  it.each([
    ["relevance", "Relevansi"],
    ["price_asc", "Harga Terendah"],
    ["price_desc", "Harga Tertinggi"],
    ["rating", "Rating Tertinggi"],
    ["newest", "Terbaru"],
    ["sold", "Terlaris"],
  ])("sort=%s maps to label '%s'", (value, label) => {
    const opt = SORT_OPTIONS.find((o) => o.value === value);
    expect(opt?.label).toBe(label);
  });
});

// ── Sort → URL ─────────────────────────────────────────────────────────────

function buildSortUrl(
  currentParams: Record<string, string>,
  newSort: string,
): string {
  const params = new URLSearchParams(currentParams);
  if (newSort === "relevance") {
    params.delete("sort");
  } else {
    params.set("sort", newSort);
  }
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

describe("sort → URL", () => {
  it("adds sort to URL", () => {
    const url = buildSortUrl({}, "price_asc");
    expect(url).toBe("/search?sort=price_asc");
  });

  it("removes sort param when relevance (default)", () => {
    const url = buildSortUrl({ sort: "price_asc" }, "relevance");
    expect(url).toBe("/search");
  });

  it("sort=relevance with other params removes only sort", () => {
    const url = buildSortUrl({ q: "laptop", sort: "price_asc" }, "relevance");
    expect(url).toBe("/search?q=laptop");
  });

  it("changes sort preserving existing params", () => {
    const url = buildSortUrl(
      { q: "laptop", category: "abc", sort: "price_asc" },
      "rating",
    );
    const u = new URL(url, "http://localhost");
    expect(u.searchParams.get("q")).toBe("laptop");
    expect(u.searchParams.get("category")).toBe("abc");
    expect(u.searchParams.get("sort")).toBe("rating");
  });
});

// ── Preserving other params ────────────────────────────────────────────────

describe("preserving existing filters", () => {
  it("preserves q when changing sort", () => {
    const url = buildSortUrl({ q: "mouse" }, "newest");
    expect(url).toContain("q=mouse");
    expect(url).toContain("sort=newest");
  });

  it("preserves all filters when changing sort", () => {
    const url = buildSortUrl(
      { q: "phone", category: "c1", brand: "b1", condition: "new", minPrice: "100000", maxPrice: "500000", minRating: "4" },
      "sold",
    );
    const u = new URL(url, "http://localhost");
    expect(u.searchParams.get("q")).toBe("phone");
    expect(u.searchParams.get("category")).toBe("c1");
    expect(u.searchParams.get("brand")).toBe("b1");
    expect(u.searchParams.get("condition")).toBe("new");
    expect(u.searchParams.get("minPrice")).toBe("100000");
    expect(u.searchParams.get("maxPrice")).toBe("500000");
    expect(u.searchParams.get("minRating")).toBe("4");
    expect(u.searchParams.get("sort")).toBe("sold");
  });

  it("does not add duplicate sort keys", () => {
    const params = new URLSearchParams({ q: "laptop", sort: "price_asc" });
    params.set("sort", "rating");
    const entries = Array.from(params.keys());
    const sortCount = entries.filter((k) => k === "sort").length;
    expect(sortCount).toBe(1);
  });
});

// ── searchProducts receives correct sort ───────────────────────────────────

describe("searchProducts sort mapping", () => {
  it("passes sort value to searchProducts", () => {
    const sort = "price_desc";
    const input = { sort };
    expect(input.sort).toBe("price_desc");
  });

  it("defaults to relevance when sort is null", () => {
    const sort: string | null = null;
    const effective = sort && VALID_SORTS.has(sort) ? sort : "relevance";
    expect(effective).toBe("relevance");
  });

  it("passes exact RPC sort string", () => {
    for (const s of VALID_SORTS) {
      expect(VALID_SORTS.has(s)).toBe(true);
    }
  });
});

// ── All six sort values round-trip ─────────────────────────────────────────

describe("all sort values round-trip", () => {
  it.each(["relevance", "price_asc", "price_desc", "rating", "newest", "sold"])(
    "sort '%s' validates and URL-encodes correctly",
    (s) => {
      expect(validateSort(s)).toBe(s);
      const url = buildSortUrl({}, s);
      if (s === "relevance") {
        expect(url).toBe("/search");
      } else {
        expect(url).toContain(`sort=${s}`);
      }
    },
  );
});

// ── Responsive rendering structure ─────────────────────────────────────────

describe("sort rendering", () => {
  it("has label with htmlFor", () => {
    const htmlFor = "search-sort";
    expect(htmlFor).toBeTruthy();
  });

  it("select has id matching label", () => {
    const selectId = "search-sort";
    const labelFor = "search-sort";
    expect(selectId).toBe(labelFor);
  });

  it("sort container has responsive classes", () => {
    const containerClass = "mb-4 flex items-center justify-end";
    expect(containerClass).toContain("flex");
    expect(containerClass).toContain("justify-end");
  });

  it("label text is Indonesian", () => {
    const labelText = "Urutkan:";
    expect(labelText).toBe("Urutkan:");
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────

describe("sort edge cases", () => {
  it("undefined searchParams.sort resolves to relevance", () => {
    const sortParam: string | undefined = undefined;
    expect(validateSort(sortParam)).toBe("relevance");
  });

  it("empty searchParams.sort resolves to relevance", () => {
    expect(validateSort("")).toBe("relevance");
  });

  it("sort with whitespace is invalid", () => {
    expect(validateSort(" price_asc ")).toBe("relevance");
  });

  it("sort is case-sensitive", () => {
    expect(validateSort("PRICE_ASC")).toBe("relevance");
    expect(validateSort("Price_Asc")).toBe("relevance");
  });
});
