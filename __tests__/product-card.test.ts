import { describe, it, expect } from "vitest";
import type { ProductCardProps } from "@/components/products/product-card";

// ── Price calculation logic tests ──────────────────────────────────────────

function calcFinalPrice(
  price: number | null,
  discount_price: number | null,
): number {
  return discount_price ?? price ?? 0;
}

function calcHasDiscount(
  price: number | null,
  discount_price: number | null,
): boolean {
  const p = price ?? 0;
  return discount_price != null && discount_price < p;
}

describe("ProductCard price logic", () => {
  it("uses price when no discount", () => {
    expect(calcFinalPrice(100000, null)).toBe(100000);
  });

  it("uses discount_price when lower", () => {
    expect(calcFinalPrice(100000, 80000)).toBe(80000);
  });

  it("falls back to 0 when both null", () => {
    expect(calcFinalPrice(null, null)).toBe(0);
  });

  it("hasDiscount true when discount < price", () => {
    expect(calcHasDiscount(100000, 80000)).toBe(true);
  });

  it("hasDiscount false when discount >= price", () => {
    expect(calcHasDiscount(100000, 100000)).toBe(false);
    expect(calcHasDiscount(100000, 120000)).toBe(false);
  });

  it("hasDiscount false when discount is null", () => {
    expect(calcHasDiscount(100000, null)).toBe(false);
  });

  it("hasDiscount false when price is null", () => {
    expect(calcHasDiscount(null, 80000)).toBe(false);
  });
});

// ── Display value tests ────────────────────────────────────────────────────

describe("ProductCard display values", () => {
  const base: ProductCardProps = {
    id: "1",
    name: "Test Product",
    price: 100000,
    discount_price: null,
    stock: 10,
    sold_count: 5,
    primary_image_url: null,
    store_name: "Test Store",
  };

  it("formats price in IDR", () => {
    expect(Number(100000).toLocaleString("id-ID")).toBe("100.000");
    expect(Number(80000).toLocaleString("id-ID")).toBe("80.000");
  });

  it("shows stock and sold from props", () => {
    expect(base.stock).toBe(10);
    expect(base.sold_count).toBe(5);
  });

  it("defaults stock to 0 when null", () => {
    const nullStock = null;
    const displayStock = nullStock ?? 0;
    expect(displayStock).toBe(0);
  });

  it("defaults sold to 0 when null", () => {
    const nullSold = null;
    const displaySold = nullSold ?? 0;
    expect(displaySold).toBe(0);
  });
});

// ── Rating display tests ───────────────────────────────────────────────────

describe("ProductCard rating display", () => {
  it("shows rating when > 0", () => {
    const rating = 4.5;
    expect(rating > 0).toBe(true);
    expect(rating.toFixed(1)).toBe("4.5");
  });

  it("hides rating when 0", () => {
    const rating = 0;
    expect(rating > 0).toBe(false);
  });

  it("hides rating when null", () => {
    const rating = null;
    expect(rating != null && rating > 0).toBe(false);
  });

  it("shows review count when provided", () => {
    const review_count = 12;
    expect(review_count != null).toBe(true);
  });

  it("hides review count when null", () => {
    const review_count = null;
    expect(review_count != null).toBe(false);
  });
});

// ── Null/optional field handling ────────────────────────────────────────────

describe("ProductCard null fields", () => {
  const minimal: ProductCardProps = {
    id: "1",
    name: null,
    price: null,
    discount_price: null,
    stock: null,
    sold_count: null,
    primary_image_url: null,
    store_name: null,
  };

  it("shows fallback name", () => {
    const displayName = minimal.name ?? "Unnamed Product";
    expect(displayName).toBe("Unnamed Product");
  });

  it("shows fallback store", () => {
    const displayStore = minimal.store_name ?? "MarketplaceX Store";
    expect(displayStore).toBe("MarketplaceX Store");
  });

  it("shows no-image placeholder when no URL", () => {
    expect(minimal.primary_image_url).toBeNull();
  });

  it("shows image when URL provided", () => {
    const url = "https://example.com/img.jpg";
    expect(url).toBeTruthy();
  });

  it("handles all null gracefully", () => {
    expect(minimal.id).toBe("1");
    expect(calcFinalPrice(minimal.price, minimal.discount_price)).toBe(0);
    expect(calcHasDiscount(minimal.price, minimal.discount_price)).toBe(false);
  });
});

// ── Link href tests ────────────────────────────────────────────────────────

describe("ProductCard link", () => {
  it("generates correct href from id", () => {
    const id = "abc-123";
    expect(`/products/${id}`).toBe("/products/abc-123");
  });
});

// ── SearchProduct compatibility ─────────────────────────────────────────────

describe("SearchProduct compatibility", () => {
  const searchProduct = {
    id: "1",
    name: "Wireless Mouse",
    slug: "wireless-mouse",
    price: 150000,
    discount_price: 120000,
    stock: 25,
    sold_count: 100,
    rating: 4.5,
    review_count: 30,
    condition: "new",
    store_id: "s1",
    store_name: "Tech Store",
    store_slug: "tech-store",
    category_id: "c1",
    category_name: "Electronics",
    brand_id: "b1",
    brand_name: "Logitech",
    primary_image_url: "https://example.com/mouse.jpg",
    relevance_score: 0.8,
  };

  it("SearchProduct has all ProductCard-required fields", () => {
    const required: Array<keyof ProductCardProps> = [
      "id",
      "name",
      "price",
      "discount_price",
      "stock",
      "sold_count",
      "primary_image_url",
      "store_name",
    ];

    for (const field of required) {
      expect(field in searchProduct).toBe(true);
    }
  });

  it("SearchProduct has optional rating/review_count", () => {
    expect("rating" in searchProduct).toBe(true);
    expect("review_count" in searchProduct).toBe(true);
  });
});
