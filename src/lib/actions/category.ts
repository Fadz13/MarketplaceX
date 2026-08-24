"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type CategoryStatus = "active" | "inactive";

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

async function getUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  currentId?: string,
) {
  const baseSlug = makeSlug(name);

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const { data, error } = await supabase
      .from("categories")
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

async function getCategoryDepth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string | null,
) {
  if (!parentId) {
    return 0;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("depth")
    .eq("id", parentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Parent category tidak ditemukan.");
  }

  return data.depth + 1;
}

async function wouldCreateCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  newParentId: string | null,
) {
  if (!newParentId) {
    return false;
  }

  // Tidak boleh menjadikan dirinya sendiri sebagai parent.
  if (categoryId === newParentId) {
    return true;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id");

  if (error) {
    throw new Error(error.message);
  }

  const parentMap = new Map<string, string | null>();

  for (const category of data ?? []) {
    parentMap.set(category.id, category.parent_id);
  }

  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    // Kalau saat naik dari calon parent kita ketemu
    // category yang sedang diedit, akan terbentuk loop.
    if (currentId === categoryId) {
      return true;
    }

    // Pengaman jika database ternyata sudah memiliki cycle.
    if (visited.has(currentId)) {
      return true;
    }

    visited.add(currentId);

    currentId = parentMap.get(currentId) ?? null;
  }

  return false;
}

/**
 * GET ALL CATEGORIES
 */
export async function getCategories() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select(`
      *,
      parent:parent_id (
        id,
        name
      )
    `)
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * CREATE CATEGORY
 */
export async function createCategory(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();

  const status =
    String(formData.get("status") ?? "active") as CategoryStatus;

  const parentId =
    String(formData.get("parent_id") ?? "") || null;

  if (!name) {
    throw new Error("Category name is required.");
  }

  const slug = await getUniqueSlug(
    supabase,
    name,
  );

  const depth = await getCategoryDepth(
    supabase,
    parentId,
  );

  const { error } = await supabase
    .from("categories")
    .insert({
      name,
      slug,
      status,
      parent_id: parentId,
      depth,
      sort_order: 999,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/categories");
}

/**
 * UPDATE CATEGORY
 */
export async function updateCategory(
  id: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();

  const status =
    String(formData.get("status") ?? "active") as CategoryStatus;

  const parentId =
    String(formData.get("parent_id") ?? "") || null;

  if (!name) {
    throw new Error("Category name is required.");
  }

  // Pastikan category yang diedit memang ada.
  const { data: currentCategory, error: currentError } =
    await supabase
      .from("categories")
      .select("id, parent_id")
      .eq("id", id)
      .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  if (!currentCategory) {
    throw new Error("Category tidak ditemukan.");
  }

  // Cegah circular relation.
  const cycleDetected = await wouldCreateCycle(
    supabase,
    id,
    parentId,
  );

  if (cycleDetected) {
    throw new Error(
      "Parent tidak valid karena akan membuat circular relation.",
    );
  }

  const slug = await getUniqueSlug(
    supabase,
    name,
    id,
  );

  // Depth mengikuti parent:
  // root = 0
  // child = parent.depth + 1
  const depth = await getCategoryDepth(
    supabase,
    parentId,
  );

  const { error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      status,
      parent_id: parentId,
      depth,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/categories");
}

/**
 * DELETE CATEGORY
 */
export async function deleteCategory(id: string) {
  const supabase = await createClient();

  // Parent yang masih punya child tidak boleh dihapus.
  const { data: children, error: childrenError } =
    await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", id)
      .limit(1);

  if (childrenError) {
    throw new Error(childrenError.message);
  }

  if (children && children.length > 0) {
    throw new Error(
      "Kategori tidak bisa dihapus karena masih memiliki subcategory.",
    );
  }

  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Kategori tidak ditemukan atau tidak bisa dihapus.",
    );
  }

  revalidatePath("/dashboard/categories");
}