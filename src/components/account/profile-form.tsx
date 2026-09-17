"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import type { Profile } from "@/lib/actions/profile";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Button } from "@/components/button";

type Props = {
  profile: Profile & { email: string };
};

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "twitter", label: "X / Twitter" },
] as const;

const GENDER_OPTIONS = [
  { value: "", label: "Pilih..." },
  { value: "male", label: "Laki-laki" },
  { value: "female", label: "Perempuan" },
  { value: "prefer_not_to_say", label: "Tidak ingin menyatakan" },
] as const;

function toDateString(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0] ?? "";
}

export function ProfileForm({ profile }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birthDate, setBirthDate] = useState(toDateString(profile.birth_date));
  const [gender, setGender] = useState(profile.gender ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");

  const initialSocials = profile.social_links ?? {};
  const [socialInstagram, setSocialInstagram] = useState(
    initialSocials.instagram ?? "",
  );
  const [socialTiktok, setSocialTiktok] = useState(
    initialSocials.tiktok ?? "",
  );
  const [socialTwitter, setSocialTwitter] = useState(
    initialSocials.twitter ?? "",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const socialMap: Record<string, string> = {};
  if (socialInstagram.trim()) socialMap.instagram = socialInstagram.trim();
  if (socialTiktok.trim()) socialMap.tiktok = socialTiktok.trim();
  if (socialTwitter.trim()) socialMap.twitter = socialTwitter.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await updateProfile({
        full_name: fullName || null,
        phone: phone || null,
        birth_date: birthDate || null,
        gender: (gender || null) as Profile["gender"],
        bio: bio || null,
        website: website || null,
        social_links: Object.keys(socialMap).length > 0 ? socialMap : {},
      });
      setSuccess("Profil berhasil diperbarui.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan profil.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Informasi Dasar</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="full_name">Nama Lengkap</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap"
              className="mt-1.5"
              maxLength={150}
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              value={profile.email}
              disabled
              className="mt-1.5 bg-gray-50 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Email tidak dapat diubah.
            </p>
          </div>

          <div>
            <Label htmlFor="phone">Nomor Telepon</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+62812345678"
              className="mt-1.5"
              maxLength={20}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="birth_date">Tanggal Lahir</Label>
              <Input
                id="birth_date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="gender">Jenis Kelamin</Label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Tentang Saya</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ceritakan sedikit tentang diri Anda..."
              rows={3}
              maxLength={5000}
              className="mt-1.5 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="mt-1.5"
              maxLength={500}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Media Sosial</h2>

        <div className="space-y-4">
          {SOCIAL_PLATFORMS.map((platform) => {
            const values: Record<string, string> = {
              instagram: socialInstagram,
              tiktok: socialTiktok,
              twitter: socialTwitter,
            };
            const setters: Record<string, (v: string) => void> = {
              instagram: setSocialInstagram,
              tiktok: setSocialTiktok,
              twitter: setSocialTwitter,
            };
            return (
              <div key={platform.key}>
                <Label htmlFor={`social-${platform.key}`}>
                  {platform.label}
                </Label>
                <Input
                  id={`social-${platform.key}`}
                  value={values[platform.key]}
                  onChange={(e) => setters[platform.key]?.(e.target.value)}
                  placeholder={`Username ${platform.label}`}
                  className="mt-1.5"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="lg">
          {loading ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
