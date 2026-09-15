import type { SearchProduct } from "@/lib/actions/search";
import { ProductCard } from "@/components/products/product-card";

type Props = {
  products: SearchProduct[];
};

export function SearchResults({ products }: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">
        Tidak ada produk ditemukan. Coba kata kunci lain.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          name={product.name}
          price={product.price}
          discount_price={product.discount_price}
          stock={product.stock}
          sold_count={product.sold_count}
          primary_image_url={product.primary_image_url}
          store_name={product.store_name}
          rating={product.rating}
          review_count={product.review_count}
        />
      ))}
    </div>
  );
}
