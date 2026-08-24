"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  getProductImages,
  updateProduct,
} from "@/lib/actions/product";

import {
  getVariantOptions,
} from "@/lib/actions/variant";

import { ProductImages } from "./product-images";
import { VariantManager } from "./variant-manager";
import { SkuManager } from "./sku-manager";
type Category = {
  id: string;
  name: string;
};

type Brand = {
  id: string;
  name: string;
};

type VariantValue = {
  id: string;
  value: string;
  display_value: string | null;
  color_hex: string | null;
  image_url: string | null;
  sort_order: number;
};

type VariantOption = {
  id: string;
  name: string;
  sort_order: number;
  values: VariantValue[];
};

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  price: number;
  discount_price: number | null;
  stock: number;
  condition: string;
  status: string;
};

type ProductImage = {
  id: string;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
};

type Props = {
  open: boolean;
  product: Product | null;
  categories: Category[];
  brands: Brand[];
  onClose: () => void;
};

export function EditProductModal({
  open,
  product,
  categories,
  brands,
  onClose,
}: Props) {
  const [pending, startTransition] =
    useTransition();

  const [error, setError] = useState("");

  const [images, setImages] =
    useState<ProductImage[]>([]);

  const [loadingImages, setLoadingImages] =
    useState(false);

  const [variantOptions, setVariantOptions] =
    useState<VariantOption[]>([]);

  const [
    loadingVariants,
    setLoadingVariants,
  ] = useState(false);

  useEffect(() => {
    if (!open || !product) {
      setImages([]);
      setVariantOptions([]);
      setLoadingImages(false);
      setLoadingVariants(false);
      return;
    }

    const productId = product.id;

    let cancelled = false;

    async function loadProductData() {
      setLoadingImages(true);
      setLoadingVariants(true);
      setError("");

      try {
        const [
          productImages,
          productVariants,
        ] = await Promise.all([
          getProductImages(productId),
          getVariantOptions(productId),
        ]);

        if (!cancelled) {
          setImages(productImages);
          setVariantOptions(
            productVariants,
          );
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load product data.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingImages(false);
          setLoadingVariants(false);
        }
      }
    }

    loadProductData();

    return () => {
      cancelled = true;
    };
  }, [open, product?.id]);

  if (!open || !product) {
    return null;
  }

  const productId = product.id;

  function handleSubmit(
    formData: FormData,
  ) {
    setError("");

    startTransition(async () => {
      try {
        await updateProduct(
          productId,
          formData,
        );

        onClose();
        window.location.reload();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to update product.",
        );
      }
    });
  }

  async function handleImagesChange() {
    try {
      const updatedImages =
        await getProductImages(productId);

      setImages(updatedImages);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to refresh product images.",
      );
    }
  }

  async function handleVariantsChange() {
    try {
      setLoadingVariants(true);

      const updatedVariants =
        await getVariantOptions(productId);

      setVariantOptions(
        updatedVariants,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to refresh variants.",
      );
    } finally {
      setLoadingVariants(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="max-h-[90vh] overflow-y-auto p-5">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Edit Product
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Update product information.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            action={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Product Name
              </label>

              <input
                name="name"
                required
                defaultValue={product.name}
                disabled={pending}
                className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Category
                </label>

                <select
                  name="category_id"
                  defaultValue={
                    product.category_id ?? ""
                  }
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
                >
                  <option value="">
                    No category
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Brand
                </label>

                <select
                  name="brand_id"
                  defaultValue={
                    product.brand_id ?? ""
                  }
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
                >
                  <option value="">
                    No brand
                  </option>

                  {brands.map((brand) => (
                    <option
                      key={brand.id}
                      value={brand.id}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Price
                </label>

                <input
                  name="price"
                  type="number"
                  min="1"
                  required
                  defaultValue={product.price}
                  disabled={pending}
                  className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Discount Price
                </label>

                <input
                  name="discount_price"
                  type="number"
                  min="0"
                  defaultValue={
                    product.discount_price ?? ""
                  }
                  disabled={pending}
                  className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Stock
                </label>

                <input
                  name="stock"
                  type="number"
                  min="0"
                  defaultValue={product.stock}
                  disabled={pending}
                  className="w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Condition
                </label>

                <select
                  name="condition"
                  defaultValue={product.condition}
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm"
                >
                  <option value="new">
                    New
                  </option>

                  <option value="used">
                    Used
                  </option>

                  <option value="refurbished">
                    Refurbished
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Status
                </label>

                <select
                  name="status"
                  defaultValue={product.status}
                  disabled={pending}
                  className="w-full rounded-lg border bg-white px-3.5 py-2 text-sm"
                >
                  <option value="draft">
                    Draft
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>

                  <option value="suspended">
                    Suspended
                  </option>

                  <option value="out_of_stock">
                    Out of stock
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>

              <textarea
                name="description"
                rows={3}
                disabled={pending}
                className="w-full resize-none rounded-lg border px-3.5 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100"
              />
            </div>

            <div className="border-t pt-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">
                  Product Images
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Upload images for this product.
                </p>
              </div>

              {loadingImages ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
                  Loading images...
                </div>
              ) : (
                <ProductImages
                  productId={productId}
                  images={images}
                  onImagesChange={
                    handleImagesChange
                  }
                />
              )}
            </div>

            <div className="border-t pt-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">
                  Product Variants
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Add options such as Color,
                  Size, or Storage.
                </p>
              </div>

              {loadingVariants ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
                  Loading variants...
                </div>
              ) : (
                <VariantManager
                  productId={productId}
                  options={variantOptions}
                  onChange={
                    handleVariantsChange
                  }
                />
              )}
              <div className="border-t pt-4">
  <div className="mb-3">
    <h3 className="text-sm font-semibold">
      Product SKUs
    </h3>

    <p className="mt-1 text-xs text-gray-500">
      Generate and manage SKU combinations.
    </p>
  </div>

  <SkuManager
    productId={productId}
  />
</div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>

              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {pending
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}