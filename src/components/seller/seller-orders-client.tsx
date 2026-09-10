"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  subtotal: number;
  orders: {
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    total_amount: number;
    created_at: string;
  };
};

const STATUS_FILTERS = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "paid", label: "Dibayar" },
  { value: "processing", label: "Diproses" },
  { value: "shipped", label: "Dikirim" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu",
  awaiting_payment: "Menunggu Bayar",
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
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SellerOrdersClient({
  items,
  status,
}: {
  items: OrderItem[];
  status: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setStatus(val: string) {
    const params = new URLSearchParams(
      searchParams.toString(),
    );
    if (val) params.set("status", val);
    else params.delete("status");
    startTransition(() => {
      router.push(
        `/seller/orders?${params.toString()}`,
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            disabled={pending}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              status === f.value
                ? "bg-black text-white"
                : "border bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="px-5 py-3 text-left font-medium">
                  Order
                </th>
                <th className="px-5 py-3 text-left font-medium">
                  Produk
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  Qty
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  Subtotal
                </th>
                <th className="px-5 py-3 text-center font-medium">
                  Status
                </th>
                <th className="px-5 py-3 text-left font-medium">
                  Tanggal
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-gray-500"
                  >
                    Tidak ada pesanan ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const o = item.orders;
                  return (
                    <tr
                      key={item.id}
                      className="border-b"
                    >
                      <td className="px-5 py-3 font-medium">
                        {o.order_number}
                      </td>
                      <td className="px-5 py-3">
                        {item.product_name}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {formatPrice(item.subtotal)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            o.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : o.status ===
                                  "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {STATUS_LABELS[o.status] ??
                            o.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {formatDate(o.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
