"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  gender: "male" | "female" | "prefer_not_to_say" | null;
  phone: string | null;
  social_links: Record<string, string>;
  website: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInput = {
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gender?: "male" | "female" | "prefer_not_to_say" | null;
  bio?: string | null;
  website?: string | null;
  social_links?: Record<string, string>;
};

type ProfileWithUser = Profile & { email: string };

// ── Validation ─────────────────────────────────────────────────────────────

const MAX_LENGTHS = {
  full_name: 150,
  phone: 20,
  bio: 5000,
  website: 500,
} as const;

const PHONE_RE = /^\+?[0-9]{7,20}$/;
const URL_RE = /^https?:\/\/.+/;
const VALID_GENDERS = ["male", "female", "prefer_not_to_say"] as const;

function validateProfileInput(input: ProfileInput): void {
  if (input.full_name !== undefined && input.full_name !== null) {
    const trimmed = input.full_name.trim();
    if (trimmed.length > MAX_LENGTHS.full_name) {
      throw new Error(
        `Nama lengkap maksimal ${MAX_LENGTHS.full_name} karakter.`,
      );
    }
  }

  if (input.phone !== undefined && input.phone !== null) {
    const trimmed = input.phone.trim();
    if (trimmed !== "" && !PHONE_RE.test(trimmed)) {
      throw new Error(
        "Nomor telepon tidak valid. Gunakan format angka dengan kode negara, misal +62812345678.",
      );
    }
  }

  if (input.birth_date !== undefined && input.birth_date !== null) {
    const date = new Date(input.birth_date);
    if (isNaN(date.getTime())) {
      throw new Error("Format tanggal lahir tidak valid.");
    }
    const now = new Date();
    if (date > now) {
      throw new Error("Tanggal lahir tidak boleh di masa depan.");
    }
  }

  if (input.gender !== undefined && input.gender !== null) {
    if (!VALID_GENDERS.includes(input.gender as (typeof VALID_GENDERS)[number])) {
      throw new Error(
        "Jenis kelamin harus salah satu dari: Laki-laki, Perempuan, atau Tidak ingin menyatakan.",
      );
    }
  }

  if (input.bio !== undefined && input.bio !== null) {
    const trimmed = input.bio.trim();
    if (trimmed.length > MAX_LENGTHS.bio) {
      throw new Error(`Bio maksimal ${MAX_LENGTHS.bio} karakter.`);
    }
  }

  if (input.website !== undefined && input.website !== null) {
    const trimmed = input.website.trim();
    if (trimmed !== "" && !URL_RE.test(trimmed)) {
      throw new Error("URL website harus diawali dengan http:// atau https://.");
    }
    if (trimmed.length > MAX_LENGTHS.website) {
      throw new Error(
        `URL website maksimal ${MAX_LENGTHS.website} karakter.`,
      );
    }
  }

  if (input.social_links !== undefined && input.social_links !== null) {
    if (
      typeof input.social_links !== "object" ||
      Array.isArray(input.social_links)
    ) {
      throw new Error("Social links harus berupa objek.");
    }
    for (const [key, value] of Object.entries(input.social_links)) {
      if (typeof key !== "string" || typeof value !== "string") {
        throw new Error("Social links harus berupa objek dengan nilai string.");
      }
    }
  }
}

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

function normalizeString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// ── Server Actions ─────────────────────────────────────────────────────────

export async function getProfile(): Promise<ProfileWithUser> {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const { data: existing, error: fetchErr } = await supabase
    .from("user_profiles")
    .select("*, users!user_profiles_user_id_fkey(email)")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  if (existing) {
    const { users, ...profile } = existing as Record<string, unknown> & {
      users: { email: string } | null;
    };
    return {
      ...(profile as Profile),
      email: users?.email ?? "",
      social_links:
        typeof profile.social_links === "object" && profile.social_links !== null
          ? (profile.social_links as Record<string, string>)
          : {},
    };
  }

  const { data: created, error: createErr } = await supabase
    .from("user_profiles")
    .insert({ user_id: userId })
    .select("*, users!user_profiles_user_id_fkey(email)")
    .single();

  if (createErr) {
    throw new Error(createErr.message);
  }

  const { users, ...profile } = created as Record<string, unknown> & {
    users: { email: string } | null;
  };
  return {
    ...(profile as Profile),
    email: users?.email ?? "",
    social_links:
      typeof profile.social_links === "object" && profile.social_links !== null
        ? (profile.social_links as Record<string, string>)
        : {},
  };
}

export async function updateProfile(input: ProfileInput): Promise<Profile> {
  validateProfileInput(input);

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const { data: existing, error: fetchErr } = await supabase
    .from("user_profiles")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  const now = new Date().toISOString();

  const updateData: Database["public"]["Tables"]["user_profiles"]["Update"] = {
    full_name: normalizeString(input.full_name),
    phone: normalizeString(input.phone),
    birth_date: normalizeString(input.birth_date),
    gender: input.gender ?? null,
    bio: normalizeString(input.bio),
    website: normalizeString(input.website),
    social_links: input.social_links ?? {},
    updated_at: now,
  };

  if (existing) {
    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", userId);

    if (updateErr) {
      throw new Error(updateErr.message);
    }
  } else {
    const { error: insertErr } = await supabase
      .from("user_profiles")
      .insert({ user_id: userId, ...updateData });

    if (insertErr) {
      throw new Error(insertErr.message);
    }
  }

  revalidatePath("/account/profile");

  const { data: saved, error: savedErr } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (savedErr) {
    throw new Error(savedErr.message);
  }

  return {
    ...(saved as Profile),
    social_links:
      typeof (saved as Record<string, unknown>)?.social_links === "object" &&
      (saved as Record<string, unknown>).social_links !== null
        ? ((saved as Record<string, unknown>).social_links as Record<string, string>)
        : {},
  };
}
