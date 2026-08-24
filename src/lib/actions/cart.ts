"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addToCart(
  productId: string,
  quantity = 1,
) {
  const supabase =
    await createClient();

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Quantity must be greater than 0.",
    );
  }

  const {
    data: {
      user: authUser,
    },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error(
      "Please login first.",
    );
  }

  const {
    data: user,
    error: userError,
  } = await supabase
    .from("users")
    .select(`
      id,
      status
    `)
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError) {
    throw new Error(
      userError.message,
    );
  }

  if (!user) {
    throw new Error(
      "User account not found.",
    );
  }

  if (user.status !== "active") {
    throw new Error(
      "Your account is not active.",
    );
  }

  const {
    data: product,
    error: productError,
  } = await supabase
    .from("vw_active_products")
    .select(`
      id,
      price,
      discount_price,
      stock,
      has_variants
    `)
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    throw new Error(
      productError.message,
    );
  }

  if (!product) {
    throw new Error(
      "Product not found or inactive.",
    );
  }

  const productIdValue =
  product.id ?? productId;

  const stock =
    product.stock ?? 0;

  const price =
    Number(product.price ?? 0);

  const discountPrice =
    product.discount_price !== null
      ? Number(
          product.discount_price,
        )
      : null;

  const unitPrice =
    discountPrice ?? price;

  const hasVariants =
    product.has_variants ?? false;

  if (hasVariants) {
    throw new Error(
      "This product requires a SKU selection.",
    );
  }

  if (stock < quantity) {
    throw new Error(
      `Only ${stock} item(s) available.`,
    );
  }

  let {
    data: cart,
    error: cartError,
  } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cartError) {
    throw new Error(
      cartError.message,
    );
  }

  if (!cart) {
    const {
      data: newCart,
      error: createCartError,
    } = await supabase
      .from("carts")
      .insert({
        user_id: user.id,
      })
      .select("id")
      .single();

    if (createCartError) {
      throw new Error(
        createCartError.message,
      );
    }

    cart = newCart;
  }

  const {
    data: existingItem,
    error: itemError,
  } = await supabase
    .from("cart_items")
    .select(`
      id,
      quantity
    `)
    .eq("cart_id", cart.id)
    .eq(
      "product_id",
      productIdValue,
    )
    .is(
      "product_sku_id",
      null,
    )
    .maybeSingle();

  if (itemError) {
    throw new Error(
      itemError.message,
    );
  }

  const nextQuantity =
    (existingItem?.quantity ?? 0) +
    quantity;

  if (nextQuantity > stock) {
    throw new Error(
      `Only ${stock} item(s) available.`,
    );
  }

  if (existingItem) {
    const {
      error: updateError,
    } = await supabase
      .from("cart_items")
      .update({
        quantity: nextQuantity,
        unit_price: unitPrice,
      })
      .eq(
        "id",
        existingItem.id,
      );

    if (updateError) {
      throw new Error(
        updateError.message,
      );
    }
  } else {
    const {
      error: insertError,
    } = await supabase
      .from("cart_items")
      .insert({
        cart_id: cart.id,
        product_id:
          productIdValue,
        product_sku_id: null,
        quantity,
        unit_price: unitPrice,
      });

    if (insertError) {
      throw new Error(
        insertError.message,
      );
    }
  }

  revalidatePath("/");
  revalidatePath(
    `/products/${productIdValue}`,
  );
  revalidatePath("/cart");
}