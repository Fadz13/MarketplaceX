import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartButton } from "@/components/products/add-to-cart-button";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: product,
    error,
  } = await supabase
    .from("vw_active_products")
    .select(`
      id,
      name,
      description,
      price,
      discount_price,
      stock,
      sold_count,
      primary_image_url,
      store_name,
      category_name,
      brand_name
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!product) {
    notFound();
  }

 const productId = product.id ?? id;
  const productName =
    product.name ?? "Unnamed Product";

  const stock = product.stock ?? 0;

  const price = Number(
    product.price ?? 0,
  );

  const discountPrice =
    product.discount_price !== null
      ? Number(product.discount_price)
      : null;

  const finalPrice =
    discountPrice ?? price;

  const soldCount =
    product.sold_count ?? 0;

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

          <Link
            href="/cart"
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            Cart
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 rounded-2xl border bg-white p-6 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
            {product.primary_image_url ? (
              <img
                src={product.primary_image_url}
                alt={productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">
                No image
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">
              {product.store_name ??
                "MarketplaceX Store"}
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {productName}
            </h1>

            <p className="mt-5 text-3xl font-bold">
              Rp{" "}
              {finalPrice.toLocaleString(
                "id-ID",
              )}
            </p>

            {discountPrice !== null && (
              <p className="text-sm text-gray-400 line-through">
                Rp{" "}
                {price.toLocaleString(
                  "id-ID",
                )}
              </p>
            )}

            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <span>
                Stock {stock}
              </span>

              <span>
                Sold {soldCount}
              </span>
            </div>

            <div className="mt-6">
              <p className="text-sm text-gray-500">
                Category
              </p>

              <p className="font-medium">
                {product.category_name ??
                  "Uncategorized"}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-500">
                Brand
              </p>

              <p className="font-medium">
                {product.brand_name ??
                  "Unbranded"}
              </p>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">
                Description
              </p>

              <p className="leading-7 text-gray-600">
                {product.description ??
                  "No description available."}
              </p>
            </div>

            <AddToCartButton
              productId={productId}
              stock={stock}
            />
          </div>
        </div>
      </section>
    </main>
  );
}