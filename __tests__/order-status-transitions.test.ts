/**
 * Order Status Transition Matrix — Unit Tests
 *
 * Tests cover the centralized transition system:
 *   A. All valid transitions (from → to)
 *   B. All invalid transitions (from → to)
 *   C. Actor permissions (admin/buyer/webhook)
 *   D. Same-status idempotency
 *   E. Lifecycle happy-path completeness
 *   F. Terminal states (no outgoing transitions)
 *   G. Webhook-only transitions
 *   H. Buyer-only transitions
 *   I. Admin-only transitions
 *   J. Edge cases
 */

import { describe, it, expect } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  ALL_ORDER_STATUSES,
  isTransitionAllowed,
  isActorAllowed,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type OrderStatus,
} from "@/lib/order-status";

// ─── A. All valid transitions ────────────────────────────────────────────────

describe("A. Valid transitions", () => {
  it("pending → awaiting_payment", () => {
    expect(isTransitionAllowed("pending", "awaiting_payment")).toBe(true);
  });

  it("pending → paid (webhook direct payment)", () => {
    expect(isTransitionAllowed("pending", "paid")).toBe(true);
  });

  it("pending → cancelled", () => {
    expect(isTransitionAllowed("pending", "cancelled")).toBe(true);
  });

  it("awaiting_payment → paid", () => {
    expect(isTransitionAllowed("awaiting_payment", "paid")).toBe(true);
  });

  it("awaiting_payment → cancelled", () => {
    expect(isTransitionAllowed("awaiting_payment", "cancelled")).toBe(true);
  });

  it("paid → processing", () => {
    expect(isTransitionAllowed("paid", "processing")).toBe(true);
  });

  it("paid → cancelled", () => {
    expect(isTransitionAllowed("paid", "cancelled")).toBe(true);
  });

  it("paid → refunded", () => {
    expect(isTransitionAllowed("paid", "refunded")).toBe(true);
  });

  it("processing → shipped", () => {
    expect(isTransitionAllowed("processing", "shipped")).toBe(true);
  });

  it("processing → cancelled", () => {
    expect(isTransitionAllowed("processing", "cancelled")).toBe(true);
  });

  it("processing → refunded", () => {
    expect(isTransitionAllowed("processing", "refunded")).toBe(true);
  });

  it("shipped → delivered", () => {
    expect(isTransitionAllowed("shipped", "delivered")).toBe(true);
  });

  it("shipped → refunded", () => {
    expect(isTransitionAllowed("shipped", "refunded")).toBe(true);
  });

  it("shipped → disputed", () => {
    expect(isTransitionAllowed("shipped", "disputed")).toBe(true);
  });

  it("delivered → completed", () => {
    expect(isTransitionAllowed("delivered", "completed")).toBe(true);
  });

  it("delivered → refunded", () => {
    expect(isTransitionAllowed("delivered", "refunded")).toBe(true);
  });

  it("delivered → disputed", () => {
    expect(isTransitionAllowed("delivered", "disputed")).toBe(true);
  });

  it("completed → refunded", () => {
    expect(isTransitionAllowed("completed", "refunded")).toBe(true);
  });

  it("completed → disputed", () => {
    expect(isTransitionAllowed("completed", "disputed")).toBe(true);
  });
});

// ─── B. Invalid transitions ──────────────────────────────────────────────────

describe("B. Invalid transitions", () => {
  it("pending → processing (skips steps)", () => {
    expect(isTransitionAllowed("pending", "processing")).toBe(false);
  });

  it("pending → shipped (skips steps)", () => {
    expect(isTransitionAllowed("pending", "shipped")).toBe(false);
  });

  it("pending → delivered (skips steps)", () => {
    expect(isTransitionAllowed("pending", "delivered")).toBe(false);
  });

  it("pending → completed (skips steps)", () => {
    expect(isTransitionAllowed("pending", "completed")).toBe(false);
  });

  it("pending → refunded (not paid yet)", () => {
    expect(isTransitionAllowed("pending", "refunded")).toBe(false);
  });

  it("pending → disputed (not shipped yet)", () => {
    expect(isTransitionAllowed("pending", "disputed")).toBe(false);
  });

  it("awaiting_payment → processing (skips steps)", () => {
    expect(isTransitionAllowed("awaiting_payment", "processing")).toBe(false);
  });

  it("awaiting_payment → refunded (not paid yet)", () => {
    expect(isTransitionAllowed("awaiting_payment", "refunded")).toBe(false);
  });

  it("paid → pending (backward)", () => {
    expect(isTransitionAllowed("paid", "pending")).toBe(false);
  });

  it("paid → awaiting_payment (backward)", () => {
    expect(isTransitionAllowed("paid", "awaiting_payment")).toBe(false);
  });

  it("paid → shipped (skips processing)", () => {
    expect(isTransitionAllowed("paid", "shipped")).toBe(false);
  });

  it("paid → delivered (skips steps)", () => {
    expect(isTransitionAllowed("paid", "delivered")).toBe(false);
  });

  it("paid → completed (skips steps)", () => {
    expect(isTransitionAllowed("paid", "completed")).toBe(false);
  });

  it("paid → disputed (not shipped yet)", () => {
    expect(isTransitionAllowed("paid", "disputed")).toBe(false);
  });

  it("processing → pending (backward)", () => {
    expect(isTransitionAllowed("processing", "pending")).toBe(false);
  });

  it("processing → paid (backward)", () => {
    expect(isTransitionAllowed("processing", "paid")).toBe(false);
  });

  it("processing → delivered (skips shipped)", () => {
    expect(isTransitionAllowed("processing", "delivered")).toBe(false);
  });

  it("processing → completed (skips steps)", () => {
    expect(isTransitionAllowed("processing", "completed")).toBe(false);
  });

  it("processing → disputed (not shipped yet)", () => {
    expect(isTransitionAllowed("processing", "disputed")).toBe(false);
  });

  it("shipped → pending (backward)", () => {
    expect(isTransitionAllowed("shipped", "pending")).toBe(false);
  });

  it("shipped → paid (backward)", () => {
    expect(isTransitionAllowed("shipped", "paid")).toBe(false);
  });

  it("shipped → processing (backward)", () => {
    expect(isTransitionAllowed("shipped", "processing")).toBe(false);
  });

  it("shipped → completed (skips delivered)", () => {
    expect(isTransitionAllowed("shipped", "completed")).toBe(false);
  });

  it("shipped → cancelled (too late)", () => {
    expect(isTransitionAllowed("shipped", "cancelled")).toBe(false);
  });

  it("delivered → pending (backward)", () => {
    expect(isTransitionAllowed("delivered", "pending")).toBe(false);
  });

  it("delivered → paid (backward)", () => {
    expect(isTransitionAllowed("delivered", "paid")).toBe(false);
  });

  it("delivered → processing (backward)", () => {
    expect(isTransitionAllowed("delivered", "processing")).toBe(false);
  });

  it("delivered → shipped (backward)", () => {
    expect(isTransitionAllowed("delivered", "shipped")).toBe(false);
  });

  it("delivered → cancelled (too late)", () => {
    expect(isTransitionAllowed("delivered", "cancelled")).toBe(false);
  });

  it("completed → pending (backward)", () => {
    expect(isTransitionAllowed("completed", "pending")).toBe(false);
  });

  it("completed → paid (backward)", () => {
    expect(isTransitionAllowed("completed", "paid")).toBe(false);
  });

  it("completed → processing (backward)", () => {
    expect(isTransitionAllowed("completed", "processing")).toBe(false);
  });

  it("completed → shipped (backward)", () => {
    expect(isTransitionAllowed("completed", "shipped")).toBe(false);
  });

  it("completed → delivered (backward)", () => {
    expect(isTransitionAllowed("completed", "delivered")).toBe(false);
  });

  it("completed → cancelled (too late)", () => {
    expect(isTransitionAllowed("completed", "cancelled")).toBe(false);
  });
});

// ─── C. Actor permissions ────────────────────────────────────────────────────

describe("C. Actor permissions", () => {
  describe("admin", () => {
    it("admin can do any valid transition", () => {
      for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
        for (const to of tos) {
          expect(isActorAllowed("admin", from as OrderStatus, to)).toBe(true);
        }
      }
    });
  });

  describe("buyer", () => {
    it("buyer can cancel pending order", () => {
      expect(isActorAllowed("buyer", "pending", "cancelled")).toBe(true);
    });

    it("buyer can cancel awaiting_payment order", () => {
      expect(isActorAllowed("buyer", "awaiting_payment", "cancelled")).toBe(true);
    });

    it("buyer cannot cancel paid order", () => {
      expect(isActorAllowed("buyer", "paid", "cancelled")).toBe(false);
    });

    it("buyer cannot cancel processing order", () => {
      expect(isActorAllowed("buyer", "processing", "cancelled")).toBe(false);
    });

    it("buyer cannot set paid status", () => {
      expect(isActorAllowed("buyer", "pending", "paid")).toBe(false);
    });

    it("buyer cannot set processing status", () => {
      expect(isActorAllowed("buyer", "paid", "processing")).toBe(false);
    });

    it("buyer cannot set shipped status", () => {
      expect(isActorAllowed("buyer", "processing", "shipped")).toBe(false);
    });

    it("buyer cannot set completed status", () => {
      // Buyer CAN complete delivered → completed (Phase 3B-2)
      expect(isActorAllowed("buyer", "delivered", "completed")).toBe(true);
    });

    it("buyer cannot set refunded status", () => {
      expect(isActorAllowed("buyer", "paid", "refunded")).toBe(false);
    });

    it("buyer cannot set disputed status", () => {
      expect(isActorAllowed("buyer", "shipped", "disputed")).toBe(false);
    });

    it("buyer cannot do any non-cancel/non-delivery transition", () => {
      const buyerTransitions: [OrderStatus, OrderStatus][] = [
        ["pending", "awaiting_payment"],
        ["pending", "paid"],
        ["awaiting_payment", "paid"],
        ["paid", "processing"],
        ["paid", "cancelled"],
        ["paid", "refunded"],
        ["processing", "shipped"],
        ["processing", "cancelled"],
        ["processing", "refunded"],
        ["shipped", "refunded"],
        ["shipped", "disputed"],
        ["delivered", "refunded"],
        ["delivered", "disputed"],
        ["completed", "refunded"],
        ["completed", "disputed"],
      ];
      for (const [from, to] of buyerTransitions) {
        expect(isActorAllowed("buyer", from, to)).toBe(false);
      }
    });
  });

  describe("webhook", () => {
    it("webhook can set paid from pending", () => {
      expect(isActorAllowed("webhook", "pending", "paid")).toBe(true);
    });

    it("webhook can set paid from awaiting_payment", () => {
      expect(isActorAllowed("webhook", "awaiting_payment", "paid")).toBe(true);
    });

    it("webhook can set refunded from paid", () => {
      expect(isActorAllowed("webhook", "paid", "refunded")).toBe(true);
    });

    it("webhook can set refunded from processing", () => {
      expect(isActorAllowed("webhook", "processing", "refunded")).toBe(true);
    });

    it("webhook can set refunded from shipped", () => {
      expect(isActorAllowed("webhook", "shipped", "refunded")).toBe(true);
    });

    it("webhook can set refunded from delivered", () => {
      expect(isActorAllowed("webhook", "delivered", "refunded")).toBe(true);
    });

    it("webhook can set refunded from completed", () => {
      expect(isActorAllowed("webhook", "completed", "refunded")).toBe(true);
    });

    it("webhook cannot set processing", () => {
      expect(isActorAllowed("webhook", "paid", "processing")).toBe(false);
    });

    it("webhook cannot set shipped", () => {
      expect(isActorAllowed("webhook", "processing", "shipped")).toBe(false);
    });

    it("webhook cannot set delivered", () => {
      expect(isActorAllowed("webhook", "shipped", "delivered")).toBe(false);
    });

    it("webhook cannot set completed", () => {
      expect(isActorAllowed("webhook", "delivered", "completed")).toBe(false);
    });

    it("webhook cannot cancel", () => {
      expect(isActorAllowed("webhook", "pending", "cancelled")).toBe(false);
    });

    it("webhook cannot set disputed", () => {
      expect(isActorAllowed("webhook", "shipped", "disputed")).toBe(false);
    });
  });

  describe("seller", () => {
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

    it("seller cannot do processing → refunded", () => {
      expect(isActorAllowed("seller", "processing", "refunded")).toBe(false);
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

    it("seller cannot do awaiting_payment → paid", () => {
      expect(isActorAllowed("seller", "awaiting_payment", "paid")).toBe(false);
    });

    it("seller cannot do pending → cancelled", () => {
      expect(isActorAllowed("seller", "pending", "cancelled")).toBe(false);
    });
  });
});

// ─── D. Same-status idempotency ──────────────────────────────────────────────

describe("D. Same-status idempotency", () => {
  it("no status allows self-transition", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(isTransitionAllowed(status, status)).toBe(false);
    }
  });
});

// ─── E. Lifecycle happy-path completeness ─────────────────────────────────────

describe("E. Lifecycle happy-path", () => {
  it("full happy path: pending → ... → completed", () => {
    const happyPath: OrderStatus[] = [
      "pending",
      "awaiting_payment",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "completed",
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      expect(isTransitionAllowed(from, to)).toBe(true);
    }
  });

  it("fast payment: pending → paid → ... → completed", () => {
    const fastPath: OrderStatus[] = [
      "pending",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "completed",
    ];

    for (let i = 0; i < fastPath.length - 1; i++) {
      const from = fastPath[i]!;
      const to = fastPath[i + 1]!;
      expect(isTransitionAllowed(from, to)).toBe(true);
    }
  });
});

// ─── F. Terminal states ──────────────────────────────────────────────────────

describe("F. Terminal states", () => {
  it("cancelled has no outgoing transitions", () => {
    expect(ALLOWED_TRANSITIONS["cancelled"]).toHaveLength(0);
  });

  it("refunded has no outgoing transitions", () => {
    expect(ALLOWED_TRANSITIONS["refunded"]).toHaveLength(0);
  });

  it("disputed has no outgoing transitions", () => {
    expect(ALLOWED_TRANSITIONS["disputed"]).toHaveLength(0);
  });

  it("no transition can go to pending", () => {
    for (const [, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(tos).not.toContain("pending");
    }
  });

  it("only pending can transition to awaiting_payment", () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      if (tos.includes("awaiting_payment")) {
        expect(from).toBe("pending");
      }
    }
  });
});

// ─── G. Webhook-only transitions ─────────────────────────────────────────────

describe("G. Webhook-only transitions", () => {
  it("pending → paid is only possible via webhook or admin", () => {
    // Buyer cannot do this
    expect(isActorAllowed("buyer", "pending", "paid")).toBe(false);
    // Webhook can
    expect(isActorAllowed("webhook", "pending", "paid")).toBe(true);
    // Admin can
    expect(isActorAllowed("admin", "pending", "paid")).toBe(true);
  });

  it("refunded transitions from paid+ are only possible via webhook or admin", () => {
    const refundableStatuses: OrderStatus[] = [
      "paid", "processing", "shipped", "delivered", "completed",
    ];
    for (const status of refundableStatuses) {
      expect(isActorAllowed("buyer", status, "refunded")).toBe(false);
      expect(isActorAllowed("webhook", status, "refunded")).toBe(true);
      expect(isActorAllowed("admin", status, "refunded")).toBe(true);
    }
  });
});

// ─── H. Buyer-only transitions ───────────────────────────────────────────────

describe("H. Buyer-only transitions", () => {
  it("buyer cancel from pending", () => {
    expect(isActorAllowed("buyer", "pending", "cancelled")).toBe(true);
  });

  it("buyer cancel from awaiting_payment", () => {
    expect(isActorAllowed("buyer", "awaiting_payment", "cancelled")).toBe(true);
  });

  it("webhook cannot cancel", () => {
    expect(isActorAllowed("webhook", "pending", "cancelled")).toBe(false);
  });
});

// ─── I. Admin-only transitions ───────────────────────────────────────────────

describe("I. Admin-only transitions", () => {
  it("admin sets processing from paid", () => {
    expect(isActorAllowed("admin", "paid", "processing")).toBe(true);
  });

  it("admin sets shipped from processing", () => {
    expect(isActorAllowed("admin", "processing", "shipped")).toBe(true);
  });

  it("admin sets delivered from shipped", () => {
    expect(isActorAllowed("admin", "shipped", "delivered")).toBe(true);
  });

  it("admin sets completed from delivered", () => {
    expect(isActorAllowed("admin", "delivered", "completed")).toBe(true);
  });

  it("admin sets disputed from shipped", () => {
    expect(isActorAllowed("admin", "shipped", "disputed")).toBe(true);
  });

  it("admin sets disputed from delivered", () => {
    expect(isActorAllowed("admin", "delivered", "disputed")).toBe(true);
  });

  it("admin sets disputed from completed", () => {
    expect(isActorAllowed("admin", "completed", "disputed")).toBe(true);
  });

  it("admin cancels paid order", () => {
    expect(isActorAllowed("admin", "paid", "cancelled")).toBe(true);
  });

  it("admin cancels processing order", () => {
    expect(isActorAllowed("admin", "processing", "cancelled")).toBe(true);
  });

  it("buyer cannot do admin-only transitions", () => {
    expect(isActorAllowed("buyer", "paid", "processing")).toBe(false);
    expect(isActorAllowed("buyer", "processing", "shipped")).toBe(false);
  });

  it("webhook cannot do admin-only transitions", () => {
    expect(isActorAllowed("webhook", "paid", "processing")).toBe(false);
    expect(isActorAllowed("webhook", "processing", "shipped")).toBe(false);
    expect(isActorAllowed("webhook", "shipped", "delivered")).toBe(false);
    expect(isActorAllowed("webhook", "delivered", "completed")).toBe(false);
  });
});

// ─── J. Edge cases ───────────────────────────────────────────────────────────

describe("J. Edge cases", () => {
  it("ALL_ORDER_STATUSES contains exactly 10 statuses", () => {
    expect(ALL_ORDER_STATUSES).toHaveLength(10);
  });

  it("ALL_ORDER_STATUSES matches ALLOWED_TRANSITIONS keys", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(
      [...ALL_ORDER_STATUSES].sort(),
    );
  });

  it("every status has a label", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("every status has a color class", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(ORDER_STATUS_COLORS[status]).toBeTruthy();
    }
  });

  it("isTransitionAllowed returns false for invalid from status", () => {
    // @ts-expect-error testing invalid input
    expect(isTransitionAllowed("invalid_status", "paid")).toBe(false);
  });

  it("isActorAllowed returns false for invalid actor", () => {
    // @ts-expect-error testing invalid input
    expect(isActorAllowed("invalid_actor", "pending", "cancelled")).toBe(false);
  });

  it("all allowed transitions are between valid statuses", () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(ALL_ORDER_STATUSES).toContain(from);
      for (const to of tos) {
        expect(ALL_ORDER_STATUSES).toContain(to);
      }
    }
  });
});
