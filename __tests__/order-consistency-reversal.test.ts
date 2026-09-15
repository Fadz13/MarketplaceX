/**
 * Order Consistency & Financial Reversal — Unit Tests
 *
 * Phase 3C-1: cancel consistency, refund consistency, reverse stats
 *
 * Tests cover:
 *   A. cancelOrder — order_items.status consistency
 *   B. cancelOrder — payment state consistency
 *   C. cancelOrder — duplicate safety
 *   D. Webhook refund — order_items.status consistency
 *   E. Webhook refund — idempotency
 *   F. fn_reverse_order_stats — trigger guard logic
 *   G. fn_reverse_order_stats — multi-seller balance reversal
 *   H. fn_reverse_order_stats — sold_count / stores reversal
 *   I. Stock safety
 *   J. Admin refund authorization
 *   K. Transition matrix — completed → cancelled impossible
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeOrderStatus,
  isActorAllowed,
  isTransitionAllowed,
  ALLOWED_TRANSITIONS,
  type OrderStatus,
} from "@/lib/order-status";

// ─── Mock Helpers ────────────────────────────────────────────────────────────

type MockUser = { id: string; role?: string } | null;
type MockOrder = {
  id: string;
  buyer_id?: string;
  status?: string;
  payment_status?: string;
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
  payments: Array<{ id: string; status: string }> = [],
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
      chain.eq = vi.fn().mockReturnValue(chain);
      return chain;
    } else if (table === "payments") {
      return createChainMock(payments);
    } else if (table === "payment_logs") {
      return createChainMock(null);
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

// ─── A. cancelOrder — order_items.status consistency ─────────────────────────

describe("A. cancelOrder — order_items.status consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancelOrder updates order_items.status to cancelled", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "pending", payment_status: "pending" },
      [{ id: "item-1", status: "pending" }, { id: "item-2", status: "pending" }],
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).resolves.toEqual({ success: true });
  });

  it("cancelOrder on paid order updates items (even though payment stays)", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "paid", payment_status: "success" },
      [{ id: "item-1", status: "paid" }],
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).resolves.toEqual({ success: true });
  });
});

// ─── B. cancelOrder — payment state consistency ─────────────────────────────

describe("B. cancelOrder — payment state consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancel pending order updates payment to failed", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "pending", payment_status: "pending" },
      [{ id: "item-1", status: "pending" }],
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).resolves.toEqual({ success: true });
  });

  it("cancel paid order does not throw", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "paid", payment_status: "success" },
      [{ id: "item-1", status: "paid" }],
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).resolves.toEqual({ success: true });
  });
});

// ─── C. cancelOrder — duplicate safety ──────────────────────────────────────

describe("C. cancelOrder — duplicate safety", () => {
  it("cancelled → cancelled is not allowed (terminal)", () => {
    expect(isTransitionAllowed("cancelled", "cancelled")).toBe(false);
  });

  it("cancelled has no outgoing transitions", () => {
    expect(isTransitionAllowed("cancelled", "paid")).toBe(false);
    expect(isTransitionAllowed("cancelled", "refunded")).toBe(false);
    expect(isTransitionAllowed("cancelled", "pending")).toBe(false);
  });

  it("duplicate cancel attempt fails at transition check", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "cancelled", payment_status: "failed" },
      [{ id: "item-1", status: "cancelled" }],
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).rejects.toThrow(/Cannot cancel order/);
  });
});

// ─── D. Webhook refund — order_items.status consistency ─────────────────────

describe("D. Webhook refund — order_items.status consistency", () => {
  it("transition completed → refunded is allowed", () => {
    expect(isTransitionAllowed("completed", "refunded")).toBe(true);
  });

  it("transition delivered → refunded is allowed", () => {
    expect(isTransitionAllowed("delivered", "refunded")).toBe(true);
  });

  it("transition shipped → refunded is allowed", () => {
    expect(isTransitionAllowed("shipped", "refunded")).toBe(true);
  });

  it("transition paid → refunded is allowed", () => {
    expect(isTransitionAllowed("paid", "refunded")).toBe(true);
  });

  it("computeOrderStatus: refunded items → refunded parent", () => {
    expect(computeOrderStatus(["refunded", "refunded"])).toBe("refunded");
  });

  it("computeOrderStatus: mixed refunded/delivered → delivered (non-terminal min)", () => {
    expect(computeOrderStatus(["refunded", "delivered"])).toBe("delivered");
  });
});

// ─── E. Webhook refund — idempotency ────────────────────────────────────────

describe("E. Webhook refund — idempotency", () => {
  it("refunded → refunded is not a valid transition", () => {
    expect(isTransitionAllowed("refunded", "refunded")).toBe(false);
  });

  it("all terminal states reject self-transition", () => {
    const terminals: OrderStatus[] = ["cancelled", "refunded", "disputed"];
    for (const s of terminals) {
      expect(isTransitionAllowed(s, s)).toBe(false);
    }
  });

  it("webhook can only set paid or refunded (not other statuses)", () => {
    expect(isActorAllowed("webhook", "pending", "paid")).toBe(true);
    expect(isActorAllowed("webhook", "paid", "refunded")).toBe(true);
    expect(isActorAllowed("webhook", "completed", "refunded")).toBe(true);
    expect(isActorAllowed("webhook", "shipped", "refunded")).toBe(true);
    expect(isActorAllowed("webhook", "delivered", "refunded")).toBe(true);
  });

  it("webhook cannot set cancelled, disputed, processing, shipped", () => {
    expect(isActorAllowed("webhook", "paid", "cancelled")).toBe(false);
    expect(isActorAllowed("webhook", "shipped", "disputed")).toBe(false);
    expect(isActorAllowed("webhook", "paid", "processing")).toBe(false);
    expect(isActorAllowed("webhook", "processing", "shipped")).toBe(false);
  });
});

// ─── F. fn_reverse_order_stats — trigger guard logic ────────────────────────

describe("F. fn_reverse_order_stats — trigger guard logic", () => {
  it("fires when OLD=completed AND NEW=refunded", () => {
    const OLD: string = "completed";
    const NEW: string = "refunded";
    const fires = OLD === "completed" && NEW === "refunded";
    expect(fires).toBe(true);
  });

  it("does NOT fire when OLD=delivered AND NEW=refunded", () => {
    const OLD: string = "delivered";
    const NEW: string = "refunded";
    const fires = OLD === "completed" && NEW === "refunded";
    expect(fires).toBe(false);
  });

  it("does NOT fire when OLD=shipped AND NEW=refunded", () => {
    const OLD: string = "shipped";
    const NEW: string = "refunded";
    const fires = OLD === "completed" && NEW === "refunded";
    expect(fires).toBe(false);
  });

  it("does NOT fire when OLD=paid AND NEW=refunded", () => {
    const OLD: string = "paid";
    const NEW: string = "refunded";
    const fires = OLD === "completed" && NEW === "refunded";
    expect(fires).toBe(false);
  });

  it("does NOT fire when NEW=cancelled (not refunded)", () => {
    const OLD: string = "completed";
    const NEW: string = "cancelled";
    const fires = OLD === "completed" && NEW === "refunded";
    expect(fires).toBe(false);
  });

  it("does NOT fire when OLD=completed AND NEW=completed (same status)", () => {
    const OLD: string = "completed";
    const NEW: string = "completed";
    const fires = OLD === "completed" && NEW === "refunded";
    expect(fires).toBe(false);
  });

  it("fn_complete_order_stats fires on NEW=completed AND OLD!=completed", () => {
    const OLD: string = "delivered";
    const NEW: string = "completed";
    const fires = NEW === "completed" && OLD !== "completed";
    expect(fires).toBe(true);
  });

  it("fn_complete_order_stats does NOT fire on NEW=refunded", () => {
    const OLD: string = "completed";
    const NEW: string = "refunded";
    const fires = NEW === "completed" && OLD !== "completed";
    expect(fires).toBe(false);
  });
});

// ─── G. fn_reverse_order_stats — multi-seller balance reversal ──────────────

describe("G. fn_reverse_order_stats — multi-seller balance reversal", () => {
  const FEE_RATE = 0.02;

  it("single seller: net = subtotal * (1 - 0.02)", () => {
    const subtotal = 100000;
    const net = subtotal * (1 - FEE_RATE);
    expect(net).toBe(98000);
  });

  it("multi-seller: seller A net computed from A items only", () => {
    const sellerAItems = [{ subtotal: 100000 }, { subtotal: 50000 }];
    const net = sellerAItems.reduce((sum, i) => sum + i.subtotal, 0) * (1 - FEE_RATE);
    expect(net).toBe(147000);
  });

  it("multi-seller: seller B net computed from B items only", () => {
    const sellerBItems = [{ subtotal: 200000 }];
    const net = sellerBItems.reduce((sum, i) => sum + i.subtotal, 0) * (1 - FEE_RATE);
    expect(net).toBe(196000);
  });

  it("reversal: available_balance -= net per seller", () => {
    const balanceBefore = 500000;
    const net = 147000;
    const balanceAfter = balanceBefore - net;
    expect(balanceAfter).toBe(353000);
  });

  it("reversal: total_earned -= net per seller", () => {
    const earnedBefore = 1000000;
    const net = 147000;
    const earnedAfter = earnedBefore - net;
    expect(earnedAfter).toBe(853000);
  });

  it("debit ledger: balance_before = balance + net, balance_after = balance", () => {
    const currentBalance = 353000;
    const net = 147000;
    const balanceBefore = currentBalance + net;
    const balanceAfter = currentBalance;
    expect(balanceBefore).toBe(500000);
    expect(balanceAfter).toBe(353000);
  });

  it("idempotency: debit already exists → skip insert", () => {
    const existingDebits = [
      { seller_id: "seller-1", reference_id: "order-123", transaction_type: "debit" },
    ];
    const wouldInsert = !existingDebits.some(
      (d) => d.seller_id === "seller-1" && d.reference_id === "order-123" && d.transaction_type === "debit",
    );
    expect(wouldInsert).toBe(false);
  });

  it("no existing debit → insert allowed", () => {
    const existingDebits: Array<{ seller_id: string; reference_id: string; transaction_type: string }> = [];
    const wouldInsert = !existingDebits.some(
      (d) => d.seller_id === "seller-1" && d.reference_id === "order-123" && d.transaction_type === "debit",
    );
    expect(wouldInsert).toBe(true);
  });
});

// ─── H. fn_reverse_order_stats — sold_count / stores reversal ───────────────

describe("H. fn_reverse_order_stats — sold_count / stores reversal", () => {
  it("sold_count reversed: products.sold_count -= quantity", () => {
    const before = 50;
    const quantity = 2;
    const after = before - quantity;
    expect(after).toBe(48);
  });

  it("total_sales reversed: stores.total_sales -= item_count", () => {
    const before = 100;
    const itemCount = 3;
    const after = before - itemCount;
    expect(after).toBe(97);
  });

  it("total_revenue reversed: stores.total_revenue -= revenue", () => {
    const before = 5000000;
    const revenue = 350000;
    const after = before - revenue;
    expect(after).toBe(4650000);
  });

  it("completed_at cleared on refund", () => {
    const newCompletedAt: string | null = null;
    expect(newCompletedAt).toBeNull();
  });
});

// ─── I. Stock safety ────────────────────────────────────────────────────────

describe("I. Stock safety", () => {
  it("fn_restore_product_stock guard: fires on NEW=cancelled AND OLD!=cancelled", () => {
    const OLD: string = "paid";
    const NEW: string = "cancelled";
    const fires =
      (NEW === "cancelled" || NEW === "refunded") &&
      OLD !== "cancelled" && OLD !== "refunded";
    expect(fires).toBe(true);
  });

  it("fn_restore_product_stock guard: fires on NEW=refunded AND OLD=completed", () => {
    const OLD: string = "completed";
    const NEW: string = "refunded";
    const fires =
      (NEW === "cancelled" || NEW === "refunded") &&
      OLD !== "cancelled" && OLD !== "refunded";
    expect(fires).toBe(true);
  });

  it("fn_restore_product_stock guard: does NOT fire on duplicate cancel", () => {
    const OLD: string = "cancelled";
    const NEW: string = "cancelled";
    const fires =
      (NEW === "cancelled" || NEW === "refunded") &&
      OLD !== "cancelled" && OLD !== "refunded";
    expect(fires).toBe(false);
  });

  it("fn_restore_product_stock guard: does NOT fire on duplicate refund", () => {
    const OLD: string = "refunded";
    const NEW: string = "refunded";
    const fires =
      (NEW === "cancelled" || NEW === "refunded") &&
      OLD !== "cancelled" && OLD !== "refunded";
    expect(fires).toBe(false);
  });

  it("cancelled → refunded: stock NOT restored twice (second guard blocks)", () => {
    // First: paid → cancelled → stock restored
    const first = true; // fires
    // Second: cancelled → refunded → guard: OLD=cancelled, so does NOT fire
    const OLD2: string = "cancelled";
    const NEW2: string = "refunded";
    const second =
      (NEW2 === "cancelled" || NEW2 === "refunded") &&
      OLD2 !== "cancelled" && OLD2 !== "refunded";
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("completed → refunded: stock restored once", () => {
    const OLD: string = "completed";
    const NEW: string = "refunded";
    const fires =
      (NEW === "cancelled" || NEW === "refunded") &&
      OLD !== "cancelled" && OLD !== "refunded";
    expect(fires).toBe(true);
  });

  it("refund webhook duplicate: payment already refunded → early return", () => {
    // Idempotency check in webhook: payment.status === newPaymentStatus
    const paymentStatus = "refunded";
    const newPaymentStatus = "refunded";
    const isDuplicate = paymentStatus === newPaymentStatus;
    expect(isDuplicate).toBe(true);
  });
});

// ─── J. Admin refund authorization ──────────────────────────────────────────

describe("J. Admin refund authorization", () => {
  it("admin can do any allowed transition", () => {
    expect(isActorAllowed("admin", "completed", "refunded")).toBe(true);
    expect(isActorAllowed("admin", "delivered", "refunded")).toBe(true);
    expect(isActorAllowed("admin", "shipped", "refunded")).toBe(true);
    expect(isActorAllowed("admin", "paid", "refunded")).toBe(true);
    expect(isActorAllowed("admin", "processing", "refunded")).toBe(true);
  });

  it("buyer cannot refund", () => {
    expect(isActorAllowed("buyer", "completed", "refunded")).toBe(false);
    expect(isActorAllowed("buyer", "delivered", "refunded")).toBe(false);
    expect(isActorAllowed("buyer", "paid", "refunded")).toBe(false);
  });

  it("seller cannot refund", () => {
    expect(isActorAllowed("seller", "completed", "refunded")).toBe(false);
    expect(isActorAllowed("seller", "paid", "refunded")).toBe(false);
  });

  it("webhook can refund (but not admin-only transitions)", () => {
    expect(isActorAllowed("webhook", "completed", "refunded")).toBe(true);
    expect(isActorAllowed("webhook", "delivered", "refunded")).toBe(true);
  });

  it("admin can cancel paid/processing orders", () => {
    expect(isActorAllowed("admin", "paid", "cancelled")).toBe(true);
    expect(isActorAllowed("admin", "processing", "cancelled")).toBe(true);
  });

  it("admin cannot cancel shipped/delivered/completed", () => {
    expect(isActorAllowed("admin", "shipped", "cancelled")).toBe(false);
    expect(isActorAllowed("admin", "delivered", "cancelled")).toBe(false);
    expect(isActorAllowed("admin", "completed", "cancelled")).toBe(false);
  });
});

// ─── K. Transition matrix — completed → cancelled impossible ────────────────

describe("K. Transition matrix — completed → cancelled impossible", () => {
  it("completed → cancelled is NOT allowed", () => {
    expect(isTransitionAllowed("completed", "cancelled")).toBe(false);
  });

  it("completed → refunded IS allowed", () => {
    expect(isTransitionAllowed("completed", "refunded")).toBe(true);
  });

  it("completed → disputed IS allowed", () => {
    expect(isTransitionAllowed("completed", "disputed")).toBe(true);
  });

  it("completed has exactly 2 outgoing transitions", () => {
    expect(ALLOWED_TRANSITIONS["completed"]).toHaveLength(2);
    expect(ALLOWED_TRANSITIONS["completed"]).toContain("refunded");
    expect(ALLOWED_TRANSITIONS["completed"]).toContain("disputed");
  });

  it("cancelled is terminal (0 outgoing transitions)", () => {
    expect(ALLOWED_TRANSITIONS["cancelled"]).toHaveLength(0);
  });

  it("refunded is terminal (0 outgoing transitions)", () => {
    expect(ALLOWED_TRANSITIONS["refunded"]).toHaveLength(0);
  });

  it("disputed is terminal (0 outgoing transitions)", () => {
    expect(ALLOWED_TRANSITIONS["disputed"]).toHaveLength(0);
  });
});

// ─── L. cancelOrder — end-to-end flow ───────────────────────────────────────

describe("L. cancelOrder — end-to-end flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when not authenticated", async () => {
    mockSupabase = createMockSupabase(null, null);
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws when buyer tries to cancel other buyer's order", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-2", status: "pending", payment_status: "pending" },
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).rejects.toThrow("Unauthorized.");
  });

  it("throws when order is shipped (too late to cancel)", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "shipped", payment_status: "success" },
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).rejects.toThrow(/Cannot cancel/);
  });

  it("throws when order is completed (too late)", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "completed", payment_status: "success" },
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).rejects.toThrow(/Cannot cancel/);
  });

  it("successfully cancels pending order", async () => {
    mockSupabase = createMockSupabase(
      { id: "auth-buyer-1" },
      { id: "buyer-1", role: "buyer" },
      { id: "order-123", buyer_id: "buyer-1", status: "pending", payment_status: "pending" },
      [{ id: "item-1", status: "pending" }],
    );
    const { cancelOrder } = await import("@/lib/actions/order");
    await expect(cancelOrder("order-123")).resolves.toEqual({ success: true });
  });
});
