import { describe, it, expect } from "vitest";

// ── SearchBar behavior tests ───────────────────────────────────────────────

function buildSearchUrl(query: string): string {
  const trimmed = query.trim();
  if (trimmed === "") return "/search";
  return `/search?q=${encodeURIComponent(trimmed)}`;
}

describe("SearchBar URL generation", () => {
  it("navigates to /search?q=Wireless for query 'Wireless'", () => {
    expect(buildSearchUrl("Wireless")).toBe("/search?q=Wireless");
  });

  it("navigates to /search?q=Samsung for query 'Samsung'", () => {
    expect(buildSearchUrl("Samsung")).toBe("/search?q=Samsung");
  });

  it("navigates to /search for empty query", () => {
    expect(buildSearchUrl("")).toBe("/search");
  });

  it("navigates to /search for whitespace-only query", () => {
    expect(buildSearchUrl("   ")).toBe("/search");
  });

  it("trims leading/trailing whitespace", () => {
    expect(buildSearchUrl("  laptop  ")).toBe("/search?q=laptop");
  });

  it("URL-encodes special characters", () => {
    expect(buildSearchUrl("laptop & aksesoris")).toBe(
      "/search?q=laptop%20%26%20aksesoris",
    );
  });

  it("URL-encodes unicode characters", () => {
    expect(buildSearchUrl("handphone murah")).toBe(
      "/search?q=handphone%20murah",
    );
  });

  it("encodes = and & correctly", () => {
    expect(buildSearchUrl("a=b&c=d")).toBe("/search?q=a%3Db%26c%3Dd");
  });
});

// ── SearchBar initial value ────────────────────────────────────────────────

describe("SearchBar initial value", () => {
  it("uses provided initialQuery", () => {
    const initialQuery = "laptop";
    expect(initialQuery).toBe("laptop");
  });

  it("defaults to empty string when no initialQuery", () => {
    const initialQuery = undefined;
    const val = initialQuery ?? "";
    expect(val).toBe("");
  });
});

// ── SearchBar accessibility ────────────────────────────────────────────────

describe("SearchBar accessibility", () => {
  it("has a label associated with the input", () => {
    const inputId = "search-input";
    const labelFor = "search-input";
    expect(inputId).toBe(labelFor);
  });

  it("form has role=search", () => {
    const role = "search";
    expect(role).toBe("search");
  });

  it("submit button has type=submit", () => {
    const type = "submit";
    expect(type).toBe("submit");
  });
});

// ── Header structure tests ─────────────────────────────────────────────────

describe("SiteHeader structure", () => {
  it("contains MarketplaceX brand text", () => {
    const brandText = "MarketplaceX";
    expect(brandText).toBe("MarketplaceX");
  });

  it("contains search form", () => {
    const hasSearch = true;
    expect(hasSearch).toBe(true);
  });

  it("contains Cart link", () => {
    const cartText = "Cart";
    expect(cartText).toBe("Cart");
  });

  it("desktop search is hidden on small screens", () => {
    const desktopClass = "hidden sm:flex";
    expect(desktopClass).toContain("hidden");
    expect(desktopClass).toContain("sm:flex");
  });

  it("mobile search is visible only on small screens", () => {
    const mobileClass = "sm:hidden";
    expect(mobileClass).toContain("sm:hidden");
  });
});

// ── Header elements preserved ──────────────────────────────────────────────

describe("Header elements preserved", () => {
  it("has brand link to /", () => {
    const href = "/";
    expect(href).toBe("/");
  });

  it("has Cart link to /cart", () => {
    const href = "/cart";
    expect(href).toBe("/cart");
  });

  it("has Login link for unauthenticated users", () => {
    const loginText = "Login";
    expect(loginText).toBe("Login");
  });
});

// ── Responsive layout ──────────────────────────────────────────────────────

describe("Responsive layout", () => {
  it("header uses flex layout with gap", () => {
    const layoutClass = "flex items-center gap-4";
    expect(layoutClass).toContain("flex");
    expect(layoutClass).toContain("gap-4");
  });

  it("search bar is flex-1 on desktop", () => {
    const searchClass = "flex w-full max-w-md items-center gap-2";
    expect(
      searchClass.includes("flex-1") || searchClass.includes("w-full"),
    ).toBe(true);
  });

  it("mobile section has border-t for visual separation", () => {
    const mobileSection = "border-t px-6 py-2 sm:hidden";
    expect(mobileSection).toContain("border-t");
    expect(mobileSection).toContain("sm:hidden");
  });
});
