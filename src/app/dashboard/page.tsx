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
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    totalOrdersResult,
    completedOrdersResult,
    totalProductsResult,
    ordersResult,
    productsResult,
    storesResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("orders")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "completed"),

    supabase
      .from("products")
      .select("id", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        payment_status,
        total_amount,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(5),

    supabase
      .from("products")
      .select(`
        id,
        name,
        stock,
        sold_count,
        status,
        has_variants
      `)
      .order("sold_count", {
        ascending: false,
      })
      .limit(5),

    supabase
      .from("stores")
      .select(`
        id,
        store_name,
        total_sales,
        total_revenue
      `)
      .order("total_revenue", {
        ascending: false,
      }),
  ]);

  if (totalOrdersResult.error) {
    throw new Error(
      `Failed to load total orders: ${totalOrdersResult.error.message}`,
    );
  }

  if (completedOrdersResult.error) {
    throw new Error(
      `Failed to load completed orders: ${completedOrdersResult.error.message}`,
    );
  }

  if (totalProductsResult.error) {
    throw new Error(
      `Failed to load total products: ${totalProductsResult.error.message}`,
    );
  }

  if (ordersResult.error) {
    throw new Error(
      `Failed to load recent orders: ${ordersResult.error.message}`,
    );
  }

  if (productsResult.error) {
    throw new Error(
      `Failed to load products: ${productsResult.error.message}`,
    );
  }

  if (storesResult.error) {
    throw new Error(
      `Failed to load stores: ${storesResult.error.message}`,
    );
  }

  const totalOrders =
    totalOrdersResult.count ?? 0;

  const completedOrders =
    completedOrdersResult.count ?? 0;

  const totalProducts =
    totalProductsResult.count ?? 0;

  const orders =
    ordersResult.data ?? [];

  const products =
    productsResult.data ?? [];

  const stores =
    storesResult.data ?? [];

  const revenue = orders
    .filter(
      (order) =>
        order.status === "completed",
    )
    .reduce(
      (sum, order) =>
        sum +
        Number(
          order.total_amount ?? 0,
        ),
      0,
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          MarketplaceX overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Revenue
          </p>

          <p className="mt-2 text-2xl font-bold">
            {formatPrice(revenue)}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Orders
          </p>

          <p className="mt-2 text-2xl font-bold">
            {totalOrders}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Completed Orders
          </p>

          <p className="mt-2 text-2xl font-bold">
            {completedOrders}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Products
          </p>

          <p className="mt-2 text-2xl font-bold">
            {totalProducts}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Recent Orders
            </h2>
          </div>

          <div className="divide-y">
            {orders.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                No orders found.
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <p className="font-medium">
                      {order.order_number}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {formatStatus(
                        order.status,
                      )}{" "}
                      ·{" "}
                      {formatStatus(
                        order.payment_status,
                      )}
                    </p>
                  </div>

                  <p className="font-semibold">
                    {formatPrice(
                      Number(
                        order.total_amount ??
                          0,
                      ),
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Top Products
            </h2>
          </div>

          <div className="divide-y">
            {products.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                No products found.
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {product.name}
                      </p>

                      {product.status !==
                        "active" && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {formatStatus(
                            product.status,
                          )}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      Stock:{" "}
                      {product.stock ?? 0}
                    </p>
                  </div>

                  <p className="shrink-0 font-semibold">
                    Sold{" "}
                    {product.sold_count ??
                      0}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Seller Revenue
          </h2>
        </div>

        {stores.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No stores found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="px-5 py-3 text-left font-medium">
                    Store
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Sales
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Revenue
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Available
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Pending
                  </th>
                </tr>
              </thead>

              <tbody>
                {stores.map((store) => (
                  <tr
                    key={store.id}
                    className="border-b"
                  >
                    <td className="px-5 py-3 font-medium">
                      {store.store_name}
                    </td>

                    <td className="px-5 py-3">
                      {store.total_sales}
                    </td>

                    <td className="px-5 py-3 font-semibold">
                      {formatPrice(
                        Number(
                          store.total_revenue ??
                            0,
                        ),
                      )}
                    </td>

                    <td className="px-5 py-3">
                      Rp 0
                    </td>

                    <td className="px-5 py-3">
                      Rp 0
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}