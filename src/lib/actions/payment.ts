"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  type OrderStatus,
  isTransitionAllowed,
} from "@/lib/order-status";

type PaymentMethod =
  | "bank_transfer"
  | "virtual_account"
  | "e_wallet"
  | "credit_card"
  | "debit_card"
  | "cod"
  | "marketplace_credit";

export async function createPayment(
  orderId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const paymentMethod =
    String(
      formData.get("payment_method") ??
        "bank_transfer",
    ) as PaymentMethod;

  const paymentChannel =
    String(
      formData.get("payment_channel") ?? "",
    ).trim() || null;

  const transactionId =
    String(
      formData.get("transaction_id") ?? "",
    ).trim() || null;

  const {
    data: order,
    error: orderError,
  } = await supabase
    .from("orders")
    .select(`
      id,
      status,
      payment_status,
      total_amount
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  if (
    order.payment_status === "success"
  ) {
    throw new Error(
      "This order is already paid.",
    );
  }

  const amount = Number(
    order.total_amount,
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Order total is invalid.",
    );
  }

  const {
    data: payment,
    error,
  } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      payment_method: paymentMethod,
      payment_channel: paymentChannel,
      transaction_id: transactionId,
      gateway_response: null,
      amount,
      fee_amount: 0,
      status: "pending",
      paid_at: null,
      expired_at: null,
      refunded_at: null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!payment) {
    throw new Error(
      "Failed to create payment.",
    );
  }

  const {
    error: logError,
  } = await supabase
    .from("payment_logs")
    .insert({
      payment_id: payment.id,
      event: "created",
      payload: {
        source: "admin",
      },
      note:
        "Payment created from admin dashboard.",
    });

  if (logError) {
    throw new Error(logError.message);
  }

  revalidatePath("/dashboard/orders");
}

export async function markPaymentAsPaid(
  paymentId: string,
) {
  const supabase = await createClient();

  const {
    data: payment,
    error: paymentError,
  } = await supabase
    .from("payments")
    .select(`
      id,
      order_id,
      amount,
      status
    `)
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    throw new Error(
      paymentError.message,
    );
  }

  if (!payment) {
    throw new Error(
      "Payment not found.",
    );
  }

  if (payment.status === "success") {
    return;
  }

  const {
    data: order,
    error: orderFetchError,
  } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", payment.order_id)
    .maybeSingle();

  if (orderFetchError) {
    throw new Error(orderFetchError.message);
  }

  if (!order) {
    throw new Error("Order not found.");
  }

  const currentOrderStatus = order.status as OrderStatus;
  if (!isTransitionAllowed(currentOrderStatus, "paid")) {
    throw new Error(
      `Cannot mark payment as paid: order status "${currentOrderStatus}" does not allow transition to "paid".`,
    );
  }

  const {
    error: updatePaymentError,
  } = await supabase
    .from("payments")
    .update({
      status: "success",
      paid_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (updatePaymentError) {
    throw new Error(
      updatePaymentError.message,
    );
  }

  const {
    error: updateOrderError,
  } = await supabase
    .from("orders")
    .update({
      payment_status: "success",
      status: "paid",
    })
    .eq("id", payment.order_id);

  if (updateOrderError) {
    throw new Error(
      updateOrderError.message,
    );
  }

  const {
    error: logError,
  } = await supabase
    .from("payment_logs")
    .insert({
      payment_id: payment.id,
      event: "success",
      payload: {
        source: "admin",
        payment_status:
          "success",
      },
      note:
        "Payment marked as paid from admin dashboard.",
    });

  if (logError) {
    throw new Error(logError.message);
  }

  revalidatePath("/dashboard/orders");
}

export async function markPaymentAsFailed(
  paymentId: string,
) {
  const supabase = await createClient();

  const {
    data: payment,
    error: paymentError,
  } = await supabase
    .from("payments")
    .select(`
      id,
      order_id,
      status
    `)
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    throw new Error(
      paymentError.message,
    );
  }

  if (!payment) {
    throw new Error(
      "Payment not found.",
    );
  }

  const {
    error: updatePaymentError,
  } = await supabase
    .from("payments")
    .update({
      status: "failed",
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
      event: "failed",
      payload: {
        source: "admin",
      },
      note:
        "Payment marked as failed from admin dashboard.",
    });

  if (logError) {
    throw new Error(
      logError.message,
    );
  }

  revalidatePath("/dashboard/orders");
}