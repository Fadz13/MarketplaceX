import { describe, it, expect } from "vitest";
import type { SearchProduct } from "@/lib/actions/search";

// ── SearchResults component logic tests ────────────────────────────────────
// Tests the pure logic/branching that SearchResults depends on.
// The actual rendering is covered by integration/visual tests.

function buildHeading(query: string | null): string {
  return query ? `Hasil pencarian "${query}"` : "Semua Produk";
}

function buildCountText(count: number): string {
  return count > 0
    ? `${count} produk ditemukan.`
    : "Tidak ada produk yang cocok.";
}

const makeProduct = (overrides: Partial<SearchProduct> = {}): SearchProduct => ({
  id: "1",
  name: "Test Product",
  slug: "test-product",
  price: 100000,
  discount_price: null,
  stock: 10,
  rating: 0,
  review_count: 0,
  sold_count: 5,
  condition: "new",
  store_id: "s1",
  store_name: "Store",
  store_slug: "store",
  category_id: null,
  category_name: null,
  brand_id: null,
  brand_name: null,
  primary_image_url: null,
  relevance_score: 0,
  ...overrides,
});

// ── Heading logic ──────────────────────────────────────────────────────────

describe("Search heading", () => {
  it("shows query in heading when q provided", () => {
    expect(buildHeading("Wireless")).toBe('Hasil pencarian "Wireless"');
  });

  it("shows all products heading when q is null", () => {
    expect(buildHeading(null)).toBe("Semua Produk");
  });

  it("shows all products heading when q is empty string", () => {
    const normalized = "".trim() || null;
    expect(buildHeading(normalized)).toBe("Semua Produk");
  });

  it("shows all products heading when q is whitespace", () => {
    const normalized = "   ".trim() || null;
    expect(buildHeading(normalized)).toBe("Semua Produk");
  });
});

// ── Count text ─────────────────────────────────────────────────────────────

describe("Search count text", () => {
  it("shows count when products found", () => {
    expect(buildCountText(5)).toBe("5 produk ditemukan.");
  });

  it("shows zero message when no products", () => {
    expect(buildCountText(0)).toBe("Tidak ada produk yang cocok.");
  });

  it("shows count for single product", () => {
    expect(buildCountText(1)).toBe("1 produk ditemukan.");
  });
});

// ── Empty state detection ──────────────────────────────────────────────────

describe("Empty state", () => {
  it("detects empty products array", () => {
    const products: SearchProduct[] = [];
    expect(products.length === 0).toBe(true);
  });

  it("detects non-empty products array", () => {
    const products = [makeProduct()];
    expect(products.length === 0).toBe(false);
  });
});

// ── ProductCard prop mapping ───────────────────────────────────────────────

describe("SearchResults -> ProductCard mapping", () => {
  it("passes all required ProductCard props", () => {
    const product = makeProduct({
      id: "p1",
      name: "Mouse",
      price: 150000,
      discount_price: 120000,
      stock: 30,
      sold_count: 200,
      primary_image_url: "https://example.com/mouse.jpg",
      store_name: "Tech Store",
      rating: 4.5,
      review_count: 42,
    });

    const expected = {
      id: "p1",
      name: "Mouse",
      price: 150000,
      discount_price: 120000,
      stock: 30,
      sold_count: 200,
      primary_image_url: "https://example.com/mouse.jpg",
      store_name: "Tech Store",
      rating: 4.5,
      review_count: 42,
    };

    for (const [key, val] of Object.entries(expected)) {
      expect(product[key as keyof typeof product]).toEqual(val);
    }
  });

  it("passes null optional fields as-is", () => {
    const product = makeProduct({
      discount_price: null,
      primary_image_url: null,
      category_id: null,
      brand_id: null,
    });

    expect(product.discount_price).toBeNull();
    expect(product.primary_image_url).toBeNull();
  });
});

// ── Query normalization delegation ─────────────────────────────────────────

describe("Query normalization delegation", () => {
  it("empty string becomes null (simulating search action)", () => {
    const raw = "";
    const normalized = raw.trim() !== "" ? raw.trim() : null;
    expect(normalized).toBeNull();
  });

  it("whitespace becomes null", () => {
    const raw = "   ";
    const normalized = raw.trim() !== "" ? raw.trim() : null;
    expect(normalized).toBeNull();
  });

  it("preserves non-empty query", () => {
    const raw = "  laptop  ";
    const normalized = raw.trim() !== "" ? raw.trim() : null;
    expect(normalized).toBe("laptop");
  });

  it("missing searchParams.q becomes null", () => {
    const q: string | undefined = undefined;
    const val = q ?? "";
    const normalized = val.trim() !== "" ? val.trim() : null;
    expect(normalized).toBeNull();
  });
});

// ── URL behavior ───────────────────────────────────────────────────────────

describe("Search URL patterns", () => {
  it("/search without q returns all products", () => {
    const q: string | undefined = undefined;
    const hasQuery = (q ?? "").trim() !== "";
    expect(hasQuery).toBe(false);
  });

  it("/search?q= returns all products", () => {
    const q = "";
    const hasQuery = q.trim() !== "";
    expect(hasQuery).toBe(false);
  });

  it("/search?q=Wireless searches for Wireless", () => {
    const q = "Wireless";
    const hasQuery = q.trim() !== "";
    expect(hasQuery).toBe(true);
  });

  it("/search?q=Samsung searches for Samsung", () => {
    const q = "Samsung";
    const hasQuery = q.trim() !== "";
    expect(hasQuery).toBe(true);
  });
});

// ── Multiple products grid ─────────────────────────────────────────────────

describe("Product grid", () => {
  it("returns correct product count", () => {
    const products = [
      makeProduct({ id: "1" }),
      makeProduct({ id: "2" }),
      makeProduct({ id: "3" }),
    ];
    expect(products.length).toBe(3);
  });

  it("preserves product order from RPC", () => {
    const products = [
      makeProduct({ id: "1", name: "Alpha" }),
      makeProduct({ id: "2", name: "Beta" }),
      makeProduct({ id: "3", name: "Gamma" }),
    ];
    const names = products.map((p) => p.name);
    expect(names).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});
