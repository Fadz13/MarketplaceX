import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellerOrdersClient } from "@/components/seller/seller-orders-client";

type PageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function SellerOrdersPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/seller/orders");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow) {
    redirect("/login?next=/seller/orders");
  }

  const params = await searchParams;
  const status = params.status ?? "";

  let query = supabase
    .from("order_items")
    .select(
      `
      id,
      product_name,
      quantity,
      subtotal,
      orders!inner (
        id,
        order_number,
        status,
        payment_status,
        total_amount,
        created_at
      )
    `,
    )
    .eq("seller_id", userRow.id)
    .order("created_at", {
      foreignTable: "orders",
      ascending: false,
    });

  if (status) {
    query = query.eq(
      "orders.status",
      status as
        | "pending"
        | "awaiting_payment"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "completed"
        | "cancelled"
        | "refunded"
        | "disputed",
    );
  }

  const { data: items } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Pesanan
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pesanan yang masuk ke toko Anda.
        </p>
      </div>

      <SellerOrdersClient
        items={items ?? []}
        status={status}
      />
    </div>
  );
}
