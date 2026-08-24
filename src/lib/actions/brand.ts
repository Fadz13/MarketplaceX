"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

async function getUniqueBrandSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  currentId?: string,
) {
  const baseSlug = makeSlug(name);

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const { data, error } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const existing = data?.[0];

    if (!existing || existing.id === currentId) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

export async function getBrands() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select(`
      id,
      name,
      slug,
      description,
      logo_url,
      website,
      is_verified,
      is_active,
      created_at,
      updated_at
    `)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createBrand(
  formData: FormData,
) {
  const supabase = await createClient();

  const name = String(
    formData.get("name") ?? "",
  ).trim();

  const description =
    String(
      formData.get("description") ?? "",
    ).trim() || null;

  const logoUrl =
    String(
      formData.get("logo_url") ?? "",
    ).trim() || null;

  const website =
    String(
      formData.get("website") ?? "",
    ).trim() || null;

  const isVerified =
    formData.get("is_verified") === "on";

  const isActive =
  formData.get("is_active") === "on";

  if (!name) {
    throw new Error("Brand name is required.");
  }

  const slug = await getUniqueBrandSlug(
    supabase,
    name,
  );

  const { error } = await supabase
    .from("brands")
    .insert({
      name,
      slug,
      description,
      logo_url: logoUrl,
      website,
      is_verified: isVerified,
      is_active: isActive,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/brands");
}

export async function updateBrand(
  id: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const name = String(
    formData.get("name") ?? "",
  ).trim();

  const description =
    String(
      formData.get("description") ?? "",
    ).trim() || null;

  const logoUrl =
    String(
      formData.get("logo_url") ?? "",
    ).trim() || null;

  const website =
    String(
      formData.get("website") ?? "",
    ).trim() || null;

  const isVerified =
    formData.get("is_verified") === "on";

const isActive =
  formData.get("is_active") === "on";

  if (!name) {
    throw new Error("Brand name is required.");
  }

  const slug = await getUniqueBrandSlug(
    supabase,
    name,
    id,
  );

  const { error } = await supabase
    .from("brands")
    .update({
      name,
      slug,
      description,
      logo_url: logoUrl,
      website,
      is_verified: isVerified,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/brands");
}

export async function deleteBrand(id: string) {
  const supabase = await createClient();

  const { data: products, error: productsError } =
    await supabase
      .from("products")
      .select("id")
      .eq("brand_id", id)
      .limit(1);

  if (productsError) {
    throw new Error(productsError.message);
  }

  if (products && products.length > 0) {
    throw new Error(
      "Brand tidak bisa dihapus karena masih digunakan oleh product.",
    );
  }

  const { data, error } = await supabase
    .from("brands")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Brand tidak ditemukan atau tidak bisa dihapus.",
    );
  }

  revalidatePath("/dashboard/brands");
}