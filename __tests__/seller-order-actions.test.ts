/**
 * Seller Order Actions — Unit Tests (Updated for Item-Level Model)
 *
 * Tests cover:
 *   A. Seller actor permissions in transition matrix
 *   B. processSellerOrder — item-level processing
 *   C. shipSellerOrder — item-level shipping
 *   D. Unauthorized actors
 *   E. Full lifecycle transitions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isActorAllowed,
  computeOrderStatus,
} from "@/lib/order-status";

// ─── Mock Helpers ────────────────────────────────────────────────────────────

type MockUser = { id: string; role?: string } | null;
type MockOrder = {
  id: string;
  payment_status?: string;
  shipping_snapshot?: Record<string, unknown> | null;
  [key: string]: unknown;
} | null;

function createChainMock(result: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: result, error });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: result, error });
  chain.then = (
    resolve: (value: { data: unknown; error: unknown; count: null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ data: result, error, count: null }).then(resolve, reject);
  return chain;
}

function createMockSupabase(
  authUser: { id: string } | null,
  userRow: MockUser,
  order: MockOrder = null,
  sellerItems: Array<{ id: string; status: string }> = [],
) {
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: authUser },
      error: authUser ? null : new Error("Not authenticated"),
    }),
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === "users") {
      return createChainMock(userRow);
    } else if (table === "orders") {
      return createChainMock(order, order ? null : new Error("Order not found"));
    } else if (table === "order_items") {
      return createChainMock(sellerItems);
    } else if (table === "shipments") {
      return createChainMock({ id: "shipment-new" });
    } else if (table === "shipment_tracking") {
      return createChainMock([]);
    }
    return createChainMock(null);
  });

  return {
    auth: mockAuth,
    from: mockFrom,
  };
}

// ─── Mock Module ─────────────────────────────────────────────────────────────

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => mockSupabase),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── A. Seller actor permissions ─────────────────────────────────────────────

describe("A. Seller actor permissions", () => {
  it("seller can do paid → processing", () => {
    expect(isActorAllowed("seller", "paid", "processing")).toBe(true);
  });

  it("seller can do processing → shipped", () => {
    expect(isActorAllowed("seller", "processing", "shipped")).toBe(true);
  });

  it("seller cannot do pending → processing", () => {
    expect(isActorAllowed("seller", "pending", "processing")).toBe(false);
  });

  it("seller cannot do paid → shipped (skips processing)", () => {
    expect(isActorAllowed("seller", "paid", "shipped")).toBe(false);
  });

  it("seller cannot do paid → cancelled", () => {
    expect(isActorAllowed("seller", "paid", "cancelled")).toBe(false);
  });

  it("seller cannot do paid → refunded", () => {
    expect(isActorAllowed("seller", "paid", "refunded")).toBe(false);
  });

  it("seller cannot do processing → cancelled", () => {
    expect(isActorAllowed("seller", "processing", "cancelled")).toBe(false);
  });

  it("seller cannot do shipped → delivered", () => {
    expect(isActorAllowed("seller", "shipped", "delivered")).toBe(false);
  });

  it("seller cannot do delivered → completed", () => {
    expect(isActorAllowed("seller", "delivered", "completed")).toBe(false);
  });

  it("seller cannot do any transition from terminal states", () => {
    expect(isActorAllowed("seller", "cancelled", "paid")).toBe(false);
    expect(isActorAllowed("seller", "refunded", "paid")).toBe(false);
    expect(isActorAllowed("seller", "disputed", "paid")).toBe(false);
  });
});

// ─── B. processSellerOrder ───────────────────────────────────────────────────

describe("B. processSellerOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Unauthorized when not authenticated", async () => {
    mockSupabase = createMockSupabase(null, null);
    const { processSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(processSellerOrder("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws Unauthorized when user is buyer", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer" },
      { id: "buyer-1", role: "buyer" },
    );
    const { processSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(processSellerOrder("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws error when seller does not own any order item", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", payment_status: "success" },
      [],
    );
    const { processSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(processSellerOrder("order-123")).rejects.toThrow("No items found for this seller in this order.");
  });

  it("processes order when seller owns items and payment is confirmed", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", payment_status: "success" },
      [{ id: "item-1", status: "paid" }],
    );
    const { processSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(processSellerOrder("order-123")).resolves.toEqual({ success: true });
  });

  it("throws error when payment is not confirmed", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", payment_status: "pending" },
      [{ id: "item-1", status: "paid" }],
    );
    const { processSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(processSellerOrder("order-123")).rejects.toThrow("Payment has not been confirmed.");
  });

  it("returns success with message when items already processed", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", payment_status: "success" },
      [{ id: "item-1", status: "processing" }],
    );
    const { processSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(processSellerOrder("order-123")).resolves.toEqual({
      success: true,
      message: "Items already processed.",
    });
  });
});

// ─── C. shipSellerOrder ──────────────────────────────────────────────────────

describe("C. shipSellerOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Unauthorized when not authenticated", async () => {
    mockSupabase = createMockSupabase(null, null);
    const { shipSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(
      shipSellerOrder({ orderId: "order-123", courier: "JNE", trackingNumber: "JT123" }),
    ).rejects.toThrow("Unauthorized.");
  });

  it("throws error when courier is empty", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", shipping_snapshot: null },
      [{ id: "item-1", status: "processing" }],
    );
    const { shipSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(
      shipSellerOrder({ orderId: "order-123", courier: "", trackingNumber: "JT123" }),
    ).rejects.toThrow("Courier is required.");
  });

  it("throws error when tracking number is empty", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", shipping_snapshot: null },
      [{ id: "item-1", status: "processing" }],
    );
    const { shipSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(
      shipSellerOrder({ orderId: "order-123", courier: "JNE", trackingNumber: "" }),
    ).rejects.toThrow("Tracking number is required.");
  });

  it("creates shipment when seller has processing items", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", shipping_snapshot: null },
      [{ id: "item-1", status: "processing" }],
    );
    const { shipSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(
      shipSellerOrder({ orderId: "order-123", courier: "JNE", trackingNumber: "JT123" }),
    ).resolves.toEqual({ success: true });
  });

  it("returns success with message when no items ready for shipping", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
      { id: "order-123", shipping_snapshot: null },
      [{ id: "item-1", status: "paid" }],
    );
    const { shipSellerOrder } = await import("@/lib/actions/seller-orders");
    await expect(
      shipSellerOrder({ orderId: "order-123", courier: "JNE", trackingNumber: "JT123" }),
    ).resolves.toEqual({
      success: true,
      message: "No items ready for shipping.",
    });
  });
});

// ─── D. Unauthorized actors ─────────────────────────────────────────────────

describe("D. Unauthorized actors", () => {
  it("buyer cannot process order", () => {
    expect(isActorAllowed("buyer", "paid", "processing")).toBe(false);
  });

  it("buyer cannot ship order", () => {
    expect(isActorAllowed("buyer", "processing", "shipped")).toBe(false);
  });

  it("webhook cannot process order", () => {
    expect(isActorAllowed("webhook", "paid", "processing")).toBe(false);
  });

  it("webhook cannot ship order", () => {
    expect(isActorAllowed("webhook", "processing", "shipped")).toBe(false);
  });

  it("admin can process order", () => {
    expect(isActorAllowed("admin", "paid", "processing")).toBe(true);
  });

  it("admin can ship order", () => {
    expect(isActorAllowed("admin", "processing", "shipped")).toBe(true);
  });
});

// ─── E. Full lifecycle transitions ───────────────────────────────────────────

describe("E. Full lifecycle transitions", () => {
  it("seller can complete paid → processing → shipped", () => {
    expect(isActorAllowed("seller", "paid", "processing")).toBe(true);
    expect(isActorAllowed("seller", "processing", "shipped")).toBe(true);
  });

  it("seller cannot skip processing step", () => {
    expect(isActorAllowed("seller", "paid", "shipped")).toBe(false);
  });

  it("seller cannot go back from processing to paid", () => {
    expect(isActorAllowed("seller", "processing", "paid")).toBe(false);
  });

  it("seller cannot go back from shipped to processing", () => {
    expect(isActorAllowed("seller", "shipped", "processing")).toBe(false);
  });

  it("computeOrderStatus: multi-seller full lifecycle", () => {
    expect(computeOrderStatus(["paid", "paid"])).toBe("paid");
    expect(computeOrderStatus(["processing", "paid"])).toBe("paid");
    expect(computeOrderStatus(["processing", "processing"])).toBe("processing");
    expect(computeOrderStatus(["shipped", "processing"])).toBe("processing");
    expect(computeOrderStatus(["shipped", "shipped"])).toBe("shipped");
  });
});
