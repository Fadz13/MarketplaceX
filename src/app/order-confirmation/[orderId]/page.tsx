import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail } from "@/lib/actions/order";

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
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

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; icon: "pending" | "success" | "failed" }
> = {
  pending: {
    label: "Menunggu Pembayaran",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: "pending",
  },
  success: {
    label: "Pembayaran Berhasil",
    bg: "bg-green-100",
    text: "text-green-800",
    icon: "success",
  },
  failed: {
    label: "Pembayaran Gagal",
    bg: "bg-red-100",
    text: "text-red-800",
    icon: "failed",
  },
  expired: {
    label: "Pembayaran Kedaluwarsa",
    bg: "bg-red-100",
    text: "text-red-800",
    icon: "failed",
  },
  refunded: {
    label: "Dikembalikan",
    bg: "bg-purple-100",
    text: "text-purple-800",
    icon: "failed",
  },
  chargeback: {
    label: "Chargeback",
    bg: "bg-red-100",
    text: "text-red-800",
    icon: "failed",
  },
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

function StatusIcon({ icon }: { icon: "pending" | "success" | "failed" }) {
  if (icon === "success") {
    return (
      <svg
        className="h-8 w-8 text-green-600"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
    );
  }

  if (icon === "failed") {
    return (
      <svg
        className="h-8 w-8 text-red-600"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    );
  }

  return (
    <svg
      className="h-8 w-8 text-yellow-600 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default async function OrderConfirmationPage({
  params,
}: PageProps) {
  const { orderId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let orderData: Awaited<ReturnType<typeof getOrderDetail>>;

  try {
    orderData = await getOrderDetail(orderId);
  } catch {
    redirect("/");
  }

  const { order, items, payments } = orderData;

  const { data: internalUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!internalUser || order.buyer_id !== internalUser.id) {
    redirect("/");
  }

  const shipping = (order.shipping_snapshot as ShippingSnapshot) ?? {};
  const payment = payments[0];
  const paymentMethodLabel = payment
    ? (PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method)
    : "-";

  const paymentStatusConfig =
    PAYMENT_STATUS_CONFIG[order.payment_status] ?? {
      label: ORDER_STATUS_LABELS[order.status] ?? order.status,
      bg: "bg-gray-100",
      text: "text-gray-700",
      icon: "pending" as const,
    };

  const createdAt = new Date(order.created_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            MarketplaceX
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${paymentStatusConfig.bg}`}
          >
            <StatusIcon icon={paymentStatusConfig.icon} />
          </div>

          <h1 className="text-2xl font-bold">
            {order.payment_status === "success"
              ? "Pembayaran Berhasil!"
              : "Pesanan Berhasil Dibuat!"}
          </h1>

          <p className="mt-2 text-gray-500">
            {order.payment_status === "success"
              ? "Terima kasih telah berbelanja di MarketplaceX."
              : order.payment_status === "failed"
                ? "Pembayaran gagal. Silakan bayar dari halaman pesanan."
                : "Selesaikan pembayaran untuk memproses pesanan Anda."}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Nomor Pesanan</p>
                <p className="font-mono font-bold">{order.order_number}</p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">Tanggal</p>
                <p className="font-medium">{createdAt}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>

              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${paymentStatusConfig.bg} ${paymentStatusConfig.text}`}
              >
                {paymentStatusConfig.label}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">Item Pesanan</h2>

            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-gray-500">
                      {item.quantity} x Rp{" "}
                      {Number(item.unit_price).toLocaleString("id-ID")}
                    </p>
                  </div>

                  <p className="font-medium">
                    Rp {Number(item.subtotal).toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t pt-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>
                  Rp {Number(order.subtotal).toLocaleString("id-ID")}
                </span>
              </div>

              {Number(order.platform_fee) > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Biaya Platform</span>
                  <span>
                    Rp {Number(order.platform_fee).toLocaleString("id-ID")}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="text-xl">
                  Rp {Number(order.total_amount).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">Alamat Pengiriman</h2>

            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">
                {shipping.recipient_name ?? "-"}
              </p>
              <p>{shipping.phone ?? "-"}</p>
              <p>{shipping.address_detail ?? "-"}</p>
              <p>
                {shipping.city ?? "-"}, {shipping.province ?? "-"}{" "}
                {shipping.postal_code ?? "-"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">Metode Pembayaran</h2>

            <p className="text-sm text-gray-600">{paymentMethodLabel}</p>

            {payment?.transaction_id && (
              <p className="mt-1 text-xs text-gray-400">
                ID Transaksi: {payment.transaction_id}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Link
              href="/"
              className="flex-1 rounded-lg bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Lanjut Belanja
            </Link>

            {order.payment_status === "pending" && (
              <Link
                href={`/orders/${order.id}`}
                className="flex-1 rounded-lg border border-black px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-gray-50"
              >
                Bayar Sekarang
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
