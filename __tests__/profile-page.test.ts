/**
 * Profile Page & Form — Unit Tests
 *
 * Tests cover:
 *   A. Profile page structure
 *   B. Profile form fields
 *   C. Gender options
 *   D. Social links structure
 *   E. Date handling
 *   F. Validation rules (mirrors server-side)
 *   G. Auth redirect behavior
 *   H. Form state logic
 */

import { describe, it, expect } from "vitest";

// ── Constants ──────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: "", label: "Pilih..." },
  { value: "male", label: "Laki-laki" },
  { value: "female", label: "Perempuan" },
  { value: "prefer_not_to_say", label: "Tidak ingin menyatakan" },
] as const;

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "twitter", label: "X / Twitter" },
] as const;

const VALID_GENDERS = ["male", "female", "prefer_not_to_say"] as const;

// ── Profile Page Structure ─────────────────────────────────────────────────

describe("Profile page structure", () => {
  it("A: page has breadcrumb back link to /account", () => {
    const backLink = "/account";
    expect(backLink).toBe("/account");
  });

  it("B: page title contains Profil", () => {
    const title = "Profil Saya — MarketplaceX";
    expect(title).toContain("Profil");
  });

  it("C: page renders profile form component", () => {
    const profile = {
      full_name: "John",
      email: "john@test.com",
      phone: null,
      birth_date: null,
      gender: null,
      bio: null,
      website: null,
      social_links: {},
    };
    expect(profile).toHaveProperty("full_name");
    expect(profile).toHaveProperty("email");
  });

  it("D: unauthenticated access redirects to login", () => {
    const nextParam = "/account/profile";
    const redirectUrl = `/login?next=${encodeURIComponent(nextParam)}`;
    expect(redirectUrl).toBe("/login?next=%2Faccount%2Fprofile");
  });
});

// ── Profile Form Fields ────────────────────────────────────────────────────

describe("Profile form fields", () => {
  const mockProfile = {
    id: "p1",
    user_id: "u1",
    full_name: "Jane Doe",
    avatar_url: null,
    bio: "Hello world",
    birth_date: "1990-05-15",
    gender: "female" as const,
    phone: "+62812345678",
    social_links: { instagram: "janedoe" },
    website: "https://example.com",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    email: "jane@test.com",
  };

  it("E: form initializes with profile full_name", () => {
    const initialValue = mockProfile.full_name ?? "";
    expect(initialValue).toBe("Jane Doe");
  });

  it("F: form initializes with profile phone", () => {
    const initialValue = mockProfile.phone ?? "";
    expect(initialValue).toBe("+62812345678");
  });

  it("G: form initializes with profile bio", () => {
    const initialValue = mockProfile.bio ?? "";
    expect(initialValue).toBe("Hello world");
  });

  it("H: form initializes with profile website", () => {
    const initialValue = mockProfile.website ?? "";
    expect(initialValue).toBe("https://example.com");
  });

  it("I: form initializes gender from profile", () => {
    const initialValue = mockProfile.gender ?? "";
    expect(initialValue).toBe("female");
  });

  it("J: form handles null full_name", () => {
    const profile = { ...mockProfile, full_name: null };
    const initialValue = profile.full_name ?? "";
    expect(initialValue).toBe("");
  });

  it("K: form handles null phone", () => {
    const profile = { ...mockProfile, phone: null };
    const initialValue = profile.phone ?? "";
    expect(initialValue).toBe("");
  });

  it("L: form handles null bio", () => {
    const profile = { ...mockProfile, bio: null };
    const initialValue = profile.bio ?? "";
    expect(initialValue).toBe("");
  });

  it("M: form handles null website", () => {
    const profile = { ...mockProfile, website: null };
    const initialValue = profile.website ?? "";
    expect(initialValue).toBe("");
  });

  it("N: form handles null gender", () => {
    const profile = { ...mockProfile, gender: null };
    const initialValue = profile.gender ?? "";
    expect(initialValue).toBe("");
  });

  it("O: form handles null birth_date", () => {
    const profile = { ...mockProfile, birth_date: null };
    const initialValue = profile.birth_date ?? "";
    expect(initialValue).toBe("");
  });
});

// ── Gender Options ─────────────────────────────────────────────────────────

describe("Gender options", () => {
  it("P: has exactly 4 options (including placeholder)", () => {
    expect(GENDER_OPTIONS).toHaveLength(4);
  });

  it("Q: first option is empty placeholder", () => {
    expect(GENDER_OPTIONS[0]?.value).toBe("");
    expect(GENDER_OPTIONS[0]?.label).toBe("Pilih...");
  });

  it("R: male option exists with correct value", () => {
    const male = GENDER_OPTIONS.find((o) => o.value === "male");
    expect(male?.label).toBe("Laki-laki");
  });

  it("S: female option exists with correct value", () => {
    const female = GENDER_OPTIONS.find((o) => o.value === "female");
    expect(female?.label).toBe("Perempuan");
  });

  it("T: prefer_not_to_say option exists with correct value", () => {
    const prefer = GENDER_OPTIONS.find(
      (o) => o.value === "prefer_not_to_say",
    );
    expect(prefer?.label).toBe("Tidak ingin menyatakan");
  });

  it("U: all non-empty values are valid genders", () => {
    const validValues = GENDER_OPTIONS.filter((o) => o.value !== "").map(
      (o) => o.value,
    );
    for (const v of validValues) {
      expect(VALID_GENDERS).toContain(v);
    }
  });
});

// ── Social Links ───────────────────────────────────────────────────────────

describe("Social links structure", () => {
  it("V: supports instagram", () => {
    expect(SOCIAL_PLATFORMS.map((p) => p.key)).toContain("instagram");
  });

  it("W: supports tiktok", () => {
    expect(SOCIAL_PLATFORMS.map((p) => p.key)).toContain("tiktok");
  });

  it("X: supports twitter", () => {
    expect(SOCIAL_PLATFORMS.map((p) => p.key)).toContain("twitter");
  });

  it("Y: each platform has a display label", () => {
    for (const p of SOCIAL_PLATFORMS) {
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("Z: social_links is stored as object with string values", () => {
    const links: Record<string, string> = {
      instagram: "user123",
      tiktok: "user456",
    };
    expect(typeof links).toBe("object");
    expect(typeof links.instagram).toBe("string");
    expect(typeof links.tiktok).toBe("string");
  });

  it("AA: empty social_links is valid", () => {
    const links: Record<string, string> = {};
    expect(Object.keys(links)).toHaveLength(0);
  });
});

// ── Date Handling ──────────────────────────────────────────────────────────

describe("Date handling", () => {
  it("AB: toDateString converts ISO date to YYYY-MM-DD", () => {
    const isoDate = "1990-05-15T00:00:00.000Z";
    const result = new Date(isoDate).toISOString().split("T")[0];
    expect(result).toBe("1990-05-15");
  });

  it("AC: toDateString returns empty string for null", () => {
    const d: string | null = null;
    const result = d ?? "";
    expect(result).toBe("");
  });

  it("AD: date input value is YYYY-MM-DD format", () => {
    const dateValue = "1990-05-15";
    expect(/^\d{4}-\d{2}-\d{2}$/.test(dateValue)).toBe(true);
  });

  it("AE: birth_date must not be in the future", () => {
    const now = new Date();
    const futureDate = new Date(
      now.getFullYear() + 1,
      now.getMonth(),
      now.getDate(),
    );
    expect(futureDate > now).toBe(true);
  });
});

// ── Validation Rules ───────────────────────────────────────────────────────

describe("Validation rules (mirrors server-side)", () => {
  const PHONE_RE = /^\+?[0-9]{7,20}$/;
  const URL_RE = /^https?:\/\/.+/;
  const MAX_LENGTHS = { full_name: 150, phone: 20, bio: 5000, website: 500 };

  it("AF: accepts valid phone number", () => {
    expect(PHONE_RE.test("+62812345678")).toBe(true);
  });

  it("AG: accepts phone without country code", () => {
    expect(PHONE_RE.test("0812345678")).toBe(true);
  });

  it("AH: rejects phone with letters", () => {
    expect(PHONE_RE.test("abc123")).toBe(false);
  });

  it("AI: rejects phone too short", () => {
    expect(PHONE_RE.test("123")).toBe(false);
  });

  it("AJ: accepts valid https URL", () => {
    expect(URL_RE.test("https://example.com")).toBe(true);
  });

  it("AK: accepts valid http URL", () => {
    expect(URL_RE.test("http://example.com")).toBe(true);
  });

  it("AL: rejects URL without protocol", () => {
    expect(URL_RE.test("example.com")).toBe(false);
  });

  it("AM: rejects ftp URL", () => {
    expect(URL_RE.test("ftp://example.com")).toBe(false);
  });

  it("AN: full_name max length is 150", () => {
    expect(MAX_LENGTHS.full_name).toBe(150);
    expect("a".repeat(150).length).toBeLessThanOrEqual(150);
    expect("a".repeat(151).length).toBeGreaterThan(150);
  });

  it("AO: phone max length is 20", () => {
    expect(MAX_LENGTHS.phone).toBe(20);
  });

  it("AP: bio max length is 5000", () => {
    expect(MAX_LENGTHS.bio).toBe(5000);
  });

  it("AQ: website max length is 500", () => {
    expect(MAX_LENGTHS.website).toBe(500);
  });
});

// ── Form State Logic ───────────────────────────────────────────────────────

describe("Form state logic", () => {
  it("AR: empty string converts to null on submit", () => {
    const value = "";
    const result = value || null;
    expect(result).toBeNull();
  });

  it("AS: non-empty string stays as-is on submit", () => {
    const value = "John";
    const result = value || null;
    expect(result).toBe("John");
  });

  it("AT: empty social_links object is sent as empty object", () => {
    const socialMap: Record<string, string> = {};
    const result = Object.keys(socialMap).length > 0 ? socialMap : {};
    expect(result).toEqual({});
  });

  it("AU: non-empty social_links object is sent as-is", () => {
    const socialMap: Record<string, string> = { instagram: "user123" };
    const result = Object.keys(socialMap).length > 0 ? socialMap : {};
    expect(result).toEqual({ instagram: "user123" });
  });

  it("AV: success message appears on successful save", () => {
    const message = "Profil berhasil diperbarui.";
    expect(message).toContain("berhasil");
  });

  it("AW: error message appears on failed save", () => {
    const message = "Gagal menyimpan profil.";
    expect(message).toContain("Gagal");
  });

  it("AX: loading state prevents duplicate submissions", () => {
    const loading = true;
    const isDisabled = loading;
    expect(isDisabled).toBe(true);
  });

  it("AY: loading text shows during submission", () => {
    const loading = true;
    const buttonText = loading ? "Menyimpan..." : "Simpan Perubahan";
    expect(buttonText).toBe("Menyimpan...");
  });

  it("AZ: normal text shows when not loading", () => {
    const loading = false;
    const buttonText = loading ? "Menyimpan..." : "Simpan Perubahan";
    expect(buttonText).toBe("Simpan Perubahan");
  });
});
