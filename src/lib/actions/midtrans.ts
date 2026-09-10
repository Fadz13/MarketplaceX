"use server";

import { Snap } from "midtrans-client";
import { createClient } from "@/lib/supabase/server";

type CreateSnapTransactionResult = {
  token: string;
  redirectUrl: string;
};

export async function createSnapTransaction(
  orderId: string,
): Promise<CreateSnapTransactionResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!serverKey) {
    throw new Error(
      "Payment configuration error: missing MIDTRANS_SERVER_KEY.",
    );
  }

  if (!clientKey) {
    throw new Error(
      "Payment configuration error: missing NEXT_PUBLIC_MIDTRANS_CLIENT_KEY.",
    );
  }

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
        id,
        order_number,
        total_amount,
        platform_fee,
        payment_status,
        buyer:users!orders_buyer_id_fkey (
          email
        )
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Failed to fetch order: ${orderError.message}`);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.payment_status === "success") {
    throw new Error("This order is already paid.");
  }

  if (order.payment_status === "failed" || order.payment_status === "refunded") {
    throw new Error(
      `Cannot process payment for order with status "${order.payment_status}".`,
    );
  }

  const amount = Number(order.total_amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid order amount: ${order.total_amount}`);
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("product_name, unit_price, quantity, subtotal")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`);
  }

  const buyer = order.buyer as {
    email?: string | null;
  } | null;

  const customerDetails: Record<string, string> = {};
  if (buyer?.email) {
    customerDetails.email = buyer.email;
  }

  const platformFee = Math.round(Number(order.platform_fee ?? 0));

  const itemDetails = [
    ...(orderItems ?? []).map(
      (item, index) => ({
        id: String(index + 1),
        name: item.product_name,
        price: Math.round(Number(item.unit_price)),
        quantity: item.quantity,
      }),
    ),
  ];

  if (platformFee > 0) {
    itemDetails.push({
      id: String(itemDetails.length + 1),
      name: "Platform Fee",
      price: platformFee,
      quantity: 1,
    });
  }

  const grossAmount = itemDetails.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const snap = new Snap({
    isProduction,
    serverKey,
    clientKey,
  });

  const parameter: Record<string, unknown> = {
    transaction_details: {
      order_id: order.order_number,
      gross_amount: grossAmount,
    },
    credit_card: {
      secure: true,
    },
  };

  if (Object.keys(customerDetails).length > 0) {
    parameter.customer_details = customerDetails;
  }

  if (itemDetails.length > 0) {
    parameter.item_details = itemDetails;
  }

  const response = await snap.createTransaction(parameter);

  return {
    token: response.token,
    redirectUrl: response.redirect_url,
  };
}
