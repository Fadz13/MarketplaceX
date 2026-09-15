import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/products/product-card";
import { SiteHeader } from "@/components/search/site-header";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("vw_active_products")
      .select(`
        id,
        name,
        price,
        discount_price,
        stock,
        sold_count,
        primary_image_url,
        store_name,
        category_name,
        brand_name,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            MarketplaceX
          </h1>

          <p className="mt-2 text-gray-500">
            Temukan produk dari seller
            MarketplaceX.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">
            Belum ada produk aktif.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id!}
                name={product.name}
                price={product.price}
                discount_price={product.discount_price}
                stock={product.stock}
                sold_count={product.sold_count}
                primary_image_url={product.primary_image_url}
                store_name={product.store_name}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}