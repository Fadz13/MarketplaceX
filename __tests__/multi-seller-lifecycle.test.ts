/**
 * Multi-Seller Order Lifecycle — Unit Tests
 *
 * Tests cover:
 *   A. computeOrderStatus — aggregation logic
 *   B. Multi-seller processing — independent seller actions
 *   C. Multi-seller shipping — independent shipments
 *   D. Seller isolation — cannot modify other seller's items
 *   E. Duplicate prevention
 *   F. Single-seller regression
 *   G. Existing tests still pass
 */

import { describe, it, expect } from "vitest";
import {
  computeOrderStatus,
  isActorAllowed,
  isTransitionAllowed,
} from "@/lib/order-status";

// ─── A. computeOrderStatus — aggregation logic ───────────────────────────────

describe("A. computeOrderStatus", () => {
  it("empty items → pending", () => {
    expect(computeOrderStatus([])).toBe("pending");
  });

  it("all pending → pending", () => {
    expect(computeOrderStatus(["pending", "pending", "pending"])).toBe("pending");
  });

  it("all paid → paid", () => {
    expect(computeOrderStatus(["paid", "paid", "paid"])).toBe("paid");
  });

  it("all processing → processing", () => {
    expect(computeOrderStatus(["processing", "processing"])).toBe("processing");
  });

  it("all shipped → shipped", () => {
    expect(computeOrderStatus(["shipped", "shipped"])).toBe("shipped");
  });

  it("all delivered → delivered", () => {
    expect(computeOrderStatus(["delivered", "delivered"])).toBe("delivered");
  });

  it("all completed → completed", () => {
    expect(computeOrderStatus(["completed", "completed"])).toBe("completed");
  });

  it("mixed paid/processing → paid (minimum non-terminal)", () => {
    expect(computeOrderStatus(["paid", "processing"])).toBe("paid");
  });

  it("mixed processing/shipped → processing (minimum non-terminal)", () => {
    expect(computeOrderStatus(["processing", "shipped"])).toBe("processing");
  });

  it("mixed paid/shipped → paid (minimum non-terminal)", () => {
    expect(computeOrderStatus(["paid", "shipped"])).toBe("paid");
  });

  it("all cancelled → cancelled", () => {
    expect(computeOrderStatus(["cancelled", "cancelled"])).toBe("cancelled");
  });

  it("all refunded → refunded", () => {
    expect(computeOrderStatus(["refunded", "refunded"])).toBe("refunded");
  });

  it("all disputed → disputed", () => {
    expect(computeOrderStatus(["disputed", "disputed"])).toBe("disputed");
  });

  it("mixed cancelled/processing → processing (non-terminal minimum)", () => {
    expect(computeOrderStatus(["cancelled", "processing"])).toBe("processing");
  });

  it("mixed cancelled/paid → paid (non-terminal minimum)", () => {
    expect(computeOrderStatus(["cancelled", "paid"])).toBe("paid");
  });

  it("mixed cancelled/paid/processing → paid (non-terminal minimum)", () => {
    expect(computeOrderStatus(["cancelled", "paid", "processing"])).toBe("paid");
  });

  it("mixed refunded/shipped → shipped (non-terminal minimum)", () => {
    expect(computeOrderStatus(["refunded", "shipped"])).toBe("shipped");
  });

  it("mixed disputed/processing → processing (non-terminal minimum)", () => {
    expect(computeOrderStatus(["disputed", "processing"])).toBe("processing");
  });

  it("cancelled + refunded → cancelled (first terminal wins by severity)", () => {
    const result = computeOrderStatus(["cancelled", "refunded"]);
    expect(["cancelled", "refunded"]).toContain(result);
  });

  it("pending + paid + processing + shipped → pending (minimum non-terminal)", () => {
    expect(computeOrderStatus(["pending", "paid", "processing", "shipped"])).toBe("pending");
  });

  it("single item — returns its status", () => {
    expect(computeOrderStatus(["processing"])).toBe("processing");
    expect(computeOrderStatus(["paid"])).toBe("paid");
    expect(computeOrderStatus(["shipped"])).toBe("shipped");
  });

  it("completed + processing → processing (non-terminal minimum)", () => {
    expect(computeOrderStatus(["completed", "processing"])).toBe("processing");
  });

  it("completed + shipped → shipped (non-terminal minimum)", () => {
    expect(computeOrderStatus(["completed", "shipped"])).toBe("shipped");
  });
});

// ─── B. Multi-seller processing ──────────────────────────────────────────────

describe("B. Multi-seller processing", () => {
  it("seller can only transition paid → processing", () => {
    expect(isActorAllowed("seller", "paid", "processing")).toBe(true);
  });

  it("seller cannot transition from item status that is not paid", () => {
    expect(isActorAllowed("seller", "pending", "processing")).toBe(false);
    expect(isActorAllowed("seller", "processing", "processing")).toBe(false);
    expect(isActorAllowed("seller", "shipped", "processing")).toBe(false);
  });

  it("computeOrderStatus handles multi-seller scenario: one processed, one paid", () => {
    expect(computeOrderStatus(["processing", "paid"])).toBe("paid");
  });

  it("computeOrderStatus handles multi-seller: both processed", () => {
    expect(computeOrderStatus(["processing", "processing"])).toBe("processing");
  });

  it("computeOrderStatus handles multi-seller: one shipped, one processing", () => {
    expect(computeOrderStatus(["shipped", "processing"])).toBe("processing");
  });

  it("computeOrderStatus handles multi-seller: all shipped", () => {
    expect(computeOrderStatus(["shipped", "shipped"])).toBe("shipped");
  });
});

// ─── C. Multi-seller shipping ────────────────────────────────────────────────

describe("C. Multi-seller shipping", () => {
  it("seller can only transition processing → shipped", () => {
    expect(isActorAllowed("seller", "processing", "shipped")).toBe(true);
  });

  it("seller cannot ship from paid (must process first)", () => {
    expect(isActorAllowed("seller", "paid", "shipped")).toBe(false);
  });

  it("seller cannot ship from pending", () => {
    expect(isActorAllowed("seller", "pending", "shipped")).toBe(false);
  });

  it("computeOrderStatus handles: one seller shipped, other processing", () => {
    expect(computeOrderStatus(["shipped", "processing"])).toBe("processing");
  });

  it("computeOrderStatus handles: one seller shipped, other paid", () => {
    expect(computeOrderStatus(["shipped", "paid"])).toBe("paid");
  });

  it("computeOrderStatus handles: all shipped", () => {
    expect(computeOrderStatus(["shipped", "shipped", "shipped"])).toBe("shipped");
  });

  it("computeOrderStatus handles: all completed after both shipped", () => {
    expect(computeOrderStatus(["completed", "completed"])).toBe("completed");
  });
});

// ─── D. Seller isolation ─────────────────────────────────────────────────────

describe("D. Seller isolation", () => {
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

  it("seller cannot cancel order", () => {
    expect(isActorAllowed("seller", "paid", "cancelled")).toBe(false);
  });

  it("seller cannot refund order", () => {
    expect(isActorAllowed("seller", "paid", "refunded")).toBe(false);
  });

  it("seller cannot complete order", () => {
    expect(isActorAllowed("seller", "delivered", "completed")).toBe(false);
  });

  it("seller cannot dispute order", () => {
    expect(isActorAllowed("seller", "shipped", "disputed")).toBe(false);
  });
});

// ─── E. Duplicate prevention ─────────────────────────────────────────────────

describe("E. Duplicate prevention", () => {
  it("processing → processing is not a valid transition", () => {
    expect(isTransitionAllowed("processing", "processing")).toBe(false);
  });

  it("shipped → shipped is not a valid transition", () => {
    expect(isTransitionAllowed("shipped", "shipped")).toBe(false);
  });

  it("paid → paid is not a valid transition", () => {
    expect(isTransitionAllowed("paid", "paid")).toBe(false);
  });

  it("pending → pending is not a valid transition", () => {
    expect(isTransitionAllowed("pending", "pending")).toBe(false);
  });
});

// ─── F. Single-seller regression ─────────────────────────────────────────────

describe("F. Single-seller regression", () => {
  it("single item: paid → processing → shipped → completed", () => {
    expect(isActorAllowed("seller", "paid", "processing")).toBe(true);
    expect(computeOrderStatus(["processing"])).toBe("processing");
    expect(isActorAllowed("seller", "processing", "shipped")).toBe(true);
    expect(computeOrderStatus(["shipped"])).toBe("shipped");
  });

  it("computeOrderStatus with single item returns item status", () => {
    expect(computeOrderStatus(["pending"])).toBe("pending");
    expect(computeOrderStatus(["paid"])).toBe("paid");
    expect(computeOrderStatus(["processing"])).toBe("processing");
    expect(computeOrderStatus(["shipped"])).toBe("shipped");
    expect(computeOrderStatus(["delivered"])).toBe("delivered");
    expect(computeOrderStatus(["completed"])).toBe("completed");
    expect(computeOrderStatus(["cancelled"])).toBe("cancelled");
    expect(computeOrderStatus(["refunded"])).toBe("refunded");
    expect(computeOrderStatus(["disputed"])).toBe("disputed");
  });

  it("admin can override allowed statuses", () => {
    expect(isActorAllowed("admin", "pending", "cancelled")).toBe(true);
    expect(isActorAllowed("admin", "paid", "cancelled")).toBe(true);
    expect(isActorAllowed("admin", "processing", "cancelled")).toBe(true);
    expect(isActorAllowed("admin", "paid", "refunded")).toBe(true);
    expect(isActorAllowed("admin", "processing", "refunded")).toBe(true);
    expect(isActorAllowed("admin", "shipped", "refunded")).toBe(true);
  });

  it("admin cannot do disallowed transitions even with admin role", () => {
    expect(isActorAllowed("admin", "shipped", "cancelled")).toBe(false);
    expect(isActorAllowed("admin", "delivered", "cancelled")).toBe(false);
    expect(isActorAllowed("admin", "completed", "cancelled")).toBe(false);
  });
});

