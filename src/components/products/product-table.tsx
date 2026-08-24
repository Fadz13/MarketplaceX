"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = {
  id: string;
  name: string;
  slug: string;
  category: {
    id: string;
    name: string;
  } | null;
  category_id: string | null;
  brand_id: string | null;
  image_url: string | null;
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
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

type MenuPosition = {
  top: number;
  right: number;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";

    case "inactive":
      return "bg-gray-100 text-gray-700";

    case "draft":
      return "bg-yellow-100 text-yellow-700";

    case "suspended":
      return "bg-red-100 text-red-700";

    case "out_of_stock":
      return "bg-orange-100 text-orange-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function ProductActions({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] =
    useState<MenuPosition | null>(null);

  const buttonRef =
    useRef<HTMLButtonElement>(null);

  const menuRef =
    useRef<HTMLDivElement>(null);

  function updatePosition() {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect =
      button.getBoundingClientRect();

    setPosition({
      top: rect.bottom + 8,
      right:
        window.innerWidth - rect.right,
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    function handleResize() {
      updatePosition();
    }

    function handleScroll() {
      updatePosition();
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      const clickedButton =
        buttonRef.current?.contains(target);

      const clickedMenu =
        menuRef.current?.contains(target);

      if (!clickedButton && !clickedMenu) {
        setOpen(false);
      }
    }

    window.addEventListener(
      "resize",
      handleResize,
    );

    window.addEventListener(
      "scroll",
      handleScroll,
      true,
    );

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );

      window.removeEventListener(
        "scroll",
        handleScroll,
        true,
      );

      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, [open]);

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }

    updatePosition();
    setOpen(true);
  }

  function handleEdit() {
    setOpen(false);
    onEdit(product);
  }

  function handleDelete() {
    setOpen(false);

    const confirmed = window.confirm(
      `Delete "${product.name}"?\n\nThis action cannot be undone.`,
    );

    if (confirmed) {
      onDelete(product);
    }
  }

  const menu =
    open &&
    position &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: position.top,
              right: position.right,
            }}
            className="z-[99999] w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-2xl"
          >
            <button
              type="button"
              onClick={handleEdit}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100"
            >
              ✏️ Edit
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              🗑 Delete
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
        aria-label={`Actions for ${product.name}`}
      >
        ⋮
      </button>

      {menu}
    </>
  );
}

export function ProductTable({
  products,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[320px]">
              Product
            </TableHead>

            <TableHead>
              Category
            </TableHead>

            <TableHead>
              Price
            </TableHead>

            <TableHead>
              Stock
            </TableHead>

            <TableHead>
              Condition
            </TableHead>

            <TableHead>
              Status
            </TableHead>

            <TableHead className="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-12 text-center text-sm text-gray-500"
              >
                No products found.
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow
                key={product.id}
                className="transition-colors hover:bg-gray-50"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-gray-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          No img
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {product.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {product.slug}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {product.category?.name ?? "-"}
                </TableCell>

                <TableCell>
                  <div className="font-medium">
                    {formatPrice(product.price)}
                  </div>

                  {product.discount_price !== null && (
                    <div className="text-xs text-green-600">
                      Sale:{" "}
                      {formatPrice(
                        product.discount_price,
                      )}
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <span
                    className={
                      product.stock === 0
                        ? "font-semibold text-red-600"
                        : product.stock <= 5
                          ? "font-semibold text-orange-600"
                          : "text-gray-700"
                    }
                  >
                    {product.stock}
                  </span>
                </TableCell>

                <TableCell className="capitalize">
                  {product.condition.replace(
                    "_",
                    " ",
                  )}
                </TableCell>

                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                      product.status,
                    )}`}
                  >
                    {product.status.replace(
                      "_",
                      " ",
                    )}
                  </span>
                </TableCell>

                <TableCell className="text-right">
                  <ProductActions
                    product={product}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}