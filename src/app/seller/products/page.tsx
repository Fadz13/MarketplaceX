import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellerProductsClient } from "@/components/seller/seller-products-client";

const PAGE_SIZE = 10;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function SellerProductsPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/seller/products");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow) {
    redirect("/login?next=/seller/products");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", userRow.id)
    .maybeSingle();

  if (!store) {
    redirect("/seller/dashboard");
  }

  const params = await searchParams;
  const q = params.q ?? "";
  const page = Math.max(
    1,
    parseInt(params.page ?? "1", 10) || 1,
  );

  let query = supabase
    .from("products")
    .select(
      "id, name, price, stock, status, sold_count",
      { count: "exact" },
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: products, count } = await query.range(
    from,
    to,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Produk
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Kelola produk toko Anda.
        </p>
      </div>

      <SellerProductsClient
        products={products ?? []}
        total={count ?? 0}
        page={page}
        search={q}
      />
    </div>
  );
}
