import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCart } from "@/lib/actions/cart";
import { CheckoutPageClient } from "@/components/checkout/checkout-page-client";

export default async function CheckoutPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/checkout");
  }

  const { items, total } = await getCart();

  if (items.length === 0) {
    redirect("/cart");
  }

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
