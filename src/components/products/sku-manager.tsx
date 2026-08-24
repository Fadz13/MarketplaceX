"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  deleteProductSku,
  generateProductSkus,
  getProductSkus,
  updateProductSku,
} from "@/lib/actions/sku";

type ProductSku = {
  id: string;
  product_id: string;
  sku_code: string | null;
  variant_value_ids: string[];
  price: number;
  discount_price: number | null;
  stock: number;
  weight: number | null;
  image_url: string | null;
  is_active: boolean;
  variant_summary: string;
};

type SkuDraft = {
  sku_code: string;
  price: string;
  discount_price: string;
  stock: string;
  is_active: boolean;
};

type Props = {
  productId: string;
  refreshKey?: number;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function SkuManager({
  productId,
  refreshKey,
}: Props) {
  const [skus, setSkus] =
    useState<ProductSku[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [pending, startTransition] =
    useTransition();

  const [drafts, setDrafts] = useState<
    Record<string, SkuDraft>
  >({});

  async function loadSkus() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getProductSkus(productId);

      setSkus(data);

      const nextDrafts: Record<
        string,
        SkuDraft
      > = {};

      for (const sku of data) {
        nextDrafts[sku.id] = {
          sku_code: sku.sku_code ?? "",
          price: String(sku.price),
          discount_price:
            sku.discount_price === null
              ? ""
              : String(
                  sku.discount_price,
                ),
          stock: String(sku.stock),
          is_active: sku.is_active,
        };
      }

      setDrafts(nextDrafts);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load SKUs.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSkus();
  }, [productId, refreshKey]);

  function updateDraft(
    skuId: string,
    field:
      | "sku_code"
      | "price"
      | "discount_price"
      | "stock"
      | "is_active",
    value: string | boolean,
  ) {
    setDrafts((current) => {
      const existing: SkuDraft =
        current[skuId] ?? {
          sku_code: "",
          price: "",
          discount_price: "",
          stock: "0",
          is_active: true,
        };

      const updated: SkuDraft = {
        sku_code: existing.sku_code,
        price: existing.price,
        discount_price:
          existing.discount_price,
        stock: existing.stock,
        is_active: existing.is_active,
      };

      switch (field) {
        case "sku_code":
          updated.sku_code = String(value);
          break;

        case "price":
          updated.price = String(value);
          break;

        case "discount_price":
          updated.discount_price =
            String(value);
          break;

        case "stock":
          updated.stock = String(value);
          break;

        case "is_active":
          updated.is_active =
            Boolean(value);
          break;
      }

      return {
        ...current,
        [skuId]: updated,
      };
    });
  }

  function handleGenerate() {
    setError("");

    startTransition(async () => {
      try {
        await generateProductSkus(
          productId,
        );

        await loadSkus();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to generate SKUs.",
        );
      }
    });
  }

  function handleSave(
    sku: ProductSku,
  ) {
    const draft = drafts[sku.id];

    if (!draft) {
      return;
    }

    const formData = new FormData();

    formData.set(
      "sku_code",
      draft.sku_code,
    );

    formData.set(
      "price",
      draft.price,
    );

    formData.set(
      "discount_price",
      draft.discount_price,
    );

    formData.set(
      "stock",
      draft.stock,
    );

    if (draft.is_active) {
      formData.set(
        "is_active",
        "on",
      );
    }

    setError("");

    startTransition(async () => {
      try {
        await updateProductSku(
          sku.id,
          formData,
        );

        await loadSkus();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to update SKU.",
        );
      }
    });
  }

  function handleDelete(
    sku: ProductSku,
  ) {
    const confirmed =
      window.confirm(
        `Delete SKU "${sku.sku_code ?? sku.id}"?`,
      );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        await deleteProductSku(
          sku.id,
        );

        await loadSkus();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to delete SKU.",
        );
      }
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
        Loading SKUs...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border bg-gray-50 p-4">
        <div>
          <h4 className="text-sm font-semibold">
            Product SKUs
          </h4>

          <p className="mt-1 text-xs text-gray-500">
            Generate combinations from the
            variant values above.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending
            ? "Processing..."
            : "Generate SKUs"}
        </button>
      </div>

      {skus.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
          No SKUs generated yet.
        </div>
      ) : (
        <div className="space-y-3">
          {skus.map((sku) => {
            const draft = drafts[sku.id];

            if (!draft) {
              return null;
            }

            return (
              <div
                key={sku.id}
                className="rounded-xl border bg-white p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {sku.variant_summary ||
                        "No variant values"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      SKU:{" "}
                      {sku.sku_code ??
                        "No SKU code"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(sku)
                    }
                    disabled={pending}
                    className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>

                <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  Current price:{" "}
                  {formatPrice(
                    Number(draft.price),
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      SKU Code
                    </label>

                    <input
                      value={draft.sku_code}
                      onChange={(event) =>
                        updateDraft(
                          sku.id,
                          "sku_code",
                          event.target.value,
                        )
                      }
                      disabled={pending}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Stock
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={draft.stock}
                      onChange={(event) =>
                        updateDraft(
                          sku.id,
                          "stock",
                          event.target.value,
                        )
                      }
                      disabled={pending}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Price
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={draft.price}
                      onChange={(event) =>
                        updateDraft(
                          sku.id,
                          "price",
                          event.target.value,
                        )
                      }
                      disabled={pending}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Discount Price
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={
                        draft.discount_price
                      }
                      onChange={(event) =>
                        updateDraft(
                          sku.id,
                          "discount_price",
                          event.target.value,
                        )
                      }
                      disabled={pending}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        draft.is_active
                      }
                      onChange={(event) =>
                        updateDraft(
                          sku.id,
                          "is_active",
                          event.target.checked,
                        )
                      }
                      disabled={pending}
                    />

                    Active
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      handleSave(sku)
                    }
                    disabled={pending}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Save SKU
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}