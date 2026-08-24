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

export type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
};

function BrandActions({
  brand,
  onEdit,
  onDelete,
}: {
  brand: Brand;
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const button = buttonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();

    setPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleResize() {
      updatePosition();
    }

    window.addEventListener("resize", handleResize);
    document.addEventListener(
      "mousedown",
      handleOutside,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );
      document.removeEventListener(
        "mousedown",
        handleOutside,
      );
    };
  }, [open]);

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
            className="z-[99999] w-40 rounded-xl border bg-white p-1 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit(brand);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100"
            >
              ✏️ Edit
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);

                const confirmed = window.confirm(
                  `Delete brand "${brand.name}"?`,
                );

                if (confirmed) {
                  onDelete(brand);
                }
              }}
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
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            updatePosition();
            setOpen(true);
          }
        }}
        className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
      >
        ⋮
      </button>

      {menu}
    </>
  );
}

export function BrandTable({
  brands,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Brand</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {brands.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-12 text-center text-sm text-gray-500"
              >
                No brands found.
              </TableCell>
            </TableRow>
          ) : (
            brands.map((brand) => (
              <TableRow
                key={brand.id}
                className="hover:bg-gray-50"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 overflow-hidden rounded-lg border bg-gray-100">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          No logo
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {brand.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {brand.slug}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {brand.website ? (
                    <span className="text-sm">
                      {brand.website}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>

                <TableCell>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      brand.is_verified
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {brand.is_verified
                      ? "Verified"
                      : "Unverified"}
                  </span>
                </TableCell>

                <TableCell>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      brand.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {brand.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </TableCell>

                <TableCell>
                  {new Date(
                    brand.created_at,
                  ).toLocaleDateString("id-ID")}
                </TableCell>

                <TableCell className="text-right">
                  <BrandActions
                    brand={brand}
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