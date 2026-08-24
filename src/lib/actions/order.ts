"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

const ALLOWED_TRANSITIONS: Record<
  OrderStatus,
  OrderStatus[]
> = {
  pending: [
    "awaiting_payment",
    "cancelled",
  ],

  awaiting_payment: [
    "paid",
    "cancelled",
  ],

  paid: [
    "processing",
    "cancelled",
    "refunded",
  ],

  processing: [
    "shipped",
    "cancelled",
    "refunded",
  ],

  shipped: [
    "delivered",
    "refunded",
    "disputed",
  ],

  delivered: [
    "completed",
    "refunded",
    "disputed",
  ],

  completed: [
    "refunded",
    "disputed",
  ],

  cancelled: [],

  refunded: [],

  disputed: [],
};

export async function getOrderDetail(
  orderId: string,
) {
  const supabase = await createClient();

  const [
    { data: order, error: orderError },
    { data: items, error: itemsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        buyer_id,
        address_id,
        voucher_id,
        order_number,
        status,
        subtotal,
        shipping_cost,
        discount_amount,
        platform_fee,
        total_amount,
        payment_status,
        payment_due_at,
        shipping_snapshot,
        buyer_notes,
        cancelled_at,
        cancelled_reason,
        completed_at,
        created_at,
        updated_at
      `)
      .eq("id", orderId)
      .maybeSingle(),

    supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        product_id,
        product_sku_id,
        seller_id,
        store_id,
        product_name,
        product_image_url,
        variant_label,
        sku_code,
        unit_price,
        quantity,
        subtotal,
        status,
        created_at
      `)
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: true,
      }),

    supabase
      .from("payments")
      .select(`
        id,
        order_id,
        payment_method,
        payment_channel,
        transaction_id,
        gateway_response,
        amount,
        fee_amount,
        net_amount,
        status,
        paid_at,
        expired_at,
        refunded_at,
        created_at,
        updated_at
      `)
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  const paymentIds =
    (payments ?? []).map(
      (payment) => payment.id,
    );

  let paymentLogs: Array<{
    id: string;
    payment_id: string;
    event: string;
    payload: unknown;
    note: string | null;
    created_at: string;
  }> = [];

  if (paymentIds.length > 0) {
    const {
      data: logs,
      error: logsError,
    } = await supabase
      .from("payment_logs")
      .select(`
        id,
        payment_id,
        event,
        payload,
        note,
        created_at
      `)
      .in("payment_id", paymentIds)
      .order("created_at", {
        ascending: false,
      });

    if (logsError) {
      throw new Error(
        logsError.message,
      );
    }

    paymentLogs = logs ?? [];
  }

  return {
    order,
    items: items ?? [],
    payments: payments ?? [],
    paymentLogs,
  };
}

export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
) {
  const supabase = await createClient();

  const {
    data: order,
    error: orderError,
  } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      payment_status
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  const currentStatus =
    order.status as OrderStatus;

  if (currentStatus === nextStatus) {
    return;
  }

  const allowed =
    ALLOWED_TRANSITIONS[
      currentStatus
    ] ?? [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Cannot change order status from "${currentStatus}" to "${nextStatus}".`,
    );
  }

  const updateData: {
    status: OrderStatus;
    cancelled_at?: string | null;
    cancelled_reason?: string | null;
  } = {
    status: nextStatus,
  };

  if (nextStatus === "cancelled") {
    updateData.cancelled_at =
      new Date().toISOString();

    updateData.cancelled_reason =
      "Cancelled by admin.";
  }

  const {
    error: updateError,
  } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (updateError) {
    throw new Error(
      updateError.message,
    );
  }

  const {
    error: itemError,
  } = await supabase
    .from("order_items")
    .update({
      status: nextStatus,
    })
    .eq("order_id", orderId);

  if (itemError) {
    throw new Error(
      itemError.message,
    );
  }

  if (nextStatus === "refunded") {
    const {
      data: payments,
      error: paymentError,
    } = await supabase
      .from("payments")
      .select("id, status")
      .eq("order_id", orderId);

    if (paymentError) {
      throw new Error(
        paymentError.message,
      );
    }

    for (const payment of payments ?? []) {
      if (
        payment.status ===
        "success"
      ) {
        const {
          error: updatePaymentError,
        } = await supabase
          .from("payments")
          .update({
            status: "refunded",
            refunded_at:
              new Date().toISOString(),
          })
          .eq("id", payment.id);

        if (updatePaymentError) {
          throw new Error(
            updatePaymentError.message,
          );
        }

        const {
          error: logError,
        } = await supabase
          .from("payment_logs")
          .insert({
            payment_id: payment.id,
            event: "refunded",
            payload: {
              source: "admin",
              order_id: orderId,
            },
            note:
              "Payment refunded by admin.",
          });

        if (logError) {
          throw new Error(
            logError.message,
          );
        }
      }
    }

    const {
      error: orderPaymentError,
    } = await supabase
      .from("orders")
      .update({
        payment_status: "refunded",
      })
      .eq("id", orderId);

    if (orderPaymentError) {
      throw new Error(
        orderPaymentError.message,
      );
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(
    "/dashboard/products",
  );
}