import Link from "next/link";

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

const MOCK_ORDER = {
  orderNumber: "MX-20260904-0001",
  createdAt: new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  status: "pending",
  items: [
    {
      name: "T-Shirt Oversize Premium",
      quantity: 2,
      unitPrice: 150000,
    },
    {
      name: "Headphone Wireless ANC",
      quantity: 1,
      unitPrice: 350000,
    },
  ],
  address: {
    recipientName: "Budi Santoso",
    phone: "081234567890",
    detail: "Jl. Sudirman No. 123, RT 01/RW 02, Kel. Menteng",
    city: "Jakarta Selatan",
    province: "DKI Jakarta",
    postalCode: "12345",
  },
  paymentMethod: "Bank Transfer",
};

const TOTAL = MOCK_ORDER.items.reduce(
  (sum, item) => sum + item.unitPrice * item.quantity,
  0,
);

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  awaiting_payment: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  shipped: "Dikirim",
  delivered: "Diterima",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export default async function OrderConfirmationPage({
  params,
}: PageProps) {
  const { orderId } = await params;

  const displayOrderNumber = orderId
    ? `MX-${orderId.slice(0, 8).toUpperCase()}`
    : MOCK_ORDER.orderNumber;

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
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
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
          </div>

          <h1 className="text-2xl font-bold">
            Pesanan Berhasil Dibuat!
          </h1>

          <p className="mt-2 text-gray-500">
            Terima kasih telah berbelanja di MarketplaceX.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Nomor Pesanan
                </p>
                <p className="font-mono font-bold">
                  {displayOrderNumber}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">
                  Tanggal
                </p>
                <p className="font-medium">
                  {MOCK_ORDER.createdAt}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <span className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                {STATUS_LABELS[MOCK_ORDER.status] ?? MOCK_ORDER.status}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">
              Item Pesanan
            </h2>

            <div className="divide-y">
              {MOCK_ORDER.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">
                      {item.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.quantity} x Rp{" "}
                      {item.unitPrice.toLocaleString("id-ID")}
                    </p>
                  </div>

                  <p className="font-medium">
                    Rp{" "}
                    {(item.unitPrice * item.quantity).toLocaleString(
                      "id-ID",
                    )}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold">
                  Rp {TOTAL.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">
              Alamat Pengiriman
            </h2>

            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">
                {MOCK_ORDER.address.recipientName}
              </p>
              <p>{MOCK_ORDER.address.phone}</p>
              <p>{MOCK_ORDER.address.detail}</p>
              <p>
                {MOCK_ORDER.address.city},{" "}
                {MOCK_ORDER.address.province}{" "}
                {MOCK_ORDER.address.postalCode}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">
              Metode Pembayaran
            </h2>

            <p className="text-sm text-gray-600">
              {MOCK_ORDER.paymentMethod}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/orders"
              className="flex-1 rounded-lg border px-4 py-3 text-center text-sm font-medium transition hover:bg-gray-50"
            >
              Lihat Pesanan Saya
            </Link>

            <Link
              href="/"
              className="flex-1 rounded-lg bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Lanjut Belanja
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
