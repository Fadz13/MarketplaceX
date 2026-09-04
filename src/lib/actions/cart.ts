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

export type CartItem = {
  id: string;
  product_id: string;
  product_sku_id: string | null;
  quantity: number;
  unit_price: number;
  product_name: string;
  product_price: number;
  product_discount_price: number | null;
  product_stock: number;
  product_image_url: string | null;
  product_has_variants: boolean;
  store_name: string | null;
};

export async function getCart(): Promise<{
  items: CartItem[];
  total: number;
}> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { items: [], total: 0 };
  }

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!user) {
    return { items: [], total: 0 };
  }

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cart) {
    return { items: [], total: 0 };
  }

  const { data: items, error } = await supabase
    .from("cart_items")
    .select(`
      id,
      product_id,
      product_sku_id,
      quantity,
      unit_price,
      products (
        name,
        price,
        discount_price,
        stock,
        has_variants
      )
    `)
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const productIds = items
    .map((item) => item.product_id)
    .filter(Boolean);

  const { data: images } = await supabase
    .from("product_images")
    .select("product_id, image_url")
    .eq("is_primary", true)
    .in("product_id", productIds);

  const imageUrlMap = new Map(
    (images ?? []).map((img) => [
      img.product_id,
      img.image_url,
    ]),
  );

  const { data: productStores } = await supabase
    .from("products")
    .select("id, store_id")
    .in("id", productIds);

  const storeIdSet = new Set(
    (productStores ?? [])
      .map((ps) => ps.store_id)
      .filter(Boolean),
  );

  const { data: storeNames } = await supabase
    .from("stores")
    .select("id, store_name")
    .in("id", Array.from(storeIdSet));

  const storeNameMap = new Map(
    (storeNames ?? []).map((s) => [s.id, s.store_name]),
  );

  const productStoreMap = new Map(
    (productStores ?? []).map((ps) => [
      ps.id,
      ps.store_id,
    ]),
  );

  const cartItems: CartItem[] = (items ?? []).map(
    (item) => {
      const product = item.products as unknown as {
        name: string;
        price: number;
        discount_price: number | null;
        stock: number;
        has_variants: boolean;
      } | null;

      const storeId = productStoreMap.get(
        item.product_id,
      );

      return {
        id: item.id,
        product_id: item.product_id,
        product_sku_id: item.product_sku_id,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        product_name:
          product?.name ?? "Unknown Product",
        product_price: Number(product?.price ?? 0),
        product_discount_price:
          product?.discount_price != null
            ? Number(product.discount_price)
            : null,
        product_stock: product?.stock ?? 0,
        product_image_url:
          imageUrlMap.get(item.product_id) ?? null,
        product_has_variants:
          product?.has_variants ?? false,
        store_name:
          (storeId
            ? storeNameMap.get(storeId)
            : null) ?? null,
      };
    },
  );

  const total = cartItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  return { items: cartItems, total };
}

export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number,
) {
  const supabase = await createClient();

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Quantity must be greater than 0.",
    );
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("Please login first.");
  }

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!user) {
    throw new Error("User account not found.");
  }

  const { data: cartItem, error: itemError } =
    await supabase
      .from("cart_items")
      .select(`
        id,
        cart_id,
        product_id,
        quantity
      `)
      .eq("id", cartItemId)
      .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }

  if (!cartItem) {
    throw new Error("Cart item not found.");
  }

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("id", cartItem.cart_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cart) {
    throw new Error("Cart not found.");
  }

  const { data: product } = await supabase
    .from("products")
    .select("stock")
    .eq("id", cartItem.product_id)
    .maybeSingle();

  if (!product) {
    throw new Error("Product not found.");
  }

  if (quantity > (product.stock ?? 0)) {
    throw new Error(
      `Only ${product.stock ?? 0} item(s) available.`,
    );
  }

  const { error: updateError } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", cartItemId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/cart");
}

export async function removeCartItem(
  cartItemId: string,
) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("Please login first.");
  }

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!user) {
    throw new Error("User account not found.");
  }

  const { data: cartItem, error: itemError } =
    await supabase
      .from("cart_items")
      .select("id, cart_id")
      .eq("id", cartItemId)
      .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }

  if (!cartItem) {
    throw new Error("Cart item not found.");
  }

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("id", cartItem.cart_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cart) {
    throw new Error("Cart not found.");
  }

  const { error: deleteError } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", cartItemId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/cart");
}