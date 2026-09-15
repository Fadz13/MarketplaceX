"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ── Types ──────────────────────────────────────────────────────────────────

export type Address = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_detail: string;
  province: string;
  city: string;
  district: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type AddressInput = {
  label?: string;
  recipient_name: string;
  phone: string;
  address_detail: string;
  province: string;
  city: string;
  district: string;
  postal_code: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
};

// ── Validation ─────────────────────────────────────────────────────────────

const MAX_LENGTHS = {
  label: 50,
  recipient_name: 150,
  phone: 20,
  address_detail: 500,
  province: 100,
  city: 100,
  district: 100,
  postal_code: 10,
} as const;

function validateAddressInput(input: AddressInput): void {
  const required: Array<[keyof AddressInput, string]> = [
    ["recipient_name", "Nama penerima wajib diisi."],
    ["phone", "Nomor HP wajib diisi."],
    ["address_detail", "Alamat lengkap wajib diisi."],
    ["province", "Provinsi wajib diisi."],
    ["city", "Kota wajib diisi."],
    ["district", "Kecamatan wajib diisi."],
    ["postal_code", "Kode pos wajib diisi."],
  ];

  for (const [field, message] of required) {
    const value = input[field];
    if (typeof value === "string" && value.trim() === "") {
      throw new Error(message);
    }
  }

  for (const [field, maxLen] of Object.entries(MAX_LENGTHS)) {
    const value = input[field as keyof AddressInput];
    if (typeof value === "string" && value.length > maxLen) {
      throw new Error(
        `Field ${field} maksimal ${maxLen} karakter.`,
      );
    }
  }

  if (!/^\d{1,10}$/.test(input.postal_code.trim())) {
    throw new Error("Kode pos harus berupa angka maksimal 10 digit.");
  }

  if (input.phone.trim().length < 8) {
    throw new Error("Nomor HP minimal 8 digit.");
  }

  if (
    input.latitude != null &&
    (input.latitude < -90 || input.latitude > 90)
  ) {
    throw new Error("Latitude harus antara -90 dan 90.");
  }

  if (
    input.longitude != null &&
    (input.longitude < -180 || input.longitude > 180)
  ) {
    throw new Error("Longitude harus antara -180 dan 180.");
  }
}

// ── Auth helper ────────────────────────────────────────────────────────────

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

// ── Server Actions ─────────────────────────────────────────────────────────

export async function getAddresses(): Promise<Address[]> {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Address[];
}

export async function createAddress(
  input: AddressInput,
): Promise<Address> {
  validateAddressInput(input);

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const isDefault = input.is_default ?? false;

  if (isDefault) {
    const { error: clearErr } = await supabase
      .from("addresses")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_default", true);

    if (clearErr) {
      throw new Error(clearErr.message);
    }
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: userId,
      label: input.label?.trim() || "Rumah",
      recipient_name: input.recipient_name.trim(),
      phone: input.phone.trim(),
      address_detail: input.address_detail.trim(),
      province: input.province.trim(),
      city: input.city.trim(),
      district: input.district.trim(),
      postal_code: input.postal_code.trim(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      is_default: isDefault,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");

  return data as Address;
}

export async function updateAddress(
  addressId: string,
  input: AddressInput,
): Promise<Address> {
  if (!addressId) {
    throw new Error("Address ID wajib diisi.");
  }

  validateAddressInput(input);

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const { data: existing, error: fetchErr } = await supabase
    .from("addresses")
    .select("id, user_id, is_default")
    .eq("id", addressId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  if (!existing) {
    throw new Error("Alamat tidak ditemukan.");
  }

  if (existing.user_id !== userId) {
    throw new Error("Anda tidak memiliki akses ke alamat ini.");
  }

  const isDefault = input.is_default ?? existing.is_default;

  if (isDefault && !existing.is_default) {
    const { error: clearErr } = await supabase
      .from("addresses")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_default", true);

    if (clearErr) {
      throw new Error(clearErr.message);
    }
  }

  const { data, error } = await supabase
    .from("addresses")
    .update({
      label: input.label?.trim() || "Rumah",
      recipient_name: input.recipient_name.trim(),
      phone: input.phone.trim(),
      address_detail: input.address_detail.trim(),
      province: input.province.trim(),
      city: input.city.trim(),
      district: input.district.trim(),
      postal_code: input.postal_code.trim(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    })
    .eq("id", addressId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");

  return data as Address;
}

export async function deleteAddress(
  addressId: string,
): Promise<void> {
  if (!addressId) {
    throw new Error("Address ID wajib diisi.");
  }

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const { data: existing, error: fetchErr } = await supabase
    .from("addresses")
    .select("id, user_id")
    .eq("id", addressId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  if (!existing) {
    throw new Error("Alamat tidak ditemukan.");
  }

  if (existing.user_id !== userId) {
    throw new Error("Anda tidak memiliki akses ke alamat ini.");
  }

  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", addressId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}

export async function setDefaultAddress(
  addressId: string,
): Promise<void> {
  if (!addressId) {
    throw new Error("Address ID wajib diisi.");
  }

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  const { data: existing, error: fetchErr } = await supabase
    .from("addresses")
    .select("id, user_id, is_default")
    .eq("id", addressId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  if (!existing) {
    throw new Error("Alamat tidak ditemukan.");
  }

  if (existing.user_id !== userId) {
    throw new Error("Anda tidak memiliki akses ke alamat ini.");
  }

  if (existing.is_default) {
    return;
  }

  const { error: clearErr } = await supabase
    .from("addresses")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_default", true);

  if (clearErr) {
    throw new Error(clearErr.message);
  }

  const { error: setErr } = await supabase
    .from("addresses")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", addressId);

  if (setErr) {
    throw new Error(setErr.message);
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}
