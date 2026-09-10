"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/input";
import { Button } from "@/components/button";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
  sold_count: number;
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

const PAGE_SIZE = 10;

export function SellerProductsClient({
  products,
  total,
  page,
  search,
}: {
  products: Product[];
  total: number;
  page: number;
  search: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [searchInput, setSearchInput] =
    useState(search);

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE),
  );

  function navigate(nextPage: number, q: string) {
    const params = new URLSearchParams(
      searchParams.toString(),
    );
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    if (q) params.set("q", q);
    else params.delete("q");
    startTransition(() => {
      router.push(
        `/seller/products?${params.toString()}`,
      );
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(1, searchInput);
        }}
        className="flex items-center gap-2"
      >
        <Input
          placeholder="Cari produk..."
          value={searchInput}
          onChange={(e) =>
            setSearchInput(e.target.value)
          }
          className="max-w-sm"
        />
        <Button type="submit" disabled={pending}>
          Cari
        </Button>
      </form>

      <div className="rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="px-5 py-3 text-left font-medium">
                  Nama Produk
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  Harga
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  Stok
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  Terjual
                </th>
                <th className="px-5 py-3 text-center font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-gray-500"
                  >
                    Tidak ada produk ditemukan.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b"
                  >
                    <td className="px-5 py-3 font-medium">
                      {p.name}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {formatPrice(p.price)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.stock}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.sold_count}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Halaman {page} dari {totalPages} ({total} produk)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || pending}
              onClick={() =>
                navigate(page - 1, search)
              }
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || pending}
              onClick={() =>
                navigate(page + 1, search)
              }
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
