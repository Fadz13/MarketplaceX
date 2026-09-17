"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────

export type AvatarUploadResult = {
  avatar_url: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function resolveUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("Silakan login terlebih dahulu.");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("Akun pengguna tidak ditemukan.");
  }

  return user.id;
}

function validateAvatarFile(file: File): void {
  if (!(file instanceof File)) {
    throw new Error("File gambar harus disertakan.");
  }

  if (file.size === 0) {
    throw new Error("File gambar kosong.");
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Hanya file JPG, PNG, dan WebP yang diizinkan untuk avatar.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Ukuran file avatar tidak boleh melebihi 5 MB.");
  }
}

function getExtensionFromMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? "jpg";
}

function getAvatarPath(userId: string, ext: string): string {
  return `${userId}/avatar.${ext}`;
}

const AVATAR_BUCKET = "avatars";

// ── Server Actions ─────────────────────────────────────────────────────────

export async function uploadAvatar(file: File): Promise<AvatarUploadResult> {
  validateAvatarFile(file);

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const ext = getExtensionFromMime(file.type);
  const filePath = getAvatarPath(userId, ext);

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error("Gagal mengunggah avatar. Silakan coba lagi.");
  }

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath);

  const avatarUrl = publicUrlData.publicUrl;

  const now = new Date().toISOString();

  const updateData: Database["public"]["Tables"]["user_profiles"]["Update"] = {
    avatar_url: avatarUrl,
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", userId);

    if (updateErr) {
      throw new Error("Gagal memperbarui profil avatar.");
    }
  } else {
    const { error: insertErr } = await supabase
      .from("user_profiles")
      .insert({ user_id: userId, ...updateData });

    if (insertErr) {
      throw new Error("Gagal menyimpan profil avatar.");
    }
  }

  revalidatePath("/account/profile");

  return { avatar_url: avatarUrl };
}

export async function deleteAvatar(): Promise<void> {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const { data: profile, error: fetchErr } = await supabase
    .from("user_profiles")
    .select("avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  if (!profile?.avatar_url) {
    return;
  }

  const marker = "/storage/v1/object/public/avatars/";
  const urlIndex = profile.avatar_url.indexOf(marker);
  if (urlIndex !== -1) {
    const objectPath = profile.avatar_url.slice(urlIndex + marker.length);

    const { error: removeErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([objectPath]);

    if (removeErr) {
      throw new Error("Gagal menghapus avatar dari penyimpanan.");
    }
  }

  const now = new Date().toISOString();

  const { error: clearErr } = await supabase
    .from("user_profiles")
    .update({ avatar_url: null, updated_at: now })
    .eq("user_id", userId);

  if (clearErr) {
    throw new Error("Gagal menghapus avatar dari profil.");
  }

  revalidatePath("/account/profile");
}
