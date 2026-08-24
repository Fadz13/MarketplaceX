"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ProductCondition =
  | "new"
  | "used"
  | "refurbished";

type ProductStatus =
  | "active"
  | "inactive"
  | "draft"
  | "suspended"
  | "out_of_stock";

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

async function getUniqueProductSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
) {
  const baseSlug = makeSlug(name);

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const { data, error } =
      await supabase
        .from("products")
        .select("id")
        .eq("slug", slug)
        .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function validateBrand(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string | null,
) {
  if (!brandId) {
    return;
  }

  const {
    data: brand,
    error,
  } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!brand) {
    throw new Error(
      "Selected brand was not found or is inactive.",
    );
  }
}

async function getCurrentSellerStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: {
      user: authUser,
    },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error(
      "You must be logged in to create a product.",
    );
  }

  const {
    data: seller,
    error: sellerError,
  } = await supabase
    .from("users")
    .select(`
      id,
      role,
      status
    `)
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (sellerError) {
    throw new Error(
      sellerError.message,
    );
  }

  if (!seller) {
    throw new Error(
      "Seller account not found.",
    );
  }

  if (seller.role !== "seller") {
    throw new Error(
      "Only sellers can create products.",
    );
  }

  if (seller.status !== "active") {
    throw new Error(
      "Seller account is not active.",
    );
  }

  const {
    data: store,
    error: storeError,
  } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", seller.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (storeError) {
    throw new Error(
      storeError.message,
    );
  }

  if (!store) {
    throw new Error(
      "No active store found for this seller.",
    );
  }

  return store;
}

export async function createProduct(
  formData: FormData,
) {
  const supabase =
    await createClient();

  const name = String(
    formData.get("name") ?? "",
  ).trim();

  const description = String(
    formData.get("description") ?? "",
  ).trim();

  const categoryId =
    String(
      formData.get("category_id") ?? "",
    ) || null;

  const brandId =
    String(
      formData.get("brand_id") ?? "",
    ) || null;

  const price = Number(
    formData.get("price") ?? 0,
  );

  const discountPriceRaw =
    String(
      formData.get("discount_price") ??
        "",
    ).trim();

  const discountPrice =
    discountPriceRaw === ""
      ? null
      : Number(discountPriceRaw);

  const stock = Number(
    formData.get("stock") ?? 0,
  );

  const condition =
    String(
      formData.get("condition") ?? "new",
    ) as ProductCondition;

  const status =
    String(
      formData.get("status") ?? "draft",
    ) as ProductStatus;

  if (!name) {
    throw new Error(
      "Product name is required.",
    );
  }

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error(
      "Price must be greater than 0.",
    );
  }

  if (
    discountPrice !== null &&
    (!Number.isFinite(
      discountPrice,
    ) ||
      discountPrice <= 0 ||
      discountPrice >= price)
  ) {
    throw new Error(
      "Discount price must be lower than the normal price.",
    );
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    throw new Error(
      "Stock must be a whole number and cannot be negative.",
    );
  }

  if (categoryId) {
    const {
      data: category,
      error: categoryError,
    } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();

    if (categoryError) {
      throw new Error(
        categoryError.message,
      );
    }

    if (!category) {
      throw new Error(
        "Selected category was not found.",
      );
    }
  }

  await validateBrand(
    supabase,
    brandId,
  );

  const store =
    await getCurrentSellerStore(
      supabase,
    );

  const slug =
    await getUniqueProductSlug(
      supabase,
      name,
    );

  const { error } =
    await supabase
      .from("products")
      .insert({
        store_id: store.id,
        category_id: categoryId,
        brand_id: brandId,
        name,
        slug,
        description:
          description || null,
        condition,
        price,
        discount_price:
          discountPrice,
        stock,
        weight: null,
        length: null,
        width: null,
        height: null,
        has_variants: false,
        status,
        rating: 0,
        review_count: 0,
        sold_count: 0,
        view_count: 0,
        meta_title: null,
        meta_description: null,
        tags: null,
      });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(
    "/dashboard/products",
  );
}

export async function updateProduct(
  id: string,
  formData: FormData,
) {
  const supabase =
    await createClient();

  const name = String(
    formData.get("name") ?? "",
  ).trim();

  const description = String(
    formData.get("description") ?? "",
  ).trim();

  const categoryId =
    String(
      formData.get("category_id") ?? "",
    ) || null;

  const brandId =
    String(
      formData.get("brand_id") ?? "",
    ) || null;

  const price = Number(
    formData.get("price") ?? 0,
  );

  const discountPriceRaw =
    String(
      formData.get("discount_price") ??
        "",
    ).trim();

  const discountPrice =
    discountPriceRaw === ""
      ? null
      : Number(discountPriceRaw);

  const stock = Number(
    formData.get("stock") ?? 0,
  );

  const condition =
    String(
      formData.get("condition") ?? "new",
    ) as ProductCondition;

  const status =
    String(
      formData.get("status") ?? "draft",
    ) as ProductStatus;

  if (!name) {
    throw new Error(
      "Product name is required.",
    );
  }

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error(
      "Price must be greater than 0.",
    );
  }

  if (
    discountPrice !== null &&
    (!Number.isFinite(
      discountPrice,
    ) ||
      discountPrice <= 0 ||
      discountPrice >= price)
  ) {
    throw new Error(
      "Discount price must be lower than the normal price.",
    );
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    throw new Error(
      "Stock must be a whole number and cannot be negative.",
    );
  }

  if (categoryId) {
    const {
      data: category,
      error: categoryError,
    } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();

    if (categoryError) {
      throw new Error(
        categoryError.message,
      );
    }

    if (!category) {
      throw new Error(
        "Selected category was not found.",
      );
    }
  }

  await validateBrand(
    supabase,
    brandId,
  );

  const slug =
    makeSlug(name);

  const {
    data: existingSlug,
    error: slugError,
  } = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .limit(1);

  if (slugError) {
    throw new Error(
      slugError.message,
    );
  }

  let finalSlug = slug;

  if (
    existingSlug &&
    existingSlug.length > 0
  ) {
    finalSlug =
      await getUniqueProductSlug(
        supabase,
        name,
      );
  }

  const {
    error,
  } = await supabase
    .from("products")
    .update({
      name,
      slug: finalSlug,
      description:
        description || null,
      category_id: categoryId,
      brand_id: brandId,
      price,
      discount_price:
        discountPrice,
      stock,
      condition,
      status,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(
    "/dashboard/products",
  );
}

export async function deleteProduct(
  id: string,
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Product tidak ditemukan atau tidak bisa dihapus.",
    );
  }

  revalidatePath(
    "/dashboard/products",
  );
}

export async function uploadProductImage(
  productId: string,
  formData: FormData,
) {
  const supabase =
    await createClient();

  const file =
    formData.get("file");

  if (!(file instanceof File)) {
    throw new Error(
      "Image file is required.",
    );
  }

  if (file.size === 0) {
    throw new Error(
      "Image file is empty.",
    );
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (
    !allowedTypes.includes(
      file.type,
    )
  ) {
    throw new Error(
      "Only JPG, PNG, WEBP, and GIF images are allowed.",
    );
  }

  const maxSize =
    6 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      "Image size cannot exceed 6 MB.",
    );
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() ||
    "jpg";

  const fileName =
    `${crypto.randomUUID()}.${extension}`;

  const filePath =
    `${productId}/${fileName}`;

  const arrayBuffer =
    await file.arrayBuffer();

  const {
    error: uploadError,
  } = await supabase.storage
    .from("product-images")
    .upload(
      filePath,
      arrayBuffer,
      {
        contentType: file.type,
        upsert: false,
      },
    );

  if (uploadError) {
    throw new Error(
      uploadError.message,
    );
  }

  const {
    data: publicUrlData,
  } = supabase.storage
    .from("product-images")
    .getPublicUrl(
      filePath,
    );

  const {
    data: existingImages,
    error: existingError,
  } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .limit(1);

  if (existingError) {
    await supabase.storage
      .from("product-images")
      .remove([filePath]);

    throw new Error(
      existingError.message,
    );
  }

  const isPrimary =
    !existingImages ||
    existingImages.length ===
      0;

  const {
    error: insertError,
  } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      image_url:
        publicUrlData.publicUrl,
      alt_text: null,
      sort_order: 0,
      is_primary: isPrimary,
    });

  if (insertError) {
    await supabase.storage
      .from("product-images")
      .remove([filePath]);

    throw new Error(
      insertError.message,
    );
  }

  revalidatePath(
    "/dashboard/products",
  );
}

export async function deleteProductImage(
  imageId: string,
) {
  const supabase =
    await createClient();

  const {
    data: image,
    error: imageError,
  } = await supabase
    .from("product_images")
    .select(
      "id, product_id, image_url, is_primary",
    )
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) {
    throw new Error(
      imageError.message,
    );
  }

  if (!image) {
    throw new Error(
      "Product image not found.",
    );
  }

  const marker =
    "/storage/v1/object/public/product-images/";

  const index =
    image.image_url.indexOf(
      marker,
    );

  if (index !== -1) {
    const filePath =
      image.image_url.slice(
        index + marker.length,
      );

    await supabase.storage
      .from("product-images")
      .remove([filePath]);
  }

  const {
    error: deleteError,
  } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);

  if (deleteError) {
    throw new Error(
      deleteError.message,
    );
  }

  if (image.is_primary) {
    const {
      data: remainingImages,
      error: remainingError,
    } = await supabase
      .from("product_images")
      .select("id")
      .eq(
        "product_id",
        image.product_id,
      )
      .order(
        "sort_order",
        {
          ascending: true,
        },
      )
      .limit(1);

    if (remainingError) {
      throw new Error(
        remainingError.message,
      );
    }

    const nextImage =
      remainingImages?.[0];

    if (nextImage) {
      const {
        error: primaryError,
      } = await supabase
        .from("product_images")
        .update({
          is_primary: true,
        })
        .eq(
          "id",
          nextImage.id,
        );

      if (primaryError) {
        throw new Error(
          primaryError.message,
        );
      }
    }
  }

  revalidatePath(
    "/dashboard/products",
  );
}

export async function getProductImages(
  productId: string,
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("product_images")
    .select(`
      id,
      image_url,
      is_primary,
      sort_order
    `)
    .eq(
      "product_id",
      productId,
    )
    .order(
      "sort_order",
      {
        ascending: true,
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data ?? [];
}

export async function setPrimaryProductImage(
  imageId: string,
) {
  const supabase =
    await createClient();

  const {
    data: image,
    error: imageError,
  } = await supabase
    .from("product_images")
    .select(
      "id, product_id",
    )
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) {
    throw new Error(
      imageError.message,
    );
  }

  if (!image) {
    throw new Error(
      "Product image not found.",
    );
  }

  const {
    error: resetError,
  } = await supabase
    .from("product_images")
    .update({
      is_primary: false,
    })
    .eq(
      "product_id",
      image.product_id,
    );

  if (resetError) {
    throw new Error(
      resetError.message,
    );
  }

  const {
    error: primaryError,
  } = await supabase
    .from("product_images")
    .update({
      is_primary: true,
    })
    .eq("id", imageId);

  if (primaryError) {
    throw new Error(
      primaryError.message,
    );
  }

  revalidatePath(
    "/dashboard/products",
  );
}