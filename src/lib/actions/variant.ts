"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getVariantOptions(
  productId: string,
) {
  const supabase = await createClient();

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
    .eq("product_id", productId)
    .order("sort_order", {
      ascending: true,
    });

  if (optionsError) {
    throw new Error(optionsError.message);
  }

  const optionIds =
    options?.map((option) => option.id) ?? [];

  if (optionIds.length === 0) {
    return [];
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
      display_value,
      color_hex,
      image_url,
      sort_order
    `)
    .in("variant_option_id", optionIds)
    .order("sort_order", {
      ascending: true,
    });

  if (valuesError) {
    throw new Error(valuesError.message);
  }

  return (options ?? []).map((option) => ({
    ...option,
    values:
      (values ?? []).filter(
        (value) =>
          value.variant_option_id ===
          option.id,
      ),
  }));
}

export async function createVariantOption(
  productId: string,
  name: string,
) {
  const supabase = await createClient();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error(
      "Variant option name is required.",
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("variant_options")
    .select("id")
    .eq("product_id", productId)
    .ilike("name", cleanName)
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing && existing.length > 0) {
    throw new Error(
      "Variant option already exists.",
    );
  }

  const {
    data: lastOption,
    error: lastOptionError,
  } = await supabase
    .from("variant_options")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (lastOptionError) {
    throw new Error(
      lastOptionError.message,
    );
  }

  const sortOrder =
    (lastOption?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("variant_options")
    .insert({
      product_id: productId,
      name: cleanName,
      sort_order: sortOrder,
    });

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("products")
    .update({
      has_variants: true,
    })
    .eq("id", productId);

  revalidatePath("/dashboard/products");
}

export async function createVariantValue(
  optionId: string,
  value: string,
) {
  const supabase = await createClient();

  const cleanValue = value.trim();

  if (!cleanValue) {
    throw new Error(
      "Variant value is required.",
    );
  }

  const {
    data: option,
    error: optionError,
  } = await supabase
    .from("variant_options")
    .select("id, product_id")
    .eq("id", optionId)
    .maybeSingle();

  if (optionError) {
    throw new Error(optionError.message);
  }

  if (!option) {
    throw new Error(
      "Variant option not found.",
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("variant_values")
    .select("id")
    .eq("variant_option_id", optionId)
    .ilike("value", cleanValue)
    .limit(1);

  if (existingError) {
    throw new Error(
      existingError.message,
    );
  }

  if (existing && existing.length > 0) {
    throw new Error(
      "Variant value already exists.",
    );
  }

  const {
    data: lastValue,
    error: lastValueError,
  } = await supabase
    .from("variant_values")
    .select("sort_order")
    .eq("variant_option_id", optionId)
    .order("sort_order", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (lastValueError) {
    throw new Error(
      lastValueError.message,
    );
  }

  const sortOrder =
    (lastValue?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("variant_values")
    .insert({
      variant_option_id: optionId,
      value: cleanValue,
      display_value: cleanValue,
      color_hex: null,
      image_url: null,
      sort_order: sortOrder,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/products");
}

export async function deleteVariantOption(
  optionId: string,
) {
  const supabase = await createClient();

  const {
    data: option,
    error: optionError,
  } = await supabase
    .from("variant_options")
    .select("id, product_id")
    .eq("id", optionId)
    .maybeSingle();

  if (optionError) {
    throw new Error(optionError.message);
  }

  if (!option) {
    throw new Error(
      "Variant option not found.",
    );
  }

  const { error } = await supabase
    .from("variant_options")
    .delete()
    .eq("id", optionId);

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: remainingOptions,
  } = await supabase
    .from("variant_options")
    .select("id")
    .eq("product_id", option.product_id)
    .limit(1);

  if (
    !remainingOptions ||
    remainingOptions.length === 0
  ) {
    await supabase
      .from("products")
      .update({
        has_variants: false,
      })
      .eq("id", option.product_id);
  }

  revalidatePath("/dashboard/products");
}

export async function deleteVariantValue(
  valueId: string,
) {
  const supabase = await createClient();

  const {
    data: value,
    error: valueError,
  } = await supabase
    .from("variant_values")
    .select("id")
    .eq("id", valueId)
    .maybeSingle();

  if (valueError) {
    throw new Error(valueError.message);
  }

  if (!value) {
    throw new Error(
      "Variant value not found.",
    );
  }

  const { error } = await supabase
    .from("variant_values")
    .delete()
    .eq("id", valueId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/products");
}