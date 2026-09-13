/**
 * Order Status — Single Source of Truth
 *
 * Centralizes the canonical OrderStatus type, allowed transitions,
 * and actor permission rules. Every file that deals with order status
 * transitions should import from here.
 */

// ─── Canonical Type ──────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded"
  | "disputed";

export const ALL_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
  "disputed",
] as const;

// ─── Transition Matrix ───────────────────────────────────────────────────────
//
// Lifecycle (happy path):
//   pending → awaiting_payment → paid → processing → shipped → delivered → completed
//
// Alternative:
//   pending / awaiting_payment → cancelled  (buyer or admin)
//   paid / processing          → cancelled  (admin only)
//   paid+                      → refunded   (admin or webhook via Midtrans)
//   shipped+                   → disputed   (admin only)
//
// Terminal states: cancelled, refunded, disputed — no further transitions.

export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending:          ["awaiting_payment", "paid", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  paid:             ["processing", "cancelled", "refunded"],
  processing:       ["shipped", "cancelled", "refunded"],
  shipped:          ["delivered", "refunded", "disputed"],
  delivered:        ["completed", "refunded", "disputed"],
  completed:        ["refunded", "disputed"],
  cancelled:        [],
  refunded:         [],
  disputed:         [],
};

/**
 * Check whether a transition from `from` to `to` is allowed by the
 * transition matrix. This is the single validation function used by
 * all actors (admin, buyer, webhook).
 */
export function isTransitionAllowed(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Actor Permissions ───────────────────────────────────────────────────────
//
// Defines which actors are allowed to perform which transitions.
// The webhook (system) is always allowed to perform payment-related
// transitions that are in ALLOWED_TRANSITIONS.

export type Actor = "admin" | "buyer" | "seller" | "webhook";

/**
 * Returns true if the given actor is allowed to trigger the transition
 * from `from` to `to`. This is checked IN ADDITION to the transition
 * matrix — both must pass.
 */
export function isActorAllowed(
  actor: Actor,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (!isTransitionAllowed(from, to)) return false;

  switch (actor) {
    case "webhook":
      // Webhook can only set payment-related statuses: paid, refunded
      return to === "paid" || to === "refunded";

    case "buyer":
      // Buyer can cancel their own order (pending/awaiting_payment)
      if (to === "cancelled" && (from === "pending" || from === "awaiting_payment")) return true;
      // Buyer can confirm receipt (shipped → delivered)
      if (to === "delivered" && from === "shipped") return true;
      // Buyer can complete order (delivered → completed)
      if (to === "completed" && from === "delivered") return true;
      return false;

    case "seller":
      // Seller can process paid orders and ship processing orders
      return (
        (from === "paid" && to === "processing") ||
        (from === "processing" && to === "shipped")
      );

    case "admin":
      // Admin can do any allowed transition
      return true;

    default:
      return false;
  }
}

// ─── Order Status Aggregation ────────────────────────────────────────────────
//
// For multi-seller orders, the parent orders.status is derived from
// the individual order_items.status values. This function computes
// the correct parent status based on item statuses.

const STATUS_SEVERITY: Record<OrderStatus, number> = {
  pending:          0,
  awaiting_payment: 1,
  paid:             2,
  processing:       3,
  shipped:          4,
  delivered:        5,
  completed:        6,
  cancelled:        -1,
  refunded:         -2,
  disputed:         -3,
};

/**
 * Compute parent order status from order_items statuses.
 *
 * Rules:
 * - All items same status → that status
 * - All items cancelled/refunded/disputed → that terminal status
 * - Mixed terminal + non-terminal → highest non-terminal
 * - Mixed non-terminal → MINIMUM non-terminal (the "weakest link")
 *   e.g. processing + shipped → processing (not fully shipped yet)
 *   e.g. paid + processing → processing (not all processing yet)
 */
export function computeOrderStatus(
  itemStatuses: OrderStatus[],
): OrderStatus {
  if (itemStatuses.length === 0) return "pending";

  const unique = new Set(itemStatuses);

  if (unique.size === 1) {
    return itemStatuses[0]!;
  }

  const isTerminal = (s: OrderStatus) =>
    s === "cancelled" || s === "refunded" || s === "disputed";

  const nonTerminal = itemStatuses.filter((s) => !isTerminal(s));
  const terminal = itemStatuses.filter((s) => isTerminal(s));

  if (terminal.length > 0 && nonTerminal.length === 0) {
    if (unique.has("cancelled")) return "cancelled";
    if (unique.has("refunded")) return "refunded";
    return "disputed";
  }

  if (terminal.length > 0 && nonTerminal.length > 0) {
    return nonTerminal.reduce((min, s) =>
      (STATUS_SEVERITY[s] ?? 0) < (STATUS_SEVERITY[min] ?? 0) ? s : min,
    );
  }

  return nonTerminal.reduce((min, s) =>
    (STATUS_SEVERITY[s] ?? 0) < (STATUS_SEVERITY[min] ?? 0) ? s : min,
  );
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:          "Menunggu",
  awaiting_payment: "Menunggu Bayar",
  paid:             "Dibayar",
  processing:       "Diproses",
  shipped:          "Dikirim",
  delivered:        "Diterima",
  completed:        "Selesai",
  cancelled:        "Dibatalkan",
  refunded:         "Dikembalikan",
  disputed:         "Disengketakan",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending:          "bg-gray-100 text-gray-700",
  awaiting_payment: "bg-yellow-100 text-yellow-700",
  paid:             "bg-blue-100 text-blue-700",
  processing:       "bg-purple-100 text-purple-700",
  shipped:          "bg-indigo-100 text-indigo-700",
  delivered:        "bg-cyan-100 text-cyan-700",
  completed:        "bg-green-100 text-green-700",
  cancelled:        "bg-red-100 text-red-700",
  refunded:         "bg-orange-100 text-orange-700",
  disputed:         "bg-pink-100 text-pink-700",
};
