import { createClient } from "@/lib/supabase/server";

function formatPrice(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function SellerDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user!.id)
    .maybeSingle();

  const sellerId = userRow!.id;

  const [
    { data: store },
    { count: totalProducts },
    { data: orderItemsResult },
    { data: balance },
    { data: recentOrders },
  ] = await Promise.all([
    supabase
      .from("stores")
      .select("id, store_name")
      .eq("seller_id", sellerId)
      .maybeSingle(),

    supabase
      .from("products")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("store_id", (await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", sellerId)
        .maybeSingle()
      ).data?.id ?? ""),

    supabase
      .from("order_items")
      .select("id, subtotal, order_id", {
        count: "exact",
      })
      .eq("seller_id", sellerId),

    supabase
      .from("seller_balances")
      .select(
        "available_balance, pending_balance, total_earned",
      )
      .eq("seller_id", sellerId)
      .maybeSingle(),

    supabase
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
          created_at
        )
      `,
      )
      .eq("seller_id", sellerId)
      .order("created_at", {
        foreignTable: "orders",
        ascending: false,
      })
      .limit(5),
  ]);

  const totalOrders =
    orderItemsResult?.length ?? 0;
  const totalRevenue =
    orderItemsResult?.reduce(
      (s, i) => s + (i.subtotal ?? 0),
      0,
    ) ?? 0;

  type OrderItemRow = {
    id: string;
    product_name: string;
    quantity: number;
    subtotal: number;
    orders: {
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      created_at: string;
    };
  };

  const ordersList =
    (recentOrders as OrderItemRow[] | null) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {store?.store_name ?? "Seller"} overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Produk
          </p>
          <p className="mt-2 text-2xl font-bold">
            {totalProducts ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Pesanan
          </p>
          <p className="mt-2 text-2xl font-bold">
            {totalOrders}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Pendapatan
          </p>
          <p className="mt-2 text-2xl font-bold">
            {formatPrice(totalRevenue)}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Saldo Tersedia
          </p>
          <p className="mt-2 text-2xl font-bold">
            {formatPrice(
              balance?.available_balance ?? 0,
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Pesanan Terbaru
            </h2>
          </div>
          <div className="divide-y">
            {ordersList.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                Belum ada pesanan.
              </div>
            ) : (
              ordersList.map((item) => {
                const o = item.orders;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 p-5"
                  >
                    <div>
                      <p className="font-medium">
                        {o.order_number}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.product_name} x
                        {item.quantity} ·{" "}
                        {formatStatus(o.status)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatPrice(item.subtotal)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Saldo
            </h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Tersedia
              </span>
              <span className="font-semibold">
                {formatPrice(
                  balance?.available_balance ?? 0,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Pending
              </span>
              <span className="font-semibold">
                {formatPrice(
                  balance?.pending_balance ?? 0,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-gray-500">
                Total Diperoleh
              </span>
              <span className="font-bold">
                {formatPrice(
                  balance?.total_earned ?? 0,
                )}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
