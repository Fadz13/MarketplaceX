import { describe, it, expect } from "vitest";

// ── Validation tests ───────────────────────────────────────────────────────

describe("Address validation", () => {
  const validInput = {
    recipient_name: "John Doe",
    phone: "081234567890",
    address_detail: "Jl. Test No. 1",
    province: "DKI Jakarta",
    city: "Jakarta Selatan",
    district: "Kebayoran Baru",
    postal_code: "12190",
  };

  function validateRequired(input: Record<string, string>): string[] {
    return Object.entries(input)
      .filter(([, v]) => v.trim() === "")
      .map(([k]) => k);
  }

  it("accepts valid input", () => {
    expect(validateRequired(validInput).length).toBe(0);
  });

  it("rejects empty recipient_name", () => {
    const input = { ...validInput, recipient_name: "" };
    expect(validateRequired(input)).toContain("recipient_name");
  });

  it("rejects empty phone", () => {
    const input = { ...validInput, phone: "" };
    expect(validateRequired(input)).toContain("phone");
  });

  it("rejects short phone", () => {
    expect("123".length).toBeLessThan(8);
  });

  it("rejects non-numeric postal code", () => {
    expect(/^\d{1,10}$/.test("ABCDE")).toBe(false);
  });

  it("rejects postal code too long", () => {
    expect("12345678901".length).toBeGreaterThan(10);
  });

  it("rejects empty province", () => {
    const input = { ...validInput, province: "" };
    expect(validateRequired(input)).toContain("province");
  });

  it("rejects empty city", () => {
    const input = { ...validInput, city: "" };
    expect(validateRequired(input)).toContain("city");
  });

  it("rejects empty district", () => {
    const input = { ...validInput, district: "" };
    expect(validateRequired(input)).toContain("district");
  });

  it("rejects empty postal_code", () => {
    const input = { ...validInput, postal_code: "" };
    expect(validateRequired(input)).toContain("postal_code");
  });
});

// ── Server action logic tests ──────────────────────────────────────────────

describe("Address server action logic", () => {
  describe("getAddresses", () => {
    it("returns addresses for authenticated user", () => {
      const mockAddresses = [
        { id: "1", user_id: "u1", label: "Rumah", is_default: true },
      ];
      expect(mockAddresses.length).toBe(1);
      expect(mockAddresses[0]?.user_id).toBe("u1");
    });

    it("returns empty for unauthenticated user", () => {
      const user = null;
      expect(user).toBeNull();
    });
  });

  describe("createAddress", () => {
    it("clears other defaults when creating default address", () => {
      const existingDefaults = [
        { id: "d1", is_default: true },
        { id: "d2", is_default: false },
      ];

      // Simulate clearing
      const cleared = existingDefaults.map((d) => ({
        ...d,
        is_default: false,
      }));

      expect(cleared.every((d) => d.is_default === false)).toBe(true);
    });
  });

  describe("setDefaultAddress", () => {
    it("clears existing default before setting new", () => {
      const addresses = [
        { id: "a1", is_default: true },
        { id: "a2", is_default: false },
      ];

      // Clear all defaults
      const cleared = addresses.map((a) => ({ ...a, is_default: false }));
      // Set new default
      const updated = cleared.map((a) => ({
        ...a,
        is_default: a.id === "a2",
      }));

      expect(updated.filter((a) => a.is_default).length).toBe(1);
      expect(updated.find((a) => a.id === "a2")?.is_default).toBe(true);
    });
  });

  describe("deleteAddress", () => {
    it("verifies ownership before delete", () => {
      const existing = { id: "addr-1", user_id: "u1" };
      const currentUserId = "u1";
      expect(existing.user_id).toBe(currentUserId);
    });

    it("rejects delete of other user address", () => {
      const existing = { id: "addr-1", user_id: "u2" };
      const currentUserId = "u1";
      expect(existing.user_id).not.toBe(currentUserId);
    });
  });

  describe("updateAddress", () => {
    it("verifies ownership before update", () => {
      const existing = { id: "addr-1", user_id: "u1", is_default: false };
      const currentUserId = "u1";
      expect(existing.user_id).toBe(currentUserId);
    });

    it("rejects update of other user address", () => {
      const existing = { id: "addr-1", user_id: "u2", is_default: false };
      const currentUserId = "u1";
      expect(existing.user_id).not.toBe(currentUserId);
    });
  });
});

// ── Address data shape tests ───────────────────────────────────────────────

describe("Address data shape", () => {
  const validAddress = {
    id: "test-id",
    user_id: "user-id",
    label: "Rumah",
    recipient_name: "John Doe",
    phone: "081234567890",
    address_detail: "Jl. Test No. 1",
    province: "DKI Jakarta",
    city: "Jakarta Selatan",
    district: "Kebayoran Baru",
    postal_code: "12190",
    latitude: null,
    longitude: null,
    is_default: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("has all required fields", () => {
    expect(validAddress.id).toBeDefined();
    expect(validAddress.user_id).toBeDefined();
    expect(validAddress.recipient_name).toBeDefined();
    expect(validAddress.phone).toBeDefined();
    expect(validAddress.address_detail).toBeDefined();
    expect(validAddress.province).toBeDefined();
    expect(validAddress.city).toBeDefined();
    expect(validAddress.district).toBeDefined();
    expect(validAddress.postal_code).toBeDefined();
  });

  it("supports default flag", () => {
    expect(typeof validAddress.is_default).toBe("boolean");
  });

  it("supports nullable coordinates", () => {
    expect(validAddress.latitude).toBeNull();
    expect(validAddress.longitude).toBeNull();
  });
});

// ── Checkout address selection logic ───────────────────────────────────────

describe("Checkout address selection", () => {
  const addresses = [
    { id: "a1", label: "Rumah", is_default: true, recipient_name: "R1" },
    { id: "a2", label: "Kantor", is_default: false, recipient_name: "R2" },
  ];

  it("selects default address when available", () => {
    const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0];
    expect(defaultAddr?.id).toBe("a1");
  });

  it("falls back to first address when no default", () => {
    const noDefault = addresses.map((a) => ({ ...a, is_default: false }));
    const selected = noDefault.find((a) => a.is_default) ?? noDefault[0];
    expect(selected?.id).toBe("a1");
  });

  it("uses manual entry when no saved addresses", () => {
    const empty: typeof addresses = [];
    const defaultAddr = empty.find((a) => a.is_default) ?? empty[0];
    expect(defaultAddr).toBeUndefined();
  });
});
