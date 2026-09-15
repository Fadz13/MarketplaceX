import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  type OrderStatus,
  ALLOWED_TRANSITIONS,
} from "@/lib/order-status";

type PaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "expired"
  | "refunded"
  | "chargeback";

type PaymentUpdate = Database["public"]["Tables"]["payments"]["Update"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

const ACCEPTED_TRANSACTION_STATUSES = [
  "capture",
  "settlement",
  "pending",
  "deny",
  "cancel",
  "expire",
  "failure",
  "refund",
  "chargeback",
] as const;

const ACCEPTED_FRAUD_STATUSES = ["accept", "challenge", "deny"] as const;

/**
 * Verify Midtrans SHA-512 signature.
 * Uses timingSafeEqual with length pre-check to prevent throw on mismatched
 * buffer lengths (BUG-1 fix).
 */
function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  receivedSignature: string,
): boolean {
  const payload = orderId + statusCode + grossAmount + serverKey;
  const computed = crypto.createHash("sha512").update(payload).digest("hex");

  const computedBuf = Buffer.from(computed, "utf8");
  const receivedBuf = Buffer.from(receivedSignature, "utf8");

  if (computedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuf, receivedBuf);
}

/**
 * Map Midtrans transaction_status + fraud_status to internal payment_status.
 *
 * Covers all Midtrans statuses:
 *   capture/settlement + accept  → success
 *   capture/settlement + challenge → pending
 *   capture/settlement + deny    → failed
 *   pending                      → pending
 *   deny/cancel/expire/failure   → failed
 *   refund                       → refunded
 *   chargeback                   → chargeback
 */
function mapTransactionStatus(
  transactionStatus: string,
  fraudStatus: string | null,
): PaymentStatus | null {
  if (transactionStatus === "capture" || transactionStatus === "settlement") {
    if (fraudStatus === "deny") return "failed";
    if (fraudStatus === "challenge") return "pending";
    return "success";
  }

  if (transactionStatus === "pending") {
    return "pending";
  }

  if (
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "expire" ||
    transactionStatus === "failure"
  ) {
    return "failed";
  }

  if (transactionStatus === "refund") {
    return "refunded";
  }

  if (transactionStatus === "chargeback") {
    return "chargeback";
  }

  return null;
}

/**
 * Derive the next order_status based on the new payment_status.
 *
 * Returns null when no order status change is needed (payment_status field
 * on the order is still updated separately).
 */
function deriveOrderStatus(
  currentOrderStatus: OrderStatus,
  newPaymentStatus: PaymentStatus,
): OrderStatus | null {
  if (newPaymentStatus === "success") {
    const allowed = ALLOWED_TRANSITIONS[currentOrderStatus] ?? [];
    if (allowed.includes("paid")) return "paid";
    if (currentOrderStatus === "paid") return null;
    return null;
  }

  if (newPaymentStatus === "failed") {
    return null;
  }

  if (newPaymentStatus === "refunded" || newPaymentStatus === "chargeback") {
    const allowed = ALLOWED_TRANSITIONS[currentOrderStatus] ?? [];
    if (allowed.includes("refunded")) return "refunded";
    return null;
  }

  return null;
}

/**
 * Parse Midtrans timestamp format ("YYYY-MM-DD HH:MM:SS" in WIB/UTC+7)
 * into an ISO-8601 UTC string. Falls back to current time if parsing fails.
 *
 * BUG-3 fix: Midtrans sends local Indonesian time without timezone offset.
 * We must offset by +7 hours to get UTC.
 */
function parseMidtransTimestamp(raw: string | unknown): string {
  if (typeof raw !== "string" || !raw) {
    return new Date().toISOString();
  }

  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();

  // Midtrans format: "YYYY-MM-DD HH:MM:SS" (WIB = UTC+7)
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );

  if (!match) {
    // Attempt native parsing as fallback
    const parsed = new Date(trimmed);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString();
    }
    console.warn("[midtrans-webhook] Unparseable timestamp:", trimmed);
    return new Date().toISOString();
  }

  const [, year, month, day, hour, min, sec] = match;
  // Construct as UTC then subtract 7 hours for WIB→UTC
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(min),
    Number(sec),
  );
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  return new Date(utcMs - WIB_OFFSET_MS).toISOString();
}

export async function POST(req: NextRequest) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;

  if (!serverKey) {
    console.error("[midtrans-webhook] MIDTRANS_SERVER_KEY is not configured.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let notification: Record<string, unknown>;
  try {
    notification = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(notification.order_id ?? "");
  const statusCode = String(notification.status_code ?? "");
  const grossAmount = String(notification.gross_amount ?? "");
  const signatureKey = String(notification.signature_key ?? "");
  const transactionStatus = String(notification.transaction_status ?? "");
  const fraudStatus =
    typeof notification.fraud_status === "string"
      ? notification.fraud_status
      : null;

  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // ── Signature verification ──────────────────────────────────────────
  if (!verifySignature(orderId, statusCode, grossAmount, serverKey, signatureKey)) {
    console.error("[midtrans-webhook] Invalid signature for order:", orderId);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Validate status_code ────────────────────────────────────────────
  if (statusCode !== "200") {
    console.warn("[midtrans-webhook] Non-200 status_code:", statusCode, "for order:", orderId);
    return NextResponse.json({ success: true });
  }

  // ── Validate transaction_status ─────────────────────────────────────
  if (
    !ACCEPTED_TRANSACTION_STATUSES.includes(
      transactionStatus as (typeof ACCEPTED_TRANSACTION_STATUSES)[number],
    )
  ) {
    console.warn(
      "[midtrans-webhook] Unknown transaction_status:",
      transactionStatus,
      "for order:",
      orderId,
    );
    return NextResponse.json({ success: true });
  }

  // ── Validate fraud_status ───────────────────────────────────────────
  if (
    fraudStatus !== null &&
    !ACCEPTED_FRAUD_STATUSES.includes(
      fraudStatus as (typeof ACCEPTED_FRAUD_STATUSES)[number],
    )
  ) {
    console.warn(
      "[midtrans-webhook] Unknown fraud_status:",
      fraudStatus,
      "for order:",
      orderId,
    );
    return NextResponse.json({ success: true });
  }

  const newPaymentStatus = mapTransactionStatus(transactionStatus, fraudStatus);
  if (!newPaymentStatus) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServiceClient();

  // ── Look up order ───────────────────────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, total_amount")
    .eq("order_number", orderId)
    .maybeSingle();

  if (orderError || !order) {
    console.error("[midtrans-webhook] Order not found:", orderId, orderError);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // ── Validate gross_amount matches order total ───────────────────────
  //    Compare as rounded integers to avoid floating-point issues (BUG-7)
  const notificationAmount = Math.round(Number(grossAmount) * 100);
  const orderAmount = Math.round(Number(order.total_amount) * 100);

  if (!Number.isFinite(notificationAmount) || notificationAmount !== orderAmount) {
    console.error(
      "[midtrans-webhook] Amount mismatch:",
      grossAmount,
      "!=",
      String(order.total_amount),
      "for order:",
      orderId,
    );
    return NextResponse.json({ success: true });
  }

  // ── Find pending payment ────────────────────────────────────────────
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, status")
    .eq("order_id", order.id)
    .eq("status", "pending")
    .maybeSingle();

  if (paymentError || !payment) {
    // No pending payment found. This can happen when:
    //   a) Payment was already processed (idempotent retry — success)
    //   b) Payment already failed (idempotent retry)
    //   c) Payment was never created (shouldn't happen in normal flow)
    //   d) Payment updated but order update failed previously (partial failure)
    //
    // BUG-2 fix: Verify order status is consistent with what we'd expect.
    // If the order isn't in the expected state, attempt to repair it.

    // ── Repair: success with no pending payment ─────────────────────────
    if (newPaymentStatus === "success" && order.status !== "paid") {
      console.warn(
        "[midtrans-webhook] No pending payment but order not paid. Repairing order:",
        orderId,
      );
      const { error: repairErr } = await supabase
        .from("orders")
        .update({
          payment_status: newPaymentStatus,
          status: "paid",
        } satisfies OrderUpdate)
        .eq("id", order.id)
        .neq("payment_status", newPaymentStatus);

      if (repairErr) {
        console.error(
          "[midtrans-webhook] Repair (success) failed for order:",
          orderId,
          repairErr,
        );
        return NextResponse.json(
          { error: "Repair failed" },
          { status: 500 },
        );
      }
    }

    // ── Repair: refund with no pending payment ──────────────────────────
    // Handles partial failure where payment was updated to "refunded" but
    // the order update failed. On retry, the pending payment lookup finds
    // nothing (already updated), so we must repair the order here.
    if (newPaymentStatus === "refunded" && order.status !== "refunded") {
      console.warn(
        "[midtrans-webhook] No pending payment but order not refunded. Repairing order:",
        orderId,
      );
      const { error: repairOrderErr } = await supabase
        .from("orders")
        .update({
          payment_status: "refunded",
          status: "refunded",
        } satisfies OrderUpdate)
        .eq("id", order.id)
        .neq("payment_status", "refunded");

      if (repairOrderErr) {
        console.error(
          "[midtrans-webhook] Repair (refund) order update failed for order:",
          orderId,
          repairOrderErr,
        );
        return NextResponse.json(
          { error: "Repair failed" },
          { status: 500 },
        );
      }

      // Also repair order_items — idempotent via neq guard
      const { error: repairItemsErr } = await supabase
        .from("order_items")
        .update({ status: "refunded" })
        .eq("order_id", order.id)
        .neq("status", "refunded");

      if (repairItemsErr) {
        console.error(
          "[midtrans-webhook] Repair (refund) items update failed for order:",
          orderId,
          repairItemsErr,
        );
        return NextResponse.json(
          { error: "Repair failed" },
          { status: 500 },
        );
      }
    }

    console.warn(
      "[midtrans-webhook] No pending payment for order:",
      orderId,
      "(idempotent, acknowledging)",
    );
    return NextResponse.json({ success: true });
  }

  // ── Idempotency: skip if already in target state ────────────────────
  if (payment.status === newPaymentStatus) {
    return NextResponse.json({ success: true });
  }

  const now = new Date().toISOString();
  const currentOrderStatus = order.status as OrderStatus;

  // ── Update payment ──────────────────────────────────────────────────
  const paymentUpdate: PaymentUpdate = {
    status: newPaymentStatus,
    gateway_response: notification as Database["public"]["Tables"]["payments"]["Row"]["gateway_response"],
  };

  if (newPaymentStatus === "success") {
    // BUG-3 fix: Parse Midtrans WIB timestamp to UTC
    paymentUpdate.paid_at = notification.settlement_time
      ? parseMidtransTimestamp(notification.settlement_time)
      : now;
  }

  if (newPaymentStatus === "failed") {
    if (transactionStatus === "expire") {
      paymentUpdate.expired_at = now;
    }
  }

  if (newPaymentStatus === "refunded") {
    paymentUpdate.refunded_at = now;
  }

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update(paymentUpdate)
    .eq("id", payment.id)
    .neq("status", newPaymentStatus);

  if (updatePaymentError) {
    console.error("[midtrans-webhook] Failed to update payment:", updatePaymentError);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }

  // ── Update order ────────────────────────────────────────────────────
  const newOrderStatus = deriveOrderStatus(currentOrderStatus, newPaymentStatus);

  const orderUpdate: OrderUpdate = {
    payment_status: newPaymentStatus,
  };

  if (newOrderStatus) {
    orderUpdate.status = newOrderStatus;
  }

  if (order.payment_status !== newPaymentStatus) {
    const { error: updateOrderError } = await supabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", order.id)
      .neq("payment_status", newPaymentStatus);

    if (updateOrderError) {
      // BUG-2 partial-update fix: Payment was already updated but order
      // update failed. Log prominently. On Midtrans retry, the payment
      // lookup will find no pending payment, and the repair path above
      // will fix the order status.
      console.error(
        "[midtrans-webhook] CRITICAL: Payment updated but order update failed:",
        updateOrderError,
        "Order will be repaired on next webhook retry.",
      );
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    // ── Update order_items status on refund ──────────────────────────
    if (newOrderStatus === "refunded") {
      const { error: itemsUpdateError } = await supabase
        .from("order_items")
        .update({ status: "refunded", updated_at: now })
        .eq("order_id", order.id)
        .neq("status", "refunded");

      if (itemsUpdateError) {
        console.error(
          "[midtrans-webhook] CRITICAL: Order refunded but items update failed:",
          itemsUpdateError,
        );
      }
    }
  }

  // ── Insert payment log ──────────────────────────────────────────────
  const logEvent =
    newPaymentStatus === "success"
      ? "success"
      : newPaymentStatus === "failed"
        ? "failed"
        : newPaymentStatus === "refunded"
          ? "refunded"
          : newPaymentStatus === "chargeback"
            ? "chargeback"
            : "pending";

  const { error: logError } = await supabase.from("payment_logs").insert({
    payment_id: payment.id,
    event: logEvent,
    payload: notification as Database["public"]["Tables"]["payment_logs"]["Row"]["payload"],
    note: `Midtrans notification: ${transactionStatus}${fraudStatus ? ` (fraud: ${fraudStatus})` : ""}`,
  });

  if (logError) {
    console.error("[midtrans-webhook] Failed to insert payment log:", logError);
  }

  return NextResponse.json({ success: true });
}
