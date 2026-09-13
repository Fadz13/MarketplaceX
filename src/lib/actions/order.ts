"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  type OrderStatus,
  isTransitionAllowed,
  isActorAllowed,
  computeOrderStatus,
} from "@/lib/order-status";

type PaymentMethod =
  | "bank_transfer"
  | "virtual_account"
  | "e_wallet"
  | "credit_card"
  | "debit_card"
  | "cod"
  | "marketplace_credit";

type CreateOrderFromCartParams = {
  recipientName: string;
  phone: string;
  addressDetail: string;
  province: string;
  city: string;
  postalCode: string;
  paymentMethod: PaymentMethod;
};

type CreateOrderFromCartResult = {
  orderId: string;
  orderNumber: string;
};

export async function createOrderFromCart(
  params: CreateOrderFromCartParams,
): Promise<CreateOrderFromCartResult> {
  const supabase = await createClient();

  // create_order_from_cart is a SECURITY DEFINER RPC not yet in generated types
  // Cast through unknown to bypass the strict function-name type check
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )("create_order_from_cart", {
    p_recipient_name: params.recipientName,
    p_phone: params.phone,
    p_address_detail: params.addressDetail,
    p_province: params.province,
    p_city: params.city,
    p_postal_code: params.postalCode,
    p_payment_method: params.paymentMethod,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    order_id: string;
    order_number: string;
  };

  revalidatePath("/cart");
  revalidatePath("/checkout");

  return {
    orderId: result.order_id,
    orderNumber: result.order_number,
  };
}

export async function getOrderDetail(
  orderId: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow) {
    throw new Error("Unauthorized.");
  }

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

  if (
    userRow.role !== "admin" &&
    order.buyer_id !== userRow.id
  ) {
    throw new Error("Unauthorized.");
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
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow || userRow.role !== "admin") {
    throw new Error("Unauthorized.");
  }

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

  if (!isTransitionAllowed(currentStatus, nextStatus)) {
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

export async function cancelOrder(
  orderId: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const {
    data: order,
    error: orderError,
  } = await supabase
    .from("orders")
    .select(`
      id,
      status,
      payment_status,
      buyer_id
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  const {
    data: buyerRow,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (
    !buyerRow ||
    buyerRow.id !== order.buyer_id
  ) {
    throw new Error("Unauthorized.");
  }

  if (
    !isTransitionAllowed(
      order.status as OrderStatus,
      "cancelled",
    )
  ) {
    throw new Error(
      `Cannot cancel order with status "${order.status}".`,
    );
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancelled_reason:
        "Dibatalkan oleh pembeli.",
    })
    .eq("id", orderId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  if (
    order.payment_status === "pending"
  ) {
    const { error: payErr } = await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("order_id", orderId)
      .eq("status", "pending");

    if (payErr) {
      throw new Error(payErr.message);
    }

    const { error: payUpdateErr } =
      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
        })
        .eq("id", orderId);

    if (payUpdateErr) {
      throw new Error(payUpdateErr.message);
    }
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");

  return { success: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function syncParentOrderStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
): Promise<void> {
  const { data: items, error } = await supabase
    .from("order_items")
    .select("status")
    .eq("order_id", orderId);

  if (error) {
    throw new Error(error.message);
  }

  const itemStatuses = (items ?? []).map(
    (i: { status: string }) => i.status as OrderStatus,
  );

  const newStatus = computeOrderStatus(itemStatuses);

  const { error: updateErr } = await supabase
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }
}

// ─── Buyer: Confirm Receipt (shipped → delivered) ────────────────────────────

export async function confirmOrderReceived(
  orderId: string,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow || userRow.role !== "buyer") {
    throw new Error("Unauthorized.");
  }

  const {
    data: order,
    error: orderError,
  } = await supabase
    .from("orders")
    .select("id, buyer_id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.buyer_id !== userRow.id) {
    throw new Error("Unauthorized.");
  }

  if (order.payment_status !== "success") {
    throw new Error("Payment has not been confirmed.");
  }

  const currentStatus = order.status as OrderStatus;

  if (currentStatus === "delivered" || currentStatus === "completed") {
    return { success: true, message: "Order already delivered." };
  }

  if (!isTransitionAllowed(currentStatus, "delivered")) {
    throw new Error(
      `Cannot confirm delivery for order with status "${currentStatus}".`,
    );
  }

  if (!isActorAllowed("buyer", currentStatus, "delivered")) {
    throw new Error("Unauthorized.");
  }

  const { data: shippedItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("status", "shipped");

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (!shippedItems || shippedItems.length === 0) {
    throw new Error("No shipped items to confirm.");
  }

  const now = new Date().toISOString();

  for (const item of shippedItems) {
    const { error: updateErr } = await supabase
      .from("order_items")
      .update({ status: "delivered", updated_at: now })
      .eq("id", item.id);

    if (updateErr) {
      throw new Error(updateErr.message);
    }
  }

  await syncParentOrderStatus(supabase, orderId);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");

  return { success: true };
}

// ─── Buyer: Complete Order (delivered → completed) ───────────────────────────

export async function completeOrder(
  orderId: string,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow || userRow.role !== "buyer") {
    throw new Error("Unauthorized.");
  }

  const {
    data: order,
    error: orderError,
  } = await supabase
    .from("orders")
    .select("id, buyer_id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.buyer_id !== userRow.id) {
    throw new Error("Unauthorized.");
  }

  const currentStatus = order.status as OrderStatus;

  if (currentStatus === "completed") {
    return { success: true, message: "Order already completed." };
  }

  if (!isTransitionAllowed(currentStatus, "completed")) {
    throw new Error(
      `Cannot complete order with status "${currentStatus}".`,
    );
  }

  if (!isActorAllowed("buyer", currentStatus, "completed")) {
    throw new Error("Unauthorized.");
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, status")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const allDelivered = (items ?? []).every(
    (i) => i.status === "delivered",
  );

  if (!allDelivered) {
    throw new Error("Not all items have been delivered yet.");
  }

  const { error: updateErr } = await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  const now = new Date().toISOString();

  const { error: itemUpdateErr } = await supabase
    .from("order_items")
    .update({ status: "completed", updated_at: now })
    .eq("order_id", orderId);

  if (itemUpdateErr) {
    throw new Error(itemUpdateErr.message);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");

  return { success: true };
}