"use client";

import { useMemo, useState, useTransition } from "react";
import { ProductTable } from "./product-table";
import { ProductToolbar } from "./product-toolbar";
import { AddProductModal } from "./add-product-modal";
import { EditProductModal } from "./edit-product-modal";
import { deleteProduct } from "@/lib/actions/product";

type Brand = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  brand_id: string | null;
  image_url: string | null;
  category: {
    id: string;
    name: string;
  } | null;
  price: number;
  discount_price: number | null;
  stock: number;
  condition: string;
  status: string;
  created_at: string;
  description?: string | null;
};

type Props = {
  products: Product[];
  categories: {
    id: string;
    name: string;
  }[];
  brands: Brand[];
};

const ITEMS_PER_PAGE = 10;

export function ProductsClient({
  products,
  categories,
  brands,
}: Props) {
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const [pendingDelete, startDeleteTransition] =
    useTransition();

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !keyword ||
        product.name.toLowerCase().includes(keyword) ||
        product.slug.toLowerCase().includes(keyword);

      const matchesCategory =
        categoryId === "all" ||
        product.category_id === categoryId;

      const matchesStatus =
        status === "all" ||
        product.status === status;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus
      );
    });
  }, [products, search, categoryId, status]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredProducts.length / ITEMS_PER_PAGE,
    ),
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedProducts =
    filteredProducts.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE,
    );

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  function handleDelete(product: Product) {
    if (pendingDelete) {
      return;
    }

    startDeleteTransition(async () => {
      try {
        await deleteProduct(product.id);
        window.location.reload();
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Failed to delete product.",
        );
      }
    });
  }

  const start =
    filteredProducts.length === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const end = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredProducts.length,
  );

  return (
    <div className="space-y-6">
      <ProductToolbar
        search={search}
        categoryId={categoryId}
        status={status}
        categories={categories}
        onSearch={handleSearch}
        onCategoryChange={handleCategoryChange}
        onStatusChange={handleStatusChange}
        onAddClick={() => setOpen(true)}
      />

      <ProductTable
        products={paginatedProducts}
        onEdit={(product) => {
          setEditingProduct(product);
        }}
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {start}-{end} of{" "}
          {filteredProducts.length} products
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() =>
              setPage((value) => value - 1)
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from(
              { length: totalPages },
              (_, index) => index + 1,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() =>
                  setPage(pageNumber)
                }
                className={`h-9 min-w-9 rounded-lg px-3 text-sm ${
                  currentPage === pageNumber
                    ? "bg-black text-white"
                    : "border hover:bg-gray-100"
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() =>
              setPage((value) => value + 1)
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <AddProductModal
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        brands={brands}
      />

      <EditProductModal
        open={editingProduct !== null}
        product={editingProduct}
        categories={categories}
        brands={brands}
        onClose={() => setEditingProduct(null)}
      />
    </div>
  );
}