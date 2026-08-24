import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "@/components/orders/orders-client";

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

type Order = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  platform_fee: number;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  buyer_id: string;
  item_count: number;
  total_quantity: number;
};

type RawOrder = {
  id: string | null;
  order_number: string | null;
  status: OrderStatus | null;
  payment_status: string | null;
  subtotal: number | null;
  shipping_cost: number | null;
  discount_amount: number | null;
  platform_fee: number | null;
  total_amount: number | null;
  created_at: string | null;
  completed_at: string | null;
  buyer_id: string | null;
  item_count: number | null;
  total_quantity: number | null;
};

function isValidOrder(
  order: RawOrder,
): order is RawOrder & {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  platform_fee: number;
  total_amount: number;
  created_at: string;
  buyer_id: string;
  item_count: number;
  total_quantity: number;
} {
  return (
    order.id !== null &&
    order.order_number !== null &&
    order.status !== null &&
    order.payment_status !== null &&
    order.subtotal !== null &&
    order.shipping_cost !== null &&
    order.discount_amount !== null &&
    order.platform_fee !== null &&
    order.total_amount !== null &&
    order.created_at !== null &&
    order.buyer_id !== null &&
    order.item_count !== null &&
    order.total_quantity !== null
  );
}

export default async function OrdersPage() {
  const supabase = await createClient();

  const {
    data: rawOrders,
    error,
  } = await supabase
    .from("vw_order_summary")
    .select(`
      id,
      order_number,
      status,
      payment_status,
      subtotal,
      shipping_cost,
      discount_amount,
      platform_fee,
      total_amount,
      created_at,
      completed_at,
      buyer_id,
      item_count,
      total_quantity
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const typedRawOrders =
    (rawOrders ?? []) as RawOrder[];

  const orders: Order[] =
    typedRawOrders
      .filter(isValidOrder)
      .map((order) => ({
        id: order.id,
        order_number:
          order.order_number,
        status: order.status,
        payment_status:
          order.payment_status,
        subtotal: Number(order.subtotal),
        shipping_cost: Number(
          order.shipping_cost,
        ),
        discount_amount: Number(
          order.discount_amount,
        ),
        platform_fee: Number(
          order.platform_fee,
        ),
        total_amount: Number(
          order.total_amount,
        ),
        created_at: order.created_at,
        completed_at:
          order.completed_at,
        buyer_id: order.buyer_id,
        item_count: Number(
          order.item_count,
        ),
        total_quantity: Number(
          order.total_quantity,
        ),
      }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Orders
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage orders in MarketplaceX.
        </p>
      </div>

      <OrdersClient
        orders={orders}
      />
    </div>
  );
}