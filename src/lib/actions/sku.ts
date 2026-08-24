"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type VariantValue = {
  id: string;
  variant_option_id: string;
  value: string;
  display_value: string | null;
};

type VariantOption = {
  id: string;
  name: string;
  sort_order: number;
  values: VariantValue[];
};

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

async function syncProductStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
) {
  const { data: product, error: productError } =
    await supabase
      .from("products")
      .select("id, has_variants")
      .eq("id", productId)
      .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    throw new Error("Product not found.");
  }

  // Kalau product tidak memakai variant,
  // jangan sentuh stock utama product.
  if (!product.has_variants) {
    return;
  }

  const {
    data: activeSkus,
    error: skuError,
  } = await supabase
    .from("product_skus")
    .select("stock")
    .eq("product_id", productId)
    .eq("is_active", true);

  if (skuError) {
    throw new Error(skuError.message);
  }

  const totalStock = (activeSkus ?? []).reduce(
    (total, sku) => total + Number(sku.stock ?? 0),
    0,
  );

  const { error: updateError } =
    await supabase
      .from("products")
      .update({
        stock: totalStock,
      })
      .eq("id", productId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function getProductSkus(
  productId: string,
) {
  const supabase = await createClient();

  const { data: skus, error: skuError } =
    await supabase
      .from("product_skus")
      .select(`
        id,
        product_id,
        sku_code,
        variant_value_ids,
        price,
        discount_price,
        stock,
        weight,
        image_url,
        is_active
      `)
      .eq("product_id", productId)
      .order("created_at", {
        ascending: true,
      });

  if (skuError) {
    throw new Error(skuError.message);
  }

  if (!skus || skus.length === 0) {
    return [] as ProductSku[];
  }

  const allValueIds = Array.from(
    new Set(
      skus.flatMap((sku) =>
        Array.isArray(sku.variant_value_ids)
          ? sku.variant_value_ids
          : [],
      ),
    ),
  );

  if (allValueIds.length === 0) {
    return skus.map((sku) => ({
      ...sku,
      variant_summary: "",
    })) as ProductSku[];
  }

  const {
    data: values,
    error: valuesError,
  } = await supabase
    .from("variant_values")
    .select(`
      id,
      variant_option_id,
      value,
      display_value
    `)
    .in("id", allValueIds);

  if (valuesError) {
    throw new Error(valuesError.message);
  }

  const optionIds = Array.from(
    new Set(
      (values ?? []).map(
        (value) =>
          value.variant_option_id,
      ),
    ),
  );

  let optionsMap = new Map<
    string,
    {
      name: string;
      sort_order: number;
    }
  >();

  if (optionIds.length > 0) {
    const {
      data: options,
      error: optionsError,
    } = await supabase
      .from("variant_options")
      .select(`
        id,
        name,
        sort_order
      `)
      .in("id", optionIds);

    if (optionsError) {
      throw new Error(
        optionsError.message,
      );
    }

    optionsMap = new Map(
      (options ?? []).map((option) => [
        option.id,
        {
          name: option.name,
          sort_order: option.sort_order,
        },
      ]),
    );
  }

  const valuesMap = new Map(
    (values ?? []).map((value) => [
      value.id,
      value,
    ]),
  );

  return skus.map((sku) => {
    const variantSummary = (
      Array.isArray(sku.variant_value_ids)
        ? sku.variant_value_ids
        : []
    )
      .map((id) => valuesMap.get(id))
      .filter(
        (
          value,
        ): value is VariantValue =>
          Boolean(value),
      )
      .sort((a, b) => {
        const aOption =
          optionsMap.get(
            a.variant_option_id,
          );

        const bOption =
          optionsMap.get(
            b.variant_option_id,
          );

        return (
          (aOption?.sort_order ?? 0) -
          (bOption?.sort_order ?? 0)
        );
      })
      .map(
        (value) =>
          value.display_value ??
          value.value,
      )
      .join(" / ");

    return {
      ...sku,
      variant_summary: variantSummary,
    };
  }) as ProductSku[];
}

function generateCombinations(
  options: VariantOption[],
): VariantValue[][] {
  if (options.length === 0) {
    return [];
  }

  let combinations: VariantValue[][] = [
    [],
  ];

  for (const option of options) {
    if (option.values.length === 0) {
      return [];
    }

    const next: VariantValue[][] = [];

    for (const combination of combinations) {
      for (const value of option.values) {
        next.push([
          ...combination,
          value,
        ]);
      }
    }

    combinations = next;
  }

  return combinations;
}

function buildSkuCode(
  productName: string,
  values: VariantValue[],
) {
  const productPrefix =
    productName
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 4) || "SKU";

  const valuePart = values
    .map((value) =>
      value.value
        .replace(/\s+/g, "-")
        .replace(
          /[^a-zA-Z0-9-]/g,
          "",
        )
        .toUpperCase(),
    )
    .join("-");

  return `${productPrefix}-${valuePart}`;
}

export async function generateProductSkus(
  productId: string,
) {
  const supabase = await createClient();

  const [
    { data: product, error: productError },
    { data: options, error: optionsError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, price, discount_price",
      )
      .eq("id", productId)
      .maybeSingle(),

    supabase
      .from("variant_options")
      .select(`
        id,
        name,
        sort_order
      `)
      .eq("product_id", productId)
      .order("sort_order", {
        ascending: true,
      }),
  ]);

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    throw new Error("Product not found.");
  }

  if (optionsError) {
    throw new Error(optionsError.message);
  }

  if (!options || options.length === 0) {
    throw new Error(
      "Create at least one variant option first.",
    );
  }

  const optionIds = options.map(
    (option) => option.id,
  );

  const {
    data: values,
    error: valuesError,
  } = await supabase
    .from("variant_values")
    .select(`
      id,
      variant_option_id,
      value,
      display_value
    `)
    .in(
      "variant_option_id",
      optionIds,
    )
    .order("sort_order", {
      ascending: true,
    });

  if (valuesError) {
    throw new Error(valuesError.message);
  }

  const optionsWithValues =
    options.map((option) => ({
      ...option,
      values: (values ?? []).filter(
        (value) =>
          value.variant_option_id ===
          option.id,
      ),
    }));

  const combinations =
    generateCombinations(
      optionsWithValues,
    );

  if (combinations.length === 0) {
    throw new Error(
      "Every variant option must have at least one value.",
    );
  }

  const {
    data: existingSkus,
    error: existingSkuError,
  } = await supabase
    .from("product_skus")
    .select(
      "variant_value_ids, sku_code",
    )
    .eq("product_id", productId);

  if (existingSkuError) {
    throw new Error(
      existingSkuError.message,
    );
  }

  const existingKeys = new Set(
    (existingSkus ?? []).map((sku) =>
      [...sku.variant_value_ids]
        .sort()
        .join(","),
    ),
  );

  const rows = combinations
    .filter((combination) => {
      const key = combination
        .map((value) => value.id)
        .sort()
        .join(",");

      return !existingKeys.has(key);
    })
    .map((combination) => ({
      product_id: productId,
      sku_code: buildSkuCode(
        product.name,
        combination,
      ),
      variant_value_ids:
        combination.map(
          (value) => value.id,
        ),
      price: product.price,
      discount_price:
        product.discount_price,
      stock: 0,
      weight: null,
      image_url: null,
      is_active: true,
    }));

  if (rows.length > 0) {
    const {
      error: insertError,
    } = await supabase
      .from("product_skus")
      .insert(rows);

    if (insertError) {
      throw new Error(
        insertError.message,
      );
    }
  }

  await syncProductStock(
    supabase,
    productId,
  );

  revalidatePath(
    "/dashboard/products",
  );
}

export async function updateProductSku(
  id: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const skuCode =
    String(
      formData.get("sku_code") ?? "",
    ).trim() || null;

  const price = Number(
    formData.get("price") ?? 0,
  );

  const discountRaw =
    String(
      formData.get("discount_price") ?? "",
    ).trim();

  const discountPrice =
    discountRaw === ""
      ? null
      : Number(discountRaw);

  const stock = Number(
    formData.get("stock") ?? 0,
  );

  const isActive =
    formData.get("is_active") === "on";

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(
      "Price must be greater than 0.",
    );
  }

  if (
    discountPrice !== null &&
    (!Number.isFinite(discountPrice) ||
      discountPrice <= 0 ||
      discountPrice >= price)
  ) {
    throw new Error(
      "Discount price must be lower than the normal price.",
    );
  }

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error(
      "Stock must be a whole number and cannot be negative.",
    );
  }

  const {
    data: sku,
    error: skuError,
  } = await supabase
    .from("product_skus")
    .select("id, product_id")
    .eq("id", id)
    .maybeSingle();

  if (skuError) {
    throw new Error(skuError.message);
  }

  if (!sku) {
    throw new Error(
      "Product SKU not found.",
    );
  }

  const { error } = await supabase
    .from("product_skus")
    .update({
      sku_code: skuCode,
      price,
      discount_price: discountPrice,
      stock,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await syncProductStock(
    supabase,
    sku.product_id,
  );

  revalidatePath(
    "/dashboard/products",
  );
}

export async function deleteProductSku(
  id: string,
) {
  const supabase = await createClient();

  const {
    data: sku,
    error: skuError,
  } = await supabase
    .from("product_skus")
    .select("id, product_id")
    .eq("id", id)
    .maybeSingle();

  if (skuError) {
    throw new Error(skuError.message);
  }

  if (!sku) {
    throw new Error(
      "Product SKU not found.",
    );
  }

  const { error } = await supabase
    .from("product_skus")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await syncProductStock(
    supabase,
    sku.product_id,
  );

  revalidatePath(
    "/dashboard/products",
  );
}