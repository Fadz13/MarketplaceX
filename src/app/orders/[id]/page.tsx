import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail } from "@/lib/actions/order";
import { CancelOrderButton } from "@/components/orders/cancel-order-button";

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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  virtual_account: "Virtual Account",
  e_wallet: "E-Wallet",
  credit_card: "Kartu Kredit",
  debit_card: "Kartu Debit",
  cod: "COD (Bayar di Tempat)",
  marketplace_credit: "Kredit Marketplace",
};

type ShippingSnapshot = {
  recipient_name?: string;
  phone?: string;
  address_detail?: string;
  province?: string;
  city?: string;
  postal_code?: string;
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/orders/${id}`);
  }

  const {
    data: buyerRow,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!buyerRow) {
    redirect(`/login?next=/orders/${id}`);
  }

  let result: Awaited<
    ReturnType<typeof getOrderDetail>
  >;

  try {
    result = await getOrderDetail(id);
  } catch {
    notFound();
  }

  const { order, items, payments } = result;

  if (order.buyer_id !== buyerRow.id) {
    notFound();
  }

  const shipping =
    (order.shipping_snapshot as ShippingSnapshot) ??
    {};
  const firstPayment = payments[0];

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
            className="text-sm text-slate-600 hover:underline"
          >
            &larr; Pesanan Saya
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Detail Pesanan
            </h1>
            <p className="font-mono text-sm text-slate-500">
              {order.order_number}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              order.status === "cancelled"
                ? "bg-red-100 text-red-700"
                : order.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
            }`}
          >
            {STATUS_LABELS[order.status] ??
              order.status}
          </span>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-3 font-semibold">
              Item Pesanan
            </h2>

            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium">
                      {item.product_name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {item.quantity} x{" "}
                      {formatPrice(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatPrice(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t pt-3">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>
                  {formatPrice(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Biaya Platform</span>
                <span>
                  {formatPrice(order.platform_fee)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Ongkir</span>
                <span>
                  {formatPrice(
                    order.shipping_cost,
                  )}
                </span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Diskon</span>
                  <span>
                    -
                    {formatPrice(
                      order.discount_amount,
                    )}
                  </span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t pt-2 font-bold">
                <span>Total</span>
                <span>
                  {formatPrice(order.total_amount)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-3 font-semibold">
              Pengiriman
            </h2>

            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {shipping.recipient_name ?? "-"}
              </p>
              <p className="text-slate-600">
                {shipping.phone ?? "-"}
              </p>
              <p className="text-slate-600">
                {shipping.address_detail ?? "-"}
              </p>
              <p className="text-slate-600">
                {shipping.city ?? "-"},{" "}
                {shipping.province ?? "-"}{" "}
                {shipping.postal_code ?? ""}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-3 font-semibold">
              Pembayaran
            </h2>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Metode
                </span>
                <span>
                  {firstPayment
                    ? (PAYMENT_METHOD_LABELS[
                        firstPayment
                          .payment_method
                      ] ??
                        firstPayment.payment_method)
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Status
                </span>
                <span>
                  {firstPayment?.status ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Jumlah
                </span>
                <span>
                  {firstPayment
                    ? formatPrice(firstPayment.amount)
                    : "-"}
                </span>
              </div>
              {firstPayment?.transaction_id && (
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    ID Transaksi
                  </span>
                  <span className="font-mono text-xs">
                    {firstPayment.transaction_id}
                  </span>
                </div>
              )}
            </div>
          </div>

          {(order.status === "pending" ||
            order.status ===
              "awaiting_payment") && (
            <CancelOrderButton orderId={order.id} />
          )}
        </div>
      </section>
    </main>
  );
}
