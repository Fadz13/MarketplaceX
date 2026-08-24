import { createClient } from "@/lib/supabase/server";
import { ProductsClient } from "@/components/products/products-client";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [
    { data: products, error: productsError },
    { data: categories, error: categoriesError },
    { data: brands, error: brandsError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        category_id,
        brand_id,
        price,
        discount_price,
        stock,
        condition,
        status,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("categories")
      .select("id, name")
      .order("name"),

    supabase
      .from("brands")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (productsError) {
    throw new Error(productsError.message);
  }

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  if (brandsError) {
    throw new Error(brandsError.message);
  }

  const productIds =
    products?.map((product) => product.id) ?? [];

  let imageMap = new Map<string, string>();

  if (productIds.length > 0) {
    const {
      data: images,
      error: imagesError,
    } = await supabase
      .from("product_images")
      .select(
        "product_id, image_url, is_primary, sort_order",
      )
      .in("product_id", productIds)
      .order("sort_order", {
        ascending: true,
      });

    if (imagesError) {
      throw new Error(imagesError.message);
    }

    for (const image of images ?? []) {
      if (
        image.is_primary &&
        !imageMap.has(image.product_id)
      ) {
        imageMap.set(
          image.product_id,
          image.image_url,
        );
      }
    }

    for (const image of images ?? []) {
      if (!imageMap.has(image.product_id)) {
        imageMap.set(
          image.product_id,
          image.image_url,
        );
      }
    }
  }

  const productsWithImages =
    (products ?? []).map((product) => ({
      ...product,
      image_url:
        imageMap.get(product.id) ?? null,
      category: null,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Products
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage all products in MarketplaceX.
        </p>
      </div>

      <ProductsClient
        products={productsWithImages}
        categories={categories ?? []}
        brands={brands ?? []}
      />
    </div>
  );
}