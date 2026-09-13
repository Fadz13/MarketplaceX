"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/order-status";
import {
  processSellerOrder,
  shipSellerOrder,
} from "@/lib/actions/seller-orders";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  subtotal: number;
  status: string;
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

function ShipForm({
  orderId,
  onSuccess,
}: {
  orderId: string;
  onSuccess: () => void;
}) {
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError("");
    if (!courier.trim()) {
      setError("Kurir harus diisi.");
      return;
    }
    if (!trackingNumber.trim()) {
      setError("Nomor resi harus diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await shipSellerOrder({
          orderId,
          courier,
          trackingNumber,
        });
        onSuccess();
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Gagal mengirim pesanan.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Kurir (e.g. JNE, J&T)"
        value={courier}
        onChange={(e) => setCourier(e.target.value)}
        disabled={pending}
        className="rounded border px-2 py-1 text-xs"
      />
      <input
        type="text"
        placeholder="Nomor Resi"
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        disabled={pending}
        className="rounded border px-2 py-1 text-xs"
      />
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
      <button
        onClick={handleSubmit}
        disabled={pending}
        className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Mengirim..." : "Kirim"}
      </button>
    </div>
  );
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  function refresh() {
    router.refresh();
  }

  async function handleProcessOrder(orderId: string) {
    setActionMessage(null);
    try {
      await processSellerOrder(orderId);
      setActionMessage("Pesanan sedang diproses.");
      refresh();
    } catch (e: unknown) {
      setActionMessage(
        e instanceof Error ? e.message : "Gagal memproses pesanan.",
      );
    }
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

      {actionMessage && (
        <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
          {actionMessage}
        </div>
      )}

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
                  Status Item
                </th>
                <th className="px-5 py-3 text-left font-medium">
                  Tanggal
                </th>
                <th className="px-5 py-3 text-center font-medium">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-gray-500"
                  >
                    Tidak ada pesanan ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const o = item.orders;
                  const itemStatus = item.status as keyof typeof ORDER_STATUS_LABELS;
                  const canProcess = (item.status === "paid" || item.status === "pending") &&
                    o.payment_status === "success";
                  const canShip = item.status === "processing";
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
                            ORDER_STATUS_COLORS[itemStatus] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[itemStatus] ?? item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {formatDate(o.created_at)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {canProcess && (
                          <button
                            onClick={() => handleProcessOrder(o.id)}
                            className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700"
                          >
                            Proses
                          </button>
                        )}
                        {canShip && (
                          <ShipForm
                            orderId={o.id}
                            onSuccess={refresh}
                          />
                        )}
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
