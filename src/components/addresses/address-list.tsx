"use client";

import { useState } from "react";
import type { Address } from "@/lib/actions/address";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/actions/address";
import { AddressFormModal } from "./address-form-modal";

type Props = {
  addresses: Address[];
};

export function AddressListClient({ addresses: initial }: Props) {
  const [addresses, setAddresses] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const fresh = await getAddresses();
      setAddresses(fresh);
    } catch {
      // silent
    }
  }

  function handleCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleEdit(addr: Address) {
    setEditing(addr);
    setModalOpen(true);
  }

  async function handleSave(
    data: Parameters<typeof createAddress>[0],
  ) {
    setError("");
    try {
      if (editing) {
        await updateAddress(editing.id, data);
      } else {
        await createAddress(data);
      }
      setModalOpen(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan alamat.";
      setError(msg);
      throw err;
    }
  }

  function handleConfirmDelete(addr: Address) {
    setDeleteTarget(addr);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setError("");
    try {
      await deleteAddress(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal menghapus alamat.";
      setError(msg);
    }
  }

  async function handleSetDefault(addr: Address) {
    if (addr.is_default) return;
    setError("");
    try {
      await setDefaultAddress(addr.id);
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengatur default.";
      setError(msg);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {addresses.length} alamat tersimpan
        </p>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Tambah Alamat
        </button>
      </div>

      {addresses.length === 0 && (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <p className="text-gray-500">Belum ada alamat tersimpan.</p>
          <p className="mt-1 text-sm text-gray-400">
            Tambahkan alamat untuk mempermudah checkout.
          </p>
        </div>
      )}

      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={`rounded-2xl border bg-white p-5 ${
            addr.is_default ? "ring-2 ring-black" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{addr.label}</span>
                {addr.is_default && (
                  <span className="rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">
                    Utama
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-700">
                {addr.recipient_name} · {addr.phone}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {addr.address_detail}, {addr.district}, {addr.city},{" "}
                {addr.province} {addr.postal_code}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!addr.is_default && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(addr)}
                  disabled={false}
                  className="text-xs text-gray-500 hover:text-black"
                >
                  Atur sebagai utama
                </button>
              )}
              <button
                type="button"
                onClick={() => handleEdit(addr)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(addr)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      ))}

      {modalOpen && (
        <AddressFormModal
          address={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
            setError("");
          }}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold">Hapus Alamat?</h3>
            <p className="mt-2 text-sm text-gray-500">
              Alamat &ldquo;{deleteTarget.label}&rdquo; akan dihapus secara
              permanen.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                    Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
