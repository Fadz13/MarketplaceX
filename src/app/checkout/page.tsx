import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CheckoutPageClient } from "@/components/checkout/checkout-page-client";
import type { CartItem } from "@/lib/actions/cart";

const MOCK_CART_ITEMS: CartItem[] = [
  {
    id: "mock-cart-item-1",
    product_id: "mock-product-1",
    product_sku_id: null,
    quantity: 2,
    unit_price: 150000,
    product_name: "T-Shirt Oversize Premium",
    product_price: 150000,
    product_discount_price: null,
    product_stock: 50,
    product_image_url: null,
    product_has_variants: false,
    store_name: "Toko Fashion Jkt",
  },
  {
    id: "mock-cart-item-2",
    product_id: "mock-product-2",
    product_sku_id: null,
    quantity: 1,
    unit_price: 350000,
    product_name: "Headphone Wireless ANC",
    product_price: 400000,
    product_discount_price: 350000,
    product_stock: 20,
    product_image_url: null,
    product_has_variants: false,
    store_name: "Gadget Store Surabaya",
  },
];

export default async function CheckoutPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/checkout");
  }

  const items = MOCK_CART_ITEMS;
  const total = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
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

      <section className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold">
          Checkout
        </h1>

        <CheckoutPageClient
          items={items}
          total={total}
        />
      </section>
    </main>
  );
}
