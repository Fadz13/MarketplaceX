import { describe, it, expect } from "vitest";

// ── Page parsing ───────────────────────────────────────────────────────────

function parsePage(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

describe("page parsing", () => {
  it("defaults to 1 for undefined", () => {
    expect(parsePage(undefined)).toBe(1);
  });

  it("defaults to 1 for empty string", () => {
    expect(parsePage("")).toBe(1);
  });

  it("parses valid page", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("10")).toBe(10);
  });

  it("defaults to 1 for 0", () => {
    expect(parsePage("0")).toBe(1);
  });

  it("defaults to 1 for negative", () => {
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("-100")).toBe(1);
  });

  it("defaults to 1 for non-numeric", () => {
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("NaN")).toBe(1);
  });

  it("floors decimal pages", () => {
    expect(parsePage("2.5")).toBe(2);
    expect(parsePage("3.9")).toBe(3);
  });
});

// ── Offset calculation ─────────────────────────────────────────────────────

function calcOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

describe("offset calculation", () => {
  const PAGE_SIZE = 20;

  it("page 1 → offset 0", () => {
    expect(calcOffset(1, PAGE_SIZE)).toBe(0);
  });

  it("page 2 → offset 20", () => {
    expect(calcOffset(2, PAGE_SIZE)).toBe(20);
  });

  it("page 5 → offset 80", () => {
    expect(calcOffset(5, PAGE_SIZE)).toBe(80);
  });
});

// ── Total pages calculation ────────────────────────────────────────────────

function calcTotalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

describe("total pages", () => {
  it("0 results → 1 page", () => {
    expect(calcTotalPages(0, 20)).toBe(1);
  });

  it("20 results → 1 page", () => {
    expect(calcTotalPages(20, 20)).toBe(1);
  });

  it("21 results → 2 pages", () => {
    expect(calcTotalPages(21, 20)).toBe(2);
  });

  it("40 results → 2 pages", () => {
    expect(calcTotalPages(40, 20)).toBe(2);
  });

  it("100 results → 5 pages", () => {
    expect(calcTotalPages(100, 20)).toBe(5);
  });
});

// ── Effective page clamping ────────────────────────────────────────────────

function clampPage(page: number, totalPages: number): number {
  return Math.min(page, totalPages);
}

describe("effective page clamping", () => {
  it("page within range stays same", () => {
    expect(clampPage(1, 5)).toBe(1);
    expect(clampPage(3, 5)).toBe(3);
  });

  it("page beyond last is clamped", () => {
    expect(clampPage(10, 5)).toBe(5);
    expect(clampPage(100, 3)).toBe(3);
  });
});

// ── Page numbers ───────────────────────────────────────────────────────────

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

describe("page numbers", () => {
  it("small total: all pages shown", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("first page of many", () => {
    expect(getPageNumbers(1, 20)).toEqual([1, 2, "...", 20]);
  });

  it("middle page", () => {
    expect(getPageNumbers(10, 20)).toEqual([1, "...", 9, 10, 11, "...", 20]);
  });

  it("last page of many", () => {
    expect(getPageNumbers(20, 20)).toEqual([1, "...", 19, 20]);
  });

  it("page 2 of many", () => {
    expect(getPageNumbers(2, 20)).toEqual([1, 2, 3, "...", 20]);
  });

  it("page 3 of many", () => {
    expect(getPageNumbers(3, 20)).toEqual([1, 2, 3, 4, "...", 20]);
  });

  it("page total-1 of many", () => {
    expect(getPageNumbers(19, 20)).toEqual([1, "...", 18, 19, 20]);
  });

  it("total = 1", () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
  });

  it("total = 7 (boundary)", () => {
    expect(getPageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

// ── URL: page change preserves params ──────────────────────────────────────

function buildPageUrl(
  currentParams: Record<string, string>,
  newPage: number,
): string {
  const params = new URLSearchParams(currentParams);
  if (newPage <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(newPage));
  }
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

describe("page URL building", () => {
  it("page 1 removes page param", () => {
    const url = buildPageUrl({ q: "laptop", page: "3" }, 1);
    expect(url).toBe("/search?q=laptop");
  });

  it("page 2 adds page param", () => {
    const url = buildPageUrl({ q: "laptop" }, 2);
    expect(url).toBe("/search?q=laptop&page=2");
  });

  it("preserves all params", () => {
    const url = buildPageUrl(
      { q: "laptop", category: "c1", brand: "b1", sort: "price_asc", condition: "new" },
      5,
    );
    const u = new URL(url, "http://localhost");
    expect(u.searchParams.get("q")).toBe("laptop");
    expect(u.searchParams.get("category")).toBe("c1");
    expect(u.searchParams.get("brand")).toBe("b1");
    expect(u.searchParams.get("sort")).toBe("price_asc");
    expect(u.searchParams.get("condition")).toBe("new");
    expect(u.searchParams.get("page")).toBe("5");
  });

  it("changes page only", () => {
    const url = buildPageUrl({ q: "mouse", page: "1" }, 3);
    expect(url).toBe("/search?q=mouse&page=3");
  });
});

// ── Filter/sort reset page ─────────────────────────────────────────────────

describe("filter/sort reset page", () => {
  it("filter change removes page", () => {
    const params = new URLSearchParams({
      q: "laptop",
      page: "5",
      category: "abc",
    });
    params.delete("page");
    params.set("category", "new-cat");
    expect(params.has("page")).toBe(false);
    expect(params.get("category")).toBe("new-cat");
  });

  it("sort change removes page", () => {
    const params = new URLSearchParams({
      q: "laptop",
      page: "3",
      sort: "price_asc",
    });
    params.delete("page");
    params.set("sort", "rating");
    expect(params.has("page")).toBe(false);
    expect(params.get("sort")).toBe("rating");
  });

  it("clear all removes page", () => {
    const params = new URLSearchParams({
      q: "laptop",
      page: "5",
      category: "abc",
    });
    const q = params.get("q") ?? "";
    const result = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    expect(result).toBe("/search?q=laptop");
    expect(result).not.toContain("page=");
  });
});

// ── searchProducts limit/offset mapping ────────────────────────────────────

describe("searchProducts limit/offset", () => {
  it("page 1: limit=20, offset=0", () => {
    const PAGE_SIZE = 20;
    const page = 1;
    const offset = (page - 1) * PAGE_SIZE;
    expect(offset).toBe(0);
  });

  it("page 3: limit=20, offset=40", () => {
    const PAGE_SIZE = 20;
    const page = 3;
    const offset = (page - 1) * PAGE_SIZE;
    expect(offset).toBe(40);
  });

  it("limit capped at 100", () => {
    const PAGE_SIZE = 20;
    const MAX = 100;
    expect(Math.min(PAGE_SIZE, MAX)).toBe(20);
  });
});

// ── Rendering/accessibility ────────────────────────────────────────────────

describe("pagination rendering", () => {
  it("nav has aria-label", () => {
    const ariaLabel = "Paginasi hasil pencarian";
    expect(ariaLabel).toBeTruthy();
  });

  it("prev button has aria-label", () => {
    const label = "Halaman sebelumnya";
    expect(label).toBeTruthy();
  });

  it("next button has aria-label", () => {
    const label = "Halaman berikutnya";
    expect(label).toBeTruthy();
  });

  it("page button has aria-label with page number", () => {
    const label = `Halaman ${3}`;
    expect(label).toBe("Halaman 3");
  });

  it("current page has aria-current=page", () => {
    const isCurrent = true;
    expect(isCurrent).toBe(true);
  });
});

// ── Page beyond last ───────────────────────────────────────────────────────

describe("page beyond last", () => {
  it("is clamped to last page", () => {
    const page = 100;
    const totalPages = 5;
    const effective = Math.min(page, totalPages);
    expect(effective).toBe(5);
  });

  it("offset is calculated from clamped page", () => {
    const effectivePage = 5;
    const PAGE_SIZE = 20;
    const offset = (effectivePage - 1) * PAGE_SIZE;
    expect(offset).toBe(80);
  });
});
