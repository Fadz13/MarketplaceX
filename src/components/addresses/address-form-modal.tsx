"use client";

import { useState } from "react";
import type { Address } from "@/lib/actions/address";

type AddressFormData = {
  label: string;
  recipient_name: string;
  phone: string;
  address_detail: string;
  province: string;
  city: string;
  district: string;
  postal_code: string;
  is_default: boolean;
};

type Props = {
  address: Address | null;
  onClose: () => void;
  onSave: (data: AddressFormData) => Promise<void>;
};

export function AddressFormModal({ address, onClose, onSave }: Props) {
  const [form, setForm] = useState<AddressFormData>({
    label: address?.label ?? "Rumah",
    recipient_name: address?.recipient_name ?? "",
    phone: address?.phone ?? "",
    address_detail: address?.address_detail ?? "",
    province: address?.province ?? "",
    city: address?.city ?? "",
    district: address?.district ?? "",
    postal_code: address?.postal_code ?? "",
    is_default: address?.is_default ?? false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(field: keyof AddressFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await onSave(form);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan alamat.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <h3 className="text-lg font-semibold">
          {address ? "Edit Alamat" : "Tambah Alamat Baru"}
        </h3>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="label" className="mb-1 block text-sm font-medium text-gray-700">
              Label
            </label>
            <input
              id="label"
              type="text"
              value={form.label}
              onChange={(e) => handleChange("label", e.target.value)}
              className="w-full rounded-lg border p-2 text-sm"
              placeholder="Rumah, Kantor, dll."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="recipient_name" className="mb-1 block text-sm font-medium text-gray-700">
                Nama Penerima *
              </label>
              <input
                id="recipient_name"
                type="text"
                required
                value={form.recipient_name}
                onChange={(e) => handleChange("recipient_name", e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                No. HP *
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address_detail" className="mb-1 block text-sm font-medium text-gray-700">
              Alamat Lengkap *
            </label>
            <textarea
              id="address_detail"
              required
              value={form.address_detail}
              onChange={(e) => handleChange("address_detail", e.target.value)}
              className="w-full rounded-lg border p-2 text-sm"
              rows={3}
              placeholder="Jalan, nomor, RT/RW, kelurahan"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="province" className="mb-1 block text-sm font-medium text-gray-700">
                Provinsi *
              </label>
              <input
                id="province"
                type="text"
                required
                value={form.province}
                onChange={(e) => handleChange("province", e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="city" className="mb-1 block text-sm font-medium text-gray-700">
                Kota *
              </label>
              <input
                id="city"
                type="text"
                required
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="district" className="mb-1 block text-sm font-medium text-gray-700">
                Kecamatan *
              </label>
              <input
                id="district"
                type="text"
                required
                value={form.district}
                onChange={(e) => handleChange("district", e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="postal_code" className="mb-1 block text-sm font-medium text-gray-700">
                Kode Pos *
              </label>
              <input
                id="postal_code"
                type="text"
                required
                value={form.postal_code}
                onChange={(e) => handleChange("postal_code", e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="12345"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => handleChange("is_default", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-700">
              Atur sebagai alamat utama
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
