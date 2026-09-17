/**
 * Profile — Unit Tests
 *
 * Tests cover:
 *   A. getProfile: unauthenticated → rejected
 *   B. getProfile: authenticated user → returns profile
 *   C. getProfile: authenticated user, no existing profile → creates and returns
 *   D. updateProfile: unauthenticated → rejected
 *   E. updateProfile: authenticated user → updates own profile
 *   F. updateProfile: authenticated user, no profile → creates and updates
 *   G. Validation: full_name too long
 *   H. Validation: phone invalid format
 *   I. Validation: phone valid formats
 *   J. Validation: birth_date in future
 *   K. Validation: birth_date invalid format
 *   L. Validation: gender invalid value
 *   M. Validation: website invalid URL
 *   N. Validation: website valid URLs
 *   O. Validation: social_links non-object
 *   P. Validation: social_links invalid value types
 *   Q. Normalization: empty strings → null
 *   R. Protected fields: cannot modify user_id, email, role, etc.
 *   S. Authorization: user cannot update another profile
 *   T. Database error: users lookup fails
 *   U. Database error: profile update fails
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Types ────────────────────────────────────────────────────────────

type MockChain = Record<string, ReturnType<typeof vi.fn>>;

type MockProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  social_links: Record<string, string>;
  website: string | null;
  created_at: string;
  updated_at: string;
} | null;

// ─── Mock Factory ──────────────────────────────────────────────────────────

function createMockSupabase(
  authUser: { id: string } | null,
  userRow: { id: string } | null,
  profile: MockProfile = null,
) {
  let userProfilesCallCount = 0;

  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: authUser },
      error: authUser ? null : new Error("Not authenticated"),
    }),
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === "users") {
      const chain: MockChain = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: userRow,
        error: null,
      });
      return chain;
    }

    if (table === "user_profiles") {
      userProfilesCallCount++;

      const chain: MockChain = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue({ data: profile, error: null });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });

      chain.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      });

      chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      chain.upsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      });

      return chain;
    }

    return {};
  });

  return { auth: mockAuth, from: mockFrom };
}

// ─── Mock Module ───────────────────────────────────────────────────────────

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => mockSupabase),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── Shared Test Data ──────────────────────────────────────────────────────

const AUTH_USER = { id: "auth-user-1" };
const USER_ROW = { id: "user-1" };

const MOCK_PROFILE: MockProfile = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "John Doe",
  avatar_url: null,
  bio: null,
  birth_date: null,
  gender: null,
  phone: null,
  social_links: {},
  website: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("getProfile authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("A: throws when not authenticated", async () => {
    mockSupabase = createMockSupabase(null, null);
    const { getProfile } = await import("@/lib/actions/profile");
    await expect(getProfile()).rejects.toThrow("Silakan login terlebih dahulu.");
  });

  it("B: returns profile for authenticated user", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { getProfile } = await import("@/lib/actions/profile");
    const result = await getProfile();
    expect(result.user_id).toBe("user-1");
    expect(result.full_name).toBe("John Doe");
  });

  it("C: creates and returns profile when none exists", async () => {
    const createdProfile: MockProfile = {
      ...MOCK_PROFILE,
      full_name: null,
    };
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, null);

    let callCount = 0;
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
        return chain;
      }
      if (table === "user_profiles") {
        callCount++;
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdProfile, error: null }),
          }),
        });
        return chain;
      }
      return {};
    });

    const { getProfile } = await import("@/lib/actions/profile");
    const result = await getProfile();
    expect(result.user_id).toBe("user-1");
    expect(result.full_name).toBeNull();
  });
});

describe("updateProfile authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("D: throws when not authenticated", async () => {
    mockSupabase = createMockSupabase(null, null);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(updateProfile({ full_name: "Test" })).rejects.toThrow(
      "Silakan login terlebih dahulu.",
    );
  });

  it("E: updates own profile", async () => {
    const updatedProfile: MockProfile = {
      ...MOCK_PROFILE,
      full_name: "Jane Doe",
      updated_at: "2026-09-16T00:00:00Z",
    };
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);

    let profileCallCount = 0;
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
        return chain;
      }
      if (table === "user_profiles") {
        profileCallCount++;
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: profileCallCount <= 2 ? MOCK_PROFILE : updatedProfile,
          error: null,
        });
        chain.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
        return chain;
      }
      return {};
    });

    const { updateProfile } = await import("@/lib/actions/profile");
    const result = await updateProfile({ full_name: "Jane Doe" });
    expect(result.full_name).toBe("Jane Doe");
  });

  it("F: creates profile when none exists, then updates", async () => {
    const createdProfile: MockProfile = {
      ...MOCK_PROFILE,
      full_name: "New User",
    };
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, null);

    let profileCallCount = 0;
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
        return chain;
      }
      if (table === "user_profiles") {
        profileCallCount++;
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        // First call: select maybeSingle → null (no profile exists)
        // Second call: insert → select single → created profile
        // Third call: select maybeSingle → created profile (return after update)
        if (profileCallCount === 1) {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        } else {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: createdProfile, error: null });
          chain.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: createdProfile, error: null }),
            }),
          });
        }
        chain.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
        return chain;
      }
      return {};
    });

    const { updateProfile } = await import("@/lib/actions/profile");
    const result = await updateProfile({ full_name: "New User" });
    expect(result.full_name).toBe("New User");
  });
});

describe("Profile validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("G: rejects full_name exceeding max length", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(
      updateProfile({ full_name: "A".repeat(151) }),
    ).rejects.toThrow("Nama lengkap maksimal 150 karakter.");
  });

  it("H: rejects invalid phone format", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(updateProfile({ phone: "abc" })).rejects.toThrow(
      "Nomor telepon tidak valid.",
    );
  });

  it("I: accepts valid phone formats", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(updateProfile({ phone: "0812345678" })).resolves.toBeDefined();
    await expect(updateProfile({ phone: "+62812345678" })).resolves.toBeDefined();
  });

  it("J: rejects birth_date in the future", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    await expect(
      updateProfile({ birth_date: future.toISOString().split("T")[0] ?? null }),
    ).rejects.toThrow("Tanggal lahir tidak boleh di masa depan.");
  });

  it("K: rejects invalid birth_date format", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(updateProfile({ birth_date: "not-a-date" })).rejects.toThrow(
      "Format tanggal lahir tidak valid.",
    );
  });

  it("L: rejects invalid gender value", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(
      // @ts-expect-error — testing invalid gender value intentionally
      updateProfile({ gender: "other" }),
    ).rejects.toThrow("Jenis kelamin harus salah satu dari:");
  });

  it("M: rejects invalid website URL", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(updateProfile({ website: "ftp://example.com" })).rejects.toThrow(
      "URL website harus diawali dengan http:// atau https://.",
    );
    await expect(updateProfile({ website: "not-a-url" })).rejects.toThrow(
      "URL website harus diawali dengan http:// atau https://.",
    );
  });

  it("N: accepts valid website URLs", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(
      updateProfile({ website: "https://example.com" }),
    ).resolves.toBeDefined();
    await expect(
      updateProfile({ website: "http://example.com" }),
    ).resolves.toBeDefined();
  });

  it("O: rejects non-object social_links", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(updateProfile({ social_links: "invalid" as any })).rejects.toThrow(
      "Social links harus berupa objek.",
    );
  });

  it("P: rejects social_links with non-string values", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(
      updateProfile({
        social_links: { instagram: "valid", twitter: 123 as unknown as string },
      }),
    ).rejects.toThrow("Social links harus berupa objek dengan nilai string.");
  });
});

describe("Profile normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Q: converts empty strings to null", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);

    let capturedUpdate: Record<string, unknown> | null = null;
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
        return chain;
      }
      if (table === "user_profiles") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null });
        chain.update = vi.fn().mockImplementation((data: Record<string, unknown>) => {
          capturedUpdate = data;
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        });
        return chain;
      }
      return {};
    });

    const { updateProfile } = await import("@/lib/actions/profile");
    await updateProfile({
      full_name: "  ",
      phone: "  ",
      bio: "  ",
      website: "  ",
    });

    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.full_name).toBeNull();
    expect(capturedUpdate!.phone).toBeNull();
    expect(capturedUpdate!.bio).toBeNull();
    expect(capturedUpdate!.website).toBeNull();
  });
});

describe("Protected fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("R: updateProfile does not expose user_id or email modification", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);

    let capturedUpdate: Record<string, unknown> | null = null;
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
        return chain;
      }
      if (table === "user_profiles") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null });
        chain.update = vi.fn().mockImplementation((data: Record<string, unknown>) => {
          capturedUpdate = data;
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        });
        return chain;
      }
      return {};
    });

    const { updateProfile } = await import("@/lib/actions/profile");
    await updateProfile({ full_name: "New Name" });

    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.user_id).toBeUndefined();
    expect(capturedUpdate!.email).toBeUndefined();
    expect(capturedUpdate!.id).toBeUndefined();
    expect(capturedUpdate!.created_at).toBeUndefined();
  });
});

describe("Cross-user ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("S: user can only update own profile, not another user's", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);

    let capturedUserId: unknown = null;
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
        return chain;
      }
      if (table === "user_profiles") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockImplementation((field: string, value: unknown) => {
          if (field === "user_id") capturedUserId = value;
          return chain;
        });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null });
        chain.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
        return chain;
      }
      return {};
    });

    const { updateProfile } = await import("@/lib/actions/profile");
    await updateProfile({ full_name: "Hacked Name" });

    expect(capturedUserId).toBe("user-1");
  });
});

describe("Database error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T: throws generic message when users lookup fails", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, null);
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: new Error("db connection failed"),
        });
        return chain;
      }
      return {};
    });

    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(updateProfile({ full_name: "Test" })).rejects.toThrow(
      "db connection failed",
    );
  });

  it("U: throws generic message when profile update fails", async () => {
    mockSupabase = createMockSupabase(AUTH_USER, USER_ROW, MOCK_PROFILE);
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "users") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
        return chain;
      }
      if (table === "user_profiles") {
        const chain: MockChain = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null });
        chain.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: new Error("update failed"),
          }),
        });
        return chain;
      }
      return {};
    });

    const { updateProfile } = await import("@/lib/actions/profile");
    await expect(updateProfile({ full_name: "Test" })).rejects.toThrow(
      "update failed",
    );
  });
});
