"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  type OrderStatus,
  isTransitionAllowed,
  computeOrderStatus,
} from "@/lib/order-status";

// ─── Types ───────────────────────────────────────────────────────────────────

type ShipOrderParams = {
  orderId: string;
  courier: string;
  trackingNumber: string;
  serviceType?: string;
  shippingCost?: number;
  estimatedDays?: number;
};

type SellerOrderActionResult = {
  success: boolean;
  message?: string;
};

// ─── Authorization Helper ─────────────────────────────────────────────────────

async function authorizeSeller(
  orderId: string,
): Promise<string> {
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

  if (!userRow || userRow.role !== "seller") {
    throw new Error("Unauthorized.");
  }

  const { data: orderItem } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId)
    .eq("seller_id", userRow.id)
    .maybeSingle();

  if (!orderItem) {
    throw new Error("Unauthorized.");
  }

  return userRow.id;
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

// ─── Process Order (paid → processing) — Item-Level ──────────────────────────

export async function processSellerOrder(
  orderId: string,
): Promise<SellerOrderActionResult> {
  const sellerId = await authorizeSeller(orderId);

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.payment_status !== "success") {
    throw new Error("Payment has not been confirmed.");
  }

  const { data: sellerItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("seller_id", sellerId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (!sellerItems || sellerItems.length === 0) {
    throw new Error("No items found for this seller in this order.");
  }

  const processable = sellerItems.filter(
    (item) => item.status === "paid" || item.status === "pending",
  );

  if (processable.length === 0) {
    return { success: true, message: "Items already processed." };
  }

  const now = new Date().toISOString();

  for (const item of processable) {
    if (!isTransitionAllowed(item.status as OrderStatus, "processing")) {
      continue;
    }
    const { error: updateErr } = await supabase
      .from("order_items")
      .update({ status: "processing", updated_at: now })
      .eq("id", item.id);

    if (updateErr) {
      throw new Error(updateErr.message);
    }
  }

  await syncParentOrderStatus(supabase, orderId);

  revalidatePath("/seller/orders");

  return { success: true };
}

// ─── Ship Order (processing → shipped) — Item-Level ──────────────────────────

export async function shipSellerOrder(
  params: ShipOrderParams,
): Promise<SellerOrderActionResult> {
  const { orderId, courier, trackingNumber, serviceType, shippingCost, estimatedDays } = params;

  const sellerId = await authorizeSeller(orderId);

  if (!courier || !courier.trim()) {
    throw new Error("Courier is required.");
  }

  if (!trackingNumber || !trackingNumber.trim()) {
    throw new Error("Tracking number is required.");
  }

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, shipping_snapshot")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  const { data: sellerItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("seller_id", sellerId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (!sellerItems || sellerItems.length === 0) {
    throw new Error("No items found for this seller in this order.");
  }

  const shippable = sellerItems.filter(
    (item) => item.status === "processing",
  );

  if (shippable.length === 0) {
    return { success: true, message: "No items ready for shipping." };
  }

  const { data: existingTracking, error: trackingCheckError } = await supabase
    .from("shipment_tracking")
    .select("id, shipments!inner(order_id), raw_payload")
    .eq("shipments.order_id", orderId);

  if (trackingCheckError) {
    throw new Error(trackingCheckError.message);
  }

  const alreadyShippedBySeller = (existingTracking ?? []).some(
    (t: { raw_payload: unknown }) => {
      const payload = (t.raw_payload ?? {}) as Record<string, unknown>;
      return payload.seller_id === sellerId;
    },
  );

  if (alreadyShippedBySeller) {
    throw new Error("Shipment already exists for this seller in this order.");
  }

  const shippingSnapshot = order.shipping_snapshot as Record<string, unknown> | null;

  const now = new Date().toISOString();

  const { data: shipment, error: shipmentError } = await supabase
    .from("shipments")
    .insert({
      order_id: orderId,
      courier: courier.trim(),
      tracking_number: trackingNumber.trim(),
      service_type: serviceType?.trim() ?? null,
      shipping_cost: shippingCost ?? 0,
      shipping_status: "pending",
      shipped_at: now,
      estimated_days: estimatedDays ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      origin_address: (shippingSnapshot?.origin_address ?? {}) as any,
    })
    .select("id")
    .single();

  if (shipmentError) {
    throw new Error(shipmentError.message);
  }

  const { error: trackingError } = await supabase
    .from("shipment_tracking")
    .insert({
      shipment_id: shipment.id,
      status: "pending",
      description: "Shipment created by seller",
      location: null,
      event_time: now,
      raw_payload: {
        source: "seller",
        seller_id: sellerId,
        order_item_ids: shippable.map((i) => i.id),
      },
    });

  if (trackingError) {
    throw new Error(trackingError.message);
  }

  for (const item of shippable) {
    const { error: updateErr } = await supabase
      .from("order_items")
      .update({ status: "shipped", updated_at: now })
      .eq("id", item.id);

    if (updateErr) {
      throw new Error(updateErr.message);
    }
  }

  await syncParentOrderStatus(supabase, orderId);

  revalidatePath("/seller/orders");

  return { success: true };
}
