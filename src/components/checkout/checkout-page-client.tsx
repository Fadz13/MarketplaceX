"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CartItem } from "@/lib/actions/cart";
import type { Address } from "@/lib/actions/address";
import { createOrderFromCart } from "@/lib/actions/order";
import { createSnapTransaction } from "@/lib/actions/midtrans";

declare global {
  interface Window {
    snap: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: Record<string, unknown>) => void;
          onPending?: (result: Record<string, unknown>) => void;
          onError?: (result: Record<string, unknown>) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

type Props = {
  items: CartItem[];
  total: number;
  addresses: Address[];
};

type AddressForm = {
  recipientName: string;
  phone: string;
  addressDetail: string;
  city: string;
  province: string;
  postalCode: string;
};

type PaymentMethod = "bank_transfer" | "e_wallet" | "cod";

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "e_wallet", label: "E-Wallet" },
  { value: "cod", label: "COD (Bayar di Tempat)" },
];

function addressToForm(addr: Address): AddressForm {
  return {
    recipientName: addr.recipient_name,
    phone: addr.phone,
    addressDetail: addr.address_detail,
    city: addr.city,
    province: addr.province,
    postalCode: addr.postal_code,
  };
}

export function CheckoutPageClient({ items, total, addresses }: Props) {
  const router = useRouter();

  const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0] ?? null;

  const [mode, setMode] = useState<"saved" | "new">(
    defaultAddr ? "saved" : "new",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    defaultAddr?.id ?? null,
  );

  const [address, setAddress] = useState<AddressForm>(
    defaultAddr ? addressToForm(defaultAddr) : {
      recipientName: "",
      phone: "",
      addressDetail: "",
      city: "",
      province: "",
      postalCode: "",
    },
  );

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("bank_transfer");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleSelectSaved(addr: Address) {
    setSelectedId(addr.id);
    setAddress(addressToForm(addr));
  }

  function handleUseNew() {
    setMode("new");
    setSelectedId(null);
    setAddress({
      recipientName: "",
      phone: "",
      addressDetail: "",
      city: "",
      province: "",
      postalCode: "",
    });
  }

  function handleAddressChange(field: keyof AddressForm, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  function getActiveAddress(): AddressForm {
    return address;
  }

  async function handleSubmit() {
    const addr = getActiveAddress();
    const missing = Object.entries(addr).filter(([, v]) => v.trim() === "");

    if (missing.length > 0) {
      setMessage("Lengkapi semua data alamat.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await createOrderFromCart({
        recipientName: addr.recipientName,
        phone: addr.phone,
        addressDetail: addr.addressDetail,
        province: addr.province,
        city: addr.city,
        postalCode: addr.postalCode,
        paymentMethod,
      });

      if (paymentMethod === "cod") {
        router.push(`/order-confirmation/${result.orderId}`);
        return;
      }

      const { token } = await createSnapTransaction(result.orderId);

      if (!token) {
        setMessage("Gagal mendapatkan token pembayaran.");
        setLoading(false);
        return;
      }

      if (typeof window === "undefined" || !window.snap) {
        setMessage("Midtrans belum siap. Silakan muat ulang halaman.");
        setLoading(false);
        return;
      }

      window.snap.pay(token, {
        onSuccess: () => {
          router.push(`/order-confirmation/${result.orderId}`);
        },
        onPending: () => {
          router.push(`/order-confirmation/${result.orderId}`);
        },
        onError: () => {
          setMessage(
            "Pembayaran gagal. Pesanan sudah dibuat, silakan bayar dari halaman pesanan.",
          );
          setLoading(false);
        },
        onClose: () => {
          setMessage(
            "Anda menutup popup pembayaran. Pesanan sudah dibuat, silakan bayar dari halaman pesanan.",
          );
          setLoading(false);
        },
      });
    } catch (err) {
      console.error("[checkout] Error:", err);
      const messageText =
        err instanceof Error
          ? err.message
          : "Gagal membuat pesanan. Silakan coba lagi.";
      setMessage(messageText);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.includes("berhasil") || message.includes("success")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Ringkasan Pesanan</h2>

        <div className="divide-y">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex-1">
                <p className="line-clamp-1 font-medium">{item.product_name}</p>
                <p className="text-sm text-gray-500">
                  {item.quantity} x Rp{" "}
                  {item.unit_price.toLocaleString("id-ID")}
                </p>
              </div>

              <p className="ml-4 font-medium">
                Rp {(item.unit_price * item.quantity).toLocaleString("id-ID")}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Total</span>
            <span className="text-xl font-bold">
              Rp {total.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Alamat Pengiriman</h2>

        {addresses.length > 0 && (
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("saved");
                if (defaultAddr) handleSelectSaved(defaultAddr);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                mode === "saved"
                  ? "border-black bg-black text-white"
                  : "hover:bg-gray-50"
              }`}
            >
              Alamat Tersimpan
            </button>
            <button
              type="button"
              onClick={handleUseNew}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                mode === "new"
                  ? "border-black bg-black text-white"
                  : "hover:bg-gray-50"
              }`}
            >
              Alamat Baru
            </button>
          </div>
        )}

        {mode === "saved" && addresses.length > 0 && (
          <div className="space-y-2">
            {addresses.map((addr) => (
              <label
                key={addr.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  selectedId === addr.id
                    ? "border-black bg-gray-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="savedAddress"
                  checked={selectedId === addr.id}
                  onChange={() => handleSelectSaved(addr)}
                  className="mt-1 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{addr.label}</span>
                    {addr.is_default && (
                      <span className="rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">
                        Utama
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-700">
                    {addr.recipient_name} · {addr.phone}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {addr.address_detail}, {addr.district}, {addr.city},{" "}
                    {addr.province} {addr.postal_code}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {mode === "new" && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="recipientName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nama Penerima
              </label>
              <input
                id="recipientName"
                type="text"
                value={address.recipientName}
                onChange={(e) =>
                  handleAddressChange("recipientName", e.target.value)
                }
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="Nama lengkap"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                No. HP
              </label>
              <input
                id="phone"
                type="tel"
                value={address.phone}
                onChange={(e) => handleAddressChange("phone", e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="08xxxxxxxxxx"
              />
            </div>

            <div>
              <label
                htmlFor="addressDetail"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Alamat Lengkap
              </label>
              <textarea
                id="addressDetail"
                value={address.addressDetail}
                onChange={(e) =>
                  handleAddressChange("addressDetail", e.target.value)
                }
                className="w-full rounded-lg border p-2 text-sm"
                rows={3}
                placeholder="Jalan, nomor, RT/RW, kelurahan"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="city"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Kota
                </label>
                <input
                  id="city"
                  type="text"
                  value={address.city}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm"
                  placeholder="Jakarta Selatan"
                />
              </div>

              <div>
                <label
                  htmlFor="province"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Provinsi
                </label>
                <input
                  id="province"
                  type="text"
                  value={address.province}
                  onChange={(e) =>
                    handleAddressChange("province", e.target.value)
                  }
                  className="w-full rounded-lg border p-2 text-sm"
                  placeholder="DKI Jakarta"
                />
              </div>
            </div>

            <div className="w-1/2">
              <label
                htmlFor="postalCode"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Kode Pos
              </label>
              <input
                id="postalCode"
                type="text"
                value={address.postalCode}
                onChange={(e) =>
                  handleAddressChange("postalCode", e.target.value)
                }
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="12345"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Metode Pembayaran</h2>

        <div className="space-y-2">
          {PAYMENT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                paymentMethod === option.value
                  ? "border-black bg-gray-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={paymentMethod === option.value}
                onChange={() => setPaymentMethod(option.value)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleSubmit}
        className="w-full rounded-lg bg-black py-3 text-center font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Buat Pesanan"}
      </button>
    </div>
  );
}
