import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  awaiting_payment: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  shipped: "Dikirim",
  delivered: "Diterima",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
  disputed: "Disengketakan",
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(
    "id-ID",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}

export default async function OrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/orders");
  }

  const {
    data: buyerRow,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!buyerRow) {
    redirect("/login?next=/orders");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", buyerRow.id)
    .order("created_at", { ascending: false });

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
            href="/orders"
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            Pesanan Saya
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold">
          Pesanan Saya
        </h1>

        {!orders || orders.length === 0 ? (
          <div className="rounded-lg border bg-white p-10 text-center text-slate-500">
            <p className="mb-4">
              Belum ada pesanan.
            </p>
            <Link
              href="/products"
              className="rounded-lg bg-black px-4 py-2 text-sm text-white"
            >
              Mulai Belanja
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="block rounded-lg border bg-white p-4 transition hover:shadow-md"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">
                    {o.order_number}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      o.status === "cancelled"
                        ? "bg-red-100 text-red-700"
                        : o.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {STATUS_LABELS[o.status] ??
                      o.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>
                    {formatDate(o.created_at)}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatPrice(o.total_amount)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
