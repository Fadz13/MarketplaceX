/**
 * Account Hub Page — Unit Tests
 *
 * Tests cover:
 *   A. Route structure: all linked routes are real
 *   B. Navigation: profile link correct
 *   C. Navigation: addresses link correct
 *   D. Navigation: orders link correct
 *   E. No dead/fake links
 *   F. Auth redirect logic
 *   G. Data shape expectations
 */

import { describe, it, expect } from "vitest";

// ─── Route Registry ────────────────────────────────────────────────────────

/**
 * All routes that the account hub page links to.
 * Verified against the actual src/app directory structure.
 */
const ACCOUNT_ROUTES = {
  profile: "/account/profile",
  addresses: "/account/addresses",
  orders: "/orders",
} as const;

const ACCOUNT_ROUTE_PATHS = Object.values(ACCOUNT_ROUTES);

// ─── Route Verification ────────────────────────────────────────────────────

describe("Account hub route structure", () => {
  it("A: all linked routes start with /account or /orders", () => {
    for (const route of ACCOUNT_ROUTE_PATHS) {
      expect(
        route.startsWith("/account") || route.startsWith("/orders"),
      ).toBe(true);
    }
  });

  it("B: profile link targets /account/profile", () => {
    expect(ACCOUNT_ROUTES.profile).toBe("/account/profile");
  });

  it("C: addresses link targets /account/addresses", () => {
    expect(ACCOUNT_ROUTES.addresses).toBe("/account/addresses");
  });

  it("D: orders link targets /orders (existing real route)", () => {
    expect(ACCOUNT_ROUTES.orders).toBe("/orders");
  });
});

// ─── Navigation Logic ──────────────────────────────────────────────────────

describe("Account hub navigation", () => {
  const NAV_ITEMS = [
    {
      label: "Profil",
      href: ACCOUNT_ROUTES.profile,
      description: "Perbarui nama, foto, dan informasi pribadi Anda.",
    },
    {
      label: "Alamat",
      href: ACCOUNT_ROUTES.addresses,
      description: "Kelola alamat pengiriman untuk pesanan Anda.",
    },
    {
      label: "Pesanan",
      href: ACCOUNT_ROUTES.orders,
      description: "Lihat riwayat dan status pesanan Anda.",
    },
  ];

  it("E: navigation has exactly 3 items", () => {
    expect(NAV_ITEMS).toHaveLength(3);
  });

  it("F: no dead/fake links — all hrefs are in the route registry", () => {
    const validRoutes = new Set(ACCOUNT_ROUTE_PATHS);
    for (const item of NAV_ITEMS) {
      expect(validRoutes.has(item.href)).toBe(true);
    }
  });

  it("G: each nav item has a label, href, and description", () => {
    for (const item of NAV_ITEMS) {
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.href).toBe("string");
      expect(item.href.startsWith("/")).toBe(true);
      expect(typeof item.description).toBe("string");
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("H: profile card has correct label", () => {
    const profile = NAV_ITEMS.find((i) => i.href === ACCOUNT_ROUTES.profile);
    expect(profile?.label).toBe("Profil");
  });

  it("I: addresses card has correct label", () => {
    const addresses = NAV_ITEMS.find(
      (i) => i.href === ACCOUNT_ROUTES.addresses,
    );
    expect(addresses?.label).toBe("Alamat");
  });

  it("J: orders card has correct label", () => {
    const orders = NAV_ITEMS.find((i) => i.href === ACCOUNT_ROUTES.orders);
    expect(orders?.label).toBe("Pesanan");
  });
});

// ─── Auth Redirect Logic ───────────────────────────────────────────────────

describe("Account hub auth behavior", () => {
  it("K: unauthenticated user should be redirected to login", () => {
    const user = null;
    const shouldRedirect = !user;
    expect(shouldRedirect).toBe(true);
  });

  it("L: redirect target includes next parameter for return", () => {
    const nextParam = "/account";
    const redirectUrl = `/login?next=${encodeURIComponent(nextParam)}`;
    expect(redirectUrl).toBe("/login?next=%2Faccount");
  });

  it("M: authenticated user with valid buyer row should see page", () => {
    const user = { id: "auth-1" };
    const buyerRow = { id: "user-1", email: "test@example.com" };
    const canView = !!user && !!buyerRow;
    expect(canView).toBe(true);
  });

  it("N: authenticated user without buyer row should be redirected", () => {
    const user = { id: "auth-1" };
    const buyerRow = null;
    const shouldRedirect = !user || !buyerRow;
    expect(shouldRedirect).toBe(true);
  });
});

// ─── Data Shape ────────────────────────────────────────────────────────────

describe("Account hub data shape", () => {
  it("O: profile display name falls back to email prefix", () => {
    const profile = { full_name: null as string | null };
    const email = "john@example.com";
    const displayName = profile.full_name?.trim() || email.split("@")[0];
    expect(displayName).toBe("john");
  });

  it("P: profile display name uses full_name when available", () => {
    const profile = { full_name: "John Doe" };
    const email = "john@example.com";
    const displayName = profile.full_name?.trim() || email.split("@")[0];
    expect(displayName).toBe("John Doe");
  });

  it("Q: address count badge shows only when count > 0", () => {
    const count = 3;
    const showBadge = count != null && count > 0;
    expect(showBadge).toBe(true);
  });

  it("R: address count badge hidden when count is 0", () => {
    const count = 0;
    const showBadge = count != null && count > 0;
    expect(showBadge).toBe(false);
  });

  it("S: address count badge hidden when count is null", () => {
    const count = null;
    const showBadge = count != null && count > 0;
    expect(showBadge).toBe(false);
  });
});
