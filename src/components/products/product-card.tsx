import Link from "next/link";

export type ProductCardProps = {
  id: string;
  name: string | null;
  price: number | null;
  discount_price: number | null;
  stock: number | null;
  sold_count: number | null;
  primary_image_url: string | null;
  store_name: string | null;
  rating?: number | null;
  review_count?: number | null;
};

export function ProductCard({
  id,
  name,
  price,
  discount_price,
  stock,
  sold_count,
  primary_image_url,
  store_name,
  rating,
  review_count,
}: ProductCardProps) {
  const finalPrice = discount_price ?? price ?? 0;
  const originalPrice = price ?? 0;
  const hasDiscount =
    discount_price != null && discount_price < originalPrice;
  const displayStock = stock ?? 0;
  const displaySold = sold_count ?? 0;

  return (
    <Link
      href={`/products/${id}`}
      className="group rounded-2xl border bg-white p-4 transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
        {primary_image_url ? (
          <img
            src={primary_image_url}
            alt={name ?? "Product image"}
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
          {store_name ?? "MarketplaceX Store"}
        </p>

        <h2 className="mt-1 line-clamp-2 font-semibold">
          {name ?? "Unnamed Product"}
        </h2>

        <p className="mt-3 font-bold">
          Rp {Number(finalPrice).toLocaleString("id-ID")}
        </p>

        {hasDiscount && (
          <p className="text-xs text-gray-400 line-through">
            Rp {Number(originalPrice).toLocaleString("id-ID")}
          </p>
        )}

        {rating != null && rating > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <span className="text-amber-500">★</span>
            <span>{Number(rating).toFixed(1)}</span>
            {review_count != null && (
              <span className="text-gray-400">({review_count})</span>
            )}
          </div>
        )}

        <p className="mt-1 text-xs text-gray-500">
          Stock {displayStock} · Sold {displaySold}
        </p>
      </div>
    </Link>
  );
}
