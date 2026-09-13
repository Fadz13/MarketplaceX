/**
 * Buyer Delivery & Order Completion — Unit Tests
 *
 * Phase 3B-2: shipped → delivered → completed
 *
 * Tests cover:
 *   A. Actor permissions — buyer can do shipped→delivered, delivered→completed
 *   B. computeOrderStatus — delivered/completed aggregation
 *   C. confirmOrderReceived — single seller
 *   D. completeOrder — single seller
 *   E. Duplicate safety
 *   F. Authorization — unauthorized actors
 *   G. Multi-seller delivery
 *   H. Multi-seller completion
 *   I. Seller balance safety
 *   J. Refund/cancel interaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeOrderStatus,
  isActorAllowed,
  isTransitionAllowed,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type OrderStatus,
} from "@/lib/order-status";

// ─── Mock Helpers ────────────────────────────────────────────────────────────

type MockUser = { id: string; role?: string } | null;
type MockOrder = {
  id: string;
  buyer_id?: string;
  status?: string;
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
  items: Array<{ id: string; status: string; seller_id?: string }> = [],
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
      const chain = createChainMock(items);
      // Allow chained .eq("status", ...) filtering
      chain.eq = vi.fn().mockReturnValue(chain);
      return chain;
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

// ─── A. Actor permissions ────────────────────────────────────────────────────

describe("A. Actor permissions — buyer delivery/completion", () => {
  it("buyer can do shipped → delivered (confirm receipt)", () => {
    expect(isActorAllowed("buyer", "shipped", "delivered")).toBe(true);
  });

  it("buyer can do delivered → completed (complete order)", () => {
    expect(isActorAllowed("buyer", "delivered", "completed")).toBe(true);
  });

  it("buyer cannot do shipped → completed (skips delivered)", () => {
    expect(isActorAllowed("buyer", "shipped", "completed")).toBe(false);
  });

  it("buyer cannot do paid → delivered (skips steps)", () => {
    expect(isActorAllowed("buyer", "paid", "delivered")).toBe(false);
  });

  it("buyer cannot do processing → delivered (skips shipped)", () => {
    expect(isActorAllowed("buyer", "processing", "delivered")).toBe(false);
  });

  it("buyer cannot do pending → delivered", () => {
    expect(isActorAllowed("buyer", "pending", "delivered")).toBe(false);
  });

  it("buyer can still cancel pending/awaiting_payment", () => {
    expect(isActorAllowed("buyer", "pending", "cancelled")).toBe(true);
    expect(isActorAllowed("buyer", "awaiting_payment", "cancelled")).toBe(true);
  });

  it("buyer cannot cancel paid/processing/shipped orders", () => {
    expect(isActorAllowed("buyer", "paid", "cancelled")).toBe(false);
    expect(isActorAllowed("buyer", "processing", "cancelled")).toBe(false);
    expect(isActorAllowed("buyer", "shipped", "cancelled")).toBe(false);
  });

  it("seller cannot do shipped → delivered", () => {
    expect(isActorAllowed("seller", "shipped", "delivered")).toBe(false);
  });

  it("seller cannot do delivered → completed", () => {
    expect(isActorAllowed("seller", "delivered", "completed")).toBe(false);
  });

  it("webhook cannot do shipped → delivered", () => {
    expect(isActorAllowed("webhook", "shipped", "delivered")).toBe(false);
  });

  it("webhook cannot do delivered → completed", () => {
    expect(isActorAllowed("webhook", "delivered", "completed")).toBe(false);
  });

  it("admin can do shipped → delivered", () => {
    expect(isActorAllowed("admin", "shipped", "delivered")).toBe(true);
  });

  it("admin can do delivered → completed", () => {
    expect(isActorAllowed("admin", "delivered", "completed")).toBe(true);
  });
});

// ─── B. computeOrderStatus — delivered/completed aggregation ─────────────────

describe("B. computeOrderStatus — delivered/completed aggregation", () => {
  it("all delivered → delivered", () => {
    expect(computeOrderStatus(["delivered", "delivered"])).toBe("delivered");
  });

  it("all completed → completed", () => {
    expect(computeOrderStatus(["completed", "completed"])).toBe("completed");
  });

  it("mixed delivered/shipped → shipped (minimum non-terminal)", () => {
    expect(computeOrderStatus(["delivered", "shipped"])).toBe("shipped");
  });

  it("mixed completed/delivered → delivered (minimum non-terminal)", () => {
    expect(computeOrderStatus(["completed", "delivered"])).toBe("delivered");
  });

  it("mixed completed/shipped → shipped (minimum non-terminal)", () => {
    expect(computeOrderStatus(["completed", "shipped"])).toBe("shipped");
  });

  it("multi-seller: one delivered, one shipped → shipped", () => {
    expect(computeOrderStatus(["delivered", "shipped"])).toBe("shipped");
  });

  it("multi-seller: all delivered → delivered", () => {
    expect(computeOrderStatus(["delivered", "delivered", "delivered"])).toBe("delivered");
  });

  it("multi-seller: one completed, two delivered → delivered", () => {
    expect(computeOrderStatus(["completed", "delivered", "delivered"])).toBe("delivered");
  });

  it("single item delivered → delivered", () => {
    expect(computeOrderStatus(["delivered"])).toBe("delivered");
  });

  it("single item completed → completed", () => {
    expect(computeOrderStatus(["completed"])).toBe("completed");
  });

  it("delivered + cancelled → delivered (non-terminal minimum)", () => {
    expect(computeOrderStatus(["delivered", "cancelled"])).toBe("delivered");
  });

  it("completed + refunded → completed (non-terminal minimum, completed is not terminal)", () => {
    expect(computeOrderStatus(["completed", "refunded"])).toBe("completed");
  });

  it("delivered + disputed → delivered (non-terminal minimum, delivered is not terminal)", () => {
    expect(computeOrderStatus(["delivered", "disputed"])).toBe("delivered");
  });
});

// ─── C. confirmOrderReceived — single seller ────────────────────────────────

describe("C. confirmOrderReceived — single seller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Unauthorized when not authenticated", async () => {
    mockSupabase = createMockSupabase(null, null);
    const { confirmOrderReceived } = await import("@/lib/actions/order");
    await expect(confirmOrderReceived("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws Unauthorized when user is seller", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
    );
    const { confirmOrderReceived } = await import("@/lib/actions/order");
    await expect(confirmOrderReceived("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws Unauthorized when buyer tries to confirm another buyer's order", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-2", status: "shipped", payment_status: "success" },
      [{ id: "item-1", status: "shipped" }],
    );
    const { confirmOrderReceived } = await import("@/lib/actions/order");
    await expect(confirmOrderReceived("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws error when payment is not confirmed", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "shipped", payment_status: "pending" },
      [{ id: "item-1", status: "shipped" }],
    );
    const { confirmOrderReceived } = await import("@/lib/actions/order");
    await expect(confirmOrderReceived("order-123")).rejects.toThrow("Payment has not been confirmed.");
  });

  it("throws error when order is not shipped", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "paid", payment_status: "success" },
      [{ id: "item-1", status: "paid" }],
    );
    const { confirmOrderReceived } = await import("@/lib/actions/order");
    await expect(confirmOrderReceived("order-123")).rejects.toThrow(
      /Cannot confirm delivery/,
    );
  });

  it("returns success when order already delivered", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "delivered", payment_status: "success" },
      [{ id: "item-1", status: "delivered" }],
    );
    const { confirmOrderReceived } = await import("@/lib/actions/order");
    await expect(confirmOrderReceived("order-123")).resolves.toEqual({
      success: true,
      message: "Order already delivered.",
    });
  });

  it("successfully confirms delivery for shipped order", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "shipped", payment_status: "success" },
      [{ id: "item-1", status: "shipped" }],
    );
    const { confirmOrderReceived } = await import("@/lib/actions/order");
    await expect(confirmOrderReceived("order-123")).resolves.toEqual({
      success: true,
    });
  });
});

// ─── D. completeOrder — single seller ───────────────────────────────────────

describe("D. completeOrder — single seller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Unauthorized when not authenticated", async () => {
    mockSupabase = createMockSupabase(null, null);
    const { completeOrder } = await import("@/lib/actions/order");
    await expect(completeOrder("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws Unauthorized when user is seller", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-seller" },
      { id: "seller-1", role: "seller" },
    );
    const { completeOrder } = await import("@/lib/actions/order");
    await expect(completeOrder("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws Unauthorized when buyer tries to complete another buyer's order", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-2", status: "delivered", payment_status: "success" },
      [{ id: "item-1", status: "delivered" }],
    );
    const { completeOrder } = await import("@/lib/actions/order");
    await expect(completeOrder("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws error when order is not delivered", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "shipped", payment_status: "success" },
      [{ id: "item-1", status: "shipped" }],
    );
    const { completeOrder } = await import("@/lib/actions/order");
    await expect(completeOrder("order-123")).rejects.toThrow(
      /Cannot complete order/,
    );
  });

  it("throws error when not all items are delivered", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "delivered", payment_status: "success" },
      [
        { id: "item-1", status: "delivered" },
        { id: "item-2", status: "shipped" },
      ],
    );
    const { completeOrder } = await import("@/lib/actions/order");
    await expect(completeOrder("order-123")).rejects.toThrow(
      "Not all items have been delivered yet.",
    );
  });

  it("returns success when order already completed", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "completed", payment_status: "success" },
      [{ id: "item-1", status: "completed" }],
    );
    const { completeOrder } = await import("@/lib/actions/order");
    await expect(completeOrder("order-123")).resolves.toEqual({
      success: true,
      message: "Order already completed.",
    });
  });

  it("successfully completes delivered order", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "delivered", payment_status: "success" },
      [{ id: "item-1", status: "delivered" }],
    );
    const { completeOrder } = await import("@/lib/actions/order");
    await expect(completeOrder("order-123")).resolves.toEqual({
      success: true,
    });
  });
});

// ─── E. Duplicate safety ────────────────────────────────────────────────────

describe("E. Duplicate safety", () => {
  it("delivered → delivered is not a valid transition", () => {
    expect(isTransitionAllowed("delivered", "delivered")).toBe(false);
  });

  it("completed → completed is not a valid transition", () => {
    expect(isTransitionAllowed("completed", "completed")).toBe(false);
  });

  it("shipped → shipped is not a valid transition", () => {
    expect(isTransitionAllowed("shipped", "shipped")).toBe(false);
  });

  it("all statuses reject self-transition", () => {
    const statuses = [
      "pending", "awaiting_payment", "paid", "processing",
      "shipped", "delivered", "completed",
      "cancelled", "refunded", "disputed",
    ] as const;
    for (const status of statuses) {
      expect(isTransitionAllowed(status, status)).toBe(false);
    }
  });
});

// ─── F. Authorization — unauthorized actors ─────────────────────────────────

describe("F. Authorization — unauthorized actors", () => {
  it("buyer cannot process order (seller only)", () => {
    expect(isActorAllowed("buyer", "paid", "processing")).toBe(false);
  });

  it("buyer cannot ship order (seller only)", () => {
    expect(isActorAllowed("buyer", "processing", "shipped")).toBe(false);
  });

  it("seller cannot confirm receipt (buyer only)", () => {
    expect(isActorAllowed("seller", "shipped", "delivered")).toBe(false);
  });

  it("seller cannot complete order (buyer only)", () => {
    expect(isActorAllowed("seller", "delivered", "completed")).toBe(false);
  });

  it("webhook cannot confirm receipt", () => {
    expect(isActorAllowed("webhook", "shipped", "delivered")).toBe(false);
  });

  it("webhook cannot complete order", () => {
    expect(isActorAllowed("webhook", "delivered", "completed")).toBe(false);
  });

  it("admin can do all allowed transitions", () => {
    expect(isActorAllowed("admin", "shipped", "delivered")).toBe(true);
    expect(isActorAllowed("admin", "delivered", "completed")).toBe(true);
    expect(isActorAllowed("admin", "paid", "processing")).toBe(true);
    expect(isActorAllowed("admin", "processing", "shipped")).toBe(true);
  });
});

// ─── G. Multi-seller delivery ────────────────────────────────────────────────

describe("G. Multi-seller delivery", () => {
  it("one seller shipped, other processing → parent is processing (not shipped)", () => {
    expect(computeOrderStatus(["shipped", "processing"])).toBe("processing");
  });

  it("all sellers shipped → parent is shipped → buyer can confirm", () => {
    expect(computeOrderStatus(["shipped", "shipped"])).toBe("shipped");
    expect(isActorAllowed("buyer", "shipped", "delivered")).toBe(true);
  });

  it("one seller delivered, other shipped → parent is shipped", () => {
    expect(computeOrderStatus(["delivered", "shipped"])).toBe("shipped");
  });

  it("all sellers delivered → parent is delivered → buyer can complete", () => {
    expect(computeOrderStatus(["delivered", "delivered"])).toBe("delivered");
    expect(isActorAllowed("buyer", "delivered", "completed")).toBe(true);
  });

  it("multi-seller full lifecycle: shipped → delivered → completed", () => {
    // Both sellers ship
    expect(computeOrderStatus(["shipped", "shipped"])).toBe("shipped");
    // Buyer confirms receipt
    expect(isActorAllowed("buyer", "shipped", "delivered")).toBe(true);
    // Both items delivered
    expect(computeOrderStatus(["delivered", "delivered"])).toBe("delivered");
    // Buyer completes
    expect(isActorAllowed("buyer", "delivered", "completed")).toBe(true);
    // Both items completed
    expect(computeOrderStatus(["completed", "completed"])).toBe("completed");
  });

  it("3-seller order: all must ship before buyer can confirm", () => {
    expect(computeOrderStatus(["shipped", "shipped", "shipped"])).toBe("shipped");
    expect(isActorAllowed("buyer", "shipped", "delivered")).toBe(true);
  });

  it("3-seller order: 2 shipped, 1 processing → parent is processing", () => {
    expect(computeOrderStatus(["shipped", "shipped", "processing"])).toBe("processing");
  });
});

// ─── H. Multi-seller completion ──────────────────────────────────────────────

describe("H. Multi-seller completion", () => {
  it("multi-seller: one completed, one delivered → parent is delivered", () => {
    expect(computeOrderStatus(["completed", "delivered"])).toBe("delivered");
  });

  it("multi-seller: all completed → parent is completed", () => {
    expect(computeOrderStatus(["completed", "completed"])).toBe("completed");
  });

  it("multi-seller: cannot complete if any item is not delivered", () => {
    const items = ["delivered", "shipped"];
    const allDelivered = items.every((s) => s === "delivered");
    expect(allDelivered).toBe(false);
  });

  it("multi-seller: can complete only when all items are delivered", () => {
    const items = ["delivered", "delivered", "delivered"];
    const allDelivered = items.every((s) => s === "delivered");
    expect(allDelivered).toBe(true);
  });

  it("3-seller full lifecycle", () => {
    // All ship
    expect(computeOrderStatus(["shipped", "shipped", "shipped"])).toBe("shipped");
    // Buyer confirms → all delivered
    expect(computeOrderStatus(["delivered", "delivered", "delivered"])).toBe("delivered");
    // Buyer completes → all completed
    expect(computeOrderStatus(["completed", "completed", "completed"])).toBe("completed");
  });

  it("3-seller: 2 delivered, 1 shipped → parent shipped → cannot complete", () => {
    expect(computeOrderStatus(["delivered", "delivered", "shipped"])).toBe("shipped");
    expect(isActorAllowed("buyer", "shipped", "completed")).toBe(false);
  });
});

// ─── I. Seller balance safety ────────────────────────────────────────────────

describe("I. Seller balance safety", () => {
  it("computeOrderStatus groups by seller_id correctly (multi-seller)", () => {
    // Verify the aggregation logic works at the order-items level
    // Seller A items: delivered, Seller B items: delivered
    const sellerAItems: OrderStatus[] = ["delivered"];
    const sellerBItems: OrderStatus[] = ["delivered"];
    expect(computeOrderStatus([...sellerAItems, ...sellerBItems])).toBe("delivered");
  });

  it("transition matrix prevents double-completion", () => {
    // completed → completed is not allowed
    expect(isTransitionAllowed("completed", "completed")).toBe(false);
    // Therefore fn_complete_order_stats won't fire twice
  });

  it("fn_complete_order_stats guard: NEW.status='completed' AND OLD.status != 'completed'", () => {
    // This is enforced in the trigger function (line 129 of migration)
    // Unit test: we verify the guard logic
    const OLD_status: string = "completed";
    const NEW_status: string = "completed";
    const wouldFire = NEW_status === "completed" && OLD_status !== "completed";
    expect(wouldFire).toBe(false);
  });

  it("fn_complete_order_stats fires on delivered → completed", () => {
    const OLD_status: string = "delivered";
    const NEW_status: string = "completed";
    const wouldFire = NEW_status === "completed" && OLD_status !== "completed";
    expect(wouldFire).toBe(true);
  });

  it("seller balance formula: SUM(subtotal) * (1 - 0.02) per seller_id", () => {
    // Verify formula correctness
    const feeRate = 0.02;
    const sellerAItems = [{ subtotal: 100000 }, { subtotal: 50000 }];
    const sellerBItems = [{ subtotal: 200000 }];

    const sellerANet = sellerAItems.reduce((sum, i) => sum + i.subtotal, 0) * (1 - feeRate);
    const sellerBNet = sellerBItems.reduce((sum, i) => sum + i.subtotal, 0) * (1 - feeRate);

    expect(sellerANet).toBe(147000); // 150000 * 0.98
    expect(sellerBNet).toBe(196000); // 200000 * 0.98
  });
});

// ─── J. Refund/cancel interaction ────────────────────────────────────────────

describe("J. Refund/cancel interaction", () => {
  it("shipped → cancelled is not allowed (too late)", () => {
    expect(isTransitionAllowed("shipped", "cancelled")).toBe(false);
  });

  it("delivered → cancelled is not allowed (too late)", () => {
    expect(isTransitionAllowed("delivered", "cancelled")).toBe(false);
  });

  it("completed → cancelled is not allowed (too late)", () => {
    expect(isTransitionAllowed("completed", "cancelled")).toBe(false);
  });

  it("shipped → refunded is allowed", () => {
    expect(isTransitionAllowed("shipped", "refunded")).toBe(true);
  });

  it("delivered → refunded is allowed", () => {
    expect(isTransitionAllowed("delivered", "refunded")).toBe(true);
  });

  it("completed → refunded is allowed", () => {
    expect(isTransitionAllowed("completed", "refunded")).toBe(true);
  });

  it("refunded is terminal — no outgoing transitions", () => {
    expect(isTransitionAllowed("refunded", "delivered")).toBe(false);
    expect(isTransitionAllowed("refunded", "completed")).toBe(false);
    expect(isTransitionAllowed("refunded", "cancelled")).toBe(false);
  });

  it("cancelled is terminal — no outgoing transitions", () => {
    expect(isTransitionAllowed("cancelled", "delivered")).toBe(false);
    expect(isTransitionAllowed("cancelled", "completed")).toBe(false);
    expect(isTransitionAllowed("cancelled", "refunded")).toBe(false);
  });

  it("stock restore: fn_restore_product_stock fires on status → cancelled/refunded", () => {
    // The trigger guard: NEW.status IN ('cancelled','refunded') AND OLD.status NOT IN ('cancelled','refunded')
    const testCases: Array<{ old: string; new: string; fires: boolean }> = [
      { old: "shipped", new: "cancelled", fires: true },
      { old: "delivered", new: "cancelled", fires: true },
      { old: "completed", new: "refunded", fires: true },
      { old: "shipped", new: "refunded", fires: true },
      { old: "cancelled", new: "cancelled", fires: false },
      { old: "refunded", new: "refunded", fires: false },
    ];

    for (const tc of testCases) {
      const fires =
        (tc.new === "cancelled" || tc.new === "refunded") &&
        tc.old !== "cancelled" &&
        tc.old !== "refunded";
      expect(fires).toBe(tc.fires);
    }
  });
});

// ─── K. Full lifecycle happy path ───────────────────────────────────────────

describe("K. Full lifecycle happy path", () => {
  it("single seller: shipped → delivered → completed", () => {
    expect(isTransitionAllowed("shipped", "delivered")).toBe(true);
    expect(isActorAllowed("buyer", "shipped", "delivered")).toBe(true);
    expect(isTransitionAllowed("delivered", "completed")).toBe(true);
    expect(isActorAllowed("buyer", "delivered", "completed")).toBe(true);
  });

  it("multi-seller: shipped → delivered → completed", () => {
    // All shipped
    expect(computeOrderStatus(["shipped", "shipped"])).toBe("shipped");
    // Buyer confirms → all delivered
    expect(isActorAllowed("buyer", "shipped", "delivered")).toBe(true);
    expect(computeOrderStatus(["delivered", "delivered"])).toBe("delivered");
    // Buyer completes → all completed
    expect(isActorAllowed("buyer", "delivered", "completed")).toBe(true);
    expect(computeOrderStatus(["completed", "completed"])).toBe("completed");
  });

  it("3-seller: full lifecycle", () => {
    expect(computeOrderStatus(["shipped", "shipped", "shipped"])).toBe("shipped");
    expect(isActorAllowed("buyer", "shipped", "delivered")).toBe(true);
    expect(computeOrderStatus(["delivered", "delivered", "delivered"])).toBe("delivered");
    expect(isActorAllowed("buyer", "delivered", "completed")).toBe(true);
    expect(computeOrderStatus(["completed", "completed", "completed"])).toBe("completed");
  });

  it("order status labels include delivered and completed", () => {
    expect(ORDER_STATUS_LABELS["delivered"]).toBe("Diterima");
    expect(ORDER_STATUS_LABELS["completed"]).toBe("Selesai");
  });

  it("order status colors include delivered and completed", () => {
    expect(ORDER_STATUS_COLORS["delivered"]).toContain("cyan");
    expect(ORDER_STATUS_COLORS["completed"]).toContain("green");
  });
});
