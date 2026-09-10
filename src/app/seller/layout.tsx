import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/seller/dashboard", label: "Dashboard" },
  { href: "/seller/products", label: "Produk" },
  { href: "/seller/orders", label: "Pesanan" },
  { href: "/seller/withdraw", label: "Penarikan" },
];

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/seller/dashboard");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow || userRow.role !== "seller") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 p-6 text-white">
        <Link
          href="/seller/dashboard"
          className="mb-8 block text-2xl font-bold"
        >
          MarketplaceX
        </Link>

        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">
          Seller Panel
        </p>

        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 bg-slate-100 p-8">
        {children}
      </main>
    </div>
  );
}
