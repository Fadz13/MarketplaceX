import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: products, error },
  ] = await Promise.all([
    supabase.auth.getUser(),

    supabase
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
      .limit(20),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-xl font-bold"
          >
            MarketplaceX
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-gray-600">
                  {user.email}
                </span>

                <Link
                  href="/cart"
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white"
                >
                  Cart
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Login
                </Link>

                <Link
                  href="/cart"
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white"
                >
                  Cart
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

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
            {products.map((product) => {
              const finalPrice =
                product.discount_price ??
                product.price;

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group rounded-2xl border bg-white p-4 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                    {product.primary_image_url ? (
                      <img
                        src={
                          product.primary_image_url
                        }
                        alt={
                          product.name ??
                          "Product image"
                        }
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-gray-500">
                      {product.store_name ??
                        "MarketplaceX Store"}
                    </p>

                    <h2 className="mt-1 line-clamp-2 font-semibold">
                      {product.name ??
                        "Unnamed Product"}
                    </h2>

                    <p className="mt-3 font-bold">
                      Rp{" "}
                      {Number(
                        finalPrice ?? 0,
                      ).toLocaleString(
                        "id-ID",
                      )}
                    </p>

                    {product.discount_price !==
                      null && (
                      <p className="text-xs text-gray-400 line-through">
                        Rp{" "}
                        {Number(
                          product.price ?? 0,
                        ).toLocaleString(
                          "id-ID",
                        )}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                      Stock{" "}
                      {product.stock ?? 0}{" "}
                      · Sold{" "}
                      {product.sold_count ?? 0}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}