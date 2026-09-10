import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type OrderStatus =
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

type PaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "expired"
  | "refunded"
  | "chargeback";

type PaymentUpdate = Database["public"]["Tables"]["payments"]["Update"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["awaiting_payment", "paid", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded", "disputed"],
  delivered: ["completed", "refunded", "disputed"],
  completed: ["refunded", "disputed"],
  cancelled: [],
  refunded: [],
  disputed: [],
};

const ACCEPTED_TRANSACTION_STATUSES = [
  "capture",
  "settlement",
  "pending",
  "deny",
  "cancel",
  "expire",
] as const;

const ACCEPTED_FRAUD_STATUSES = ["accept", "challenge", "deny"] as const;

function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  receivedSignature: string,
): boolean {
  const payload = orderId + statusCode + grossAmount + serverKey;
  const computed = crypto.createHash("sha512").update(payload).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(computed, "utf8"),
    Buffer.from(receivedSignature, "utf8"),
  );
}

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
    transactionStatus === "expire"
  ) {
    return "failed";
  }

  return null;
}

function deriveOrderStatus(
  currentOrderStatus: OrderStatus,
  newPaymentStatus: PaymentStatus,
): OrderStatus | null {
  if (newPaymentStatus === "success") {
    const allowed = ALLOWED_ORDER_TRANSITIONS[currentOrderStatus] ?? [];
    if (allowed.includes("paid")) return "paid";
    if (currentOrderStatus === "paid") return null;
    return null;
  }

  if (newPaymentStatus === "failed") {
    if (
      currentOrderStatus === "pending" ||
      currentOrderStatus === "awaiting_payment"
    ) {
      return null;
    }
    return null;
  }

  return null;
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

  if (!verifySignature(orderId, statusCode, grossAmount, serverKey, signatureKey)) {
    console.error("[midtrans-webhook] Invalid signature for order:", orderId);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (statusCode !== "200") {
    console.warn("[midtrans-webhook] Non-200 status_code:", statusCode, "for order:", orderId);
    return NextResponse.json({ success: true });
  }

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

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, total_amount")
    .eq("order_number", orderId)
    .maybeSingle();

  if (orderError || !order) {
    console.error("[midtrans-webhook] Order not found:", orderId, orderError);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const notificationAmount = Number(grossAmount);
  const orderAmount = Number(order.total_amount);

  if (!Number.isFinite(notificationAmount) || notificationAmount !== orderAmount) {
    console.error(
      "[midtrans-webhook] Amount mismatch:",
      notificationAmount,
      "!=",
      orderAmount,
      "for order:",
      orderId,
    );
    return NextResponse.json({ success: true });
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, status")
    .eq("order_id", order.id)
    .eq("status", "pending")
    .maybeSingle();

  if (paymentError || !payment) {
    console.warn(
      "[midtrans-webhook] No pending payment for order:",
      orderId,
      paymentError,
    );
    return NextResponse.json({ success: true });
  }

  if (payment.status === newPaymentStatus) {
    return NextResponse.json({ success: true });
  }

  const now = new Date().toISOString();
  const currentOrderStatus = order.status as OrderStatus;

  const paymentUpdate: PaymentUpdate = {
    status: newPaymentStatus,
    gateway_response: notification as Database["public"]["Tables"]["payments"]["Row"]["gateway_response"],
  };

  if (newPaymentStatus === "success") {
    paymentUpdate.paid_at = now;
    if (notification.settlement_time) {
      paymentUpdate.paid_at = String(notification.settlement_time);
    }
  }

  if (newPaymentStatus === "failed") {
    if (transactionStatus === "expire") {
      paymentUpdate.expired_at = now;
    }
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
      console.error("[midtrans-webhook] Failed to update order:", updateOrderError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
  }

  const { error: logError } = await supabase.from("payment_logs").insert({
    payment_id: payment.id,
    event: newPaymentStatus === "success"
      ? "success"
      : newPaymentStatus === "failed"
        ? "failed"
        : "pending",
    payload: notification as Database["public"]["Tables"]["payment_logs"]["Row"]["payload"],
    note: `Midtrans notification: ${transactionStatus}${fraudStatus ? ` (fraud: ${fraudStatus})` : ""}`,
  });

  if (logError) {
    console.error("[midtrans-webhook] Failed to insert payment log:", logError);
  }

  return NextResponse.json({ success: true });
}
