/**
 * Avatar — Unit Tests
 *
 * Tests cover:
 *   Authentication:
 *     1. unauthenticated upload rejected
 *     2. unauthenticated delete rejected
 *
 *   Upload validation:
 *     3. invalid MIME rejected
 *     4. SVG rejected
 *     5. oversized file rejected
 *     6. valid JPEG accepted
 *     7. valid PNG accepted
 *     8. valid WebP accepted
 *     9. extension derived from MIME, not filename
 *
 *   Ownership/path:
 *    10. path uses authenticated public.users.id
 *    11. caller cannot supply another user_id
 *    12. caller cannot supply arbitrary storage path
 *
 *   Upload behavior:
 *    13. storage upload called with avatars bucket
 *    14. deterministic avatar path used
 *    15. profile avatar_url updated after successful upload
 *    16. upload/storage failure handled safely
 *
 *   Delete behavior:
 *    17. authenticated user's avatar is deleted
 *    18. profile avatar_url cleared
 *    19. arbitrary path cannot be supplied
 *    20. delete failure handled safely
 *    21. deleting when no avatar exists is safe/idempotent
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Types ────────────────────────────────────────────────────────────

type MockChain = Record<string, ReturnType<typeof vi.fn>>;

let capturedUserProfilesChain: MockChain | null = null;

// ─── Mock Factory ──────────────────────────────────────────────────────────

function createMockSupabase(opts: {
  authUser?: { id: string } | null;
  userRow?: { id: string } | null;
  profile?: { avatar_url: string | null } | null;
  storageUploadError?: Error | null;
  storageRemoveError?: Error | null;
  dbUpdateError?: Error | null;
} = {}) {
  const {
    authUser = null,
    userRow = null,
    profile = null,
    storageUploadError = null,
    storageRemoveError = null,
    dbUpdateError = null,
  } = opts;

  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: authUser },
      error: authUser ? null : new Error("Not authenticated"),
    }),
  };

  let userProfilesCallCount = 0;

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
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: profile,
        error: null,
      });
      chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: dbUpdateError }),
      });
      chain.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: dbUpdateError }),
        }),
      });
      capturedUserProfilesChain = chain;
      return chain;
    }

    return {};
  });

  const mockStorageUpload = vi.fn().mockResolvedValue({
    data: { path: "user-1/avatar.jpg" },
    error: storageUploadError,
  });

  const mockStorageRemove = vi.fn().mockResolvedValue({
    data: null,
    error: storageRemoveError,
  });

  const mockStorageGetPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: "https://example.com/storage/v1/object/public/avatars/user-1/avatar.jpg" },
  });

  const mockStorageFrom = vi.fn().mockReturnValue({
    upload: mockStorageUpload,
    remove: mockStorageRemove,
    getPublicUrl: mockStorageGetPublicUrl,
  });

  return {
    auth: mockAuth,
    from: mockFrom,
    storage: { from: mockStorageFrom },
    _storageUpload: mockStorageUpload,
    _storageRemove: mockStorageRemove,
    _storageGetPublicUrl: mockStorageGetPublicUrl,
  };
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
const MOCK_PROFILE_WITH_AVATAR = {
  avatar_url: "https://example.com/storage/v1/object/public/avatars/user-1/avatar.jpg",
};
const MOCK_PROFILE_NO_AVATAR = {
  avatar_url: null as string | null,
};

function makeFile(
  type: string,
  name: string,
  size: number = 1024,
): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Avatar authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUserProfilesChain = null;
  });

  it("1: rejects unauthenticated upload", async () => {
    mockSupabase = createMockSupabase({ authUser: null });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    await expect(uploadAvatar(file)).rejects.toThrow("Silakan login terlebih dahulu.");
  });

  it("2: rejects unauthenticated delete", async () => {
    mockSupabase = createMockSupabase({ authUser: null });
    const { deleteAvatar } = await import("@/lib/actions/avatar");
    await expect(deleteAvatar()).rejects.toThrow("Silakan login terlebih dahulu.");
  });
});

describe("Upload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUserProfilesChain = null;
  });

  it("3: rejects invalid MIME type", async () => {
    mockSupabase = createMockSupabase({ authUser: AUTH_USER, userRow: USER_ROW });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("application/pdf", "doc.pdf");
    await expect(uploadAvatar(file)).rejects.toThrow(
      "Hanya file JPG, PNG, dan WebP yang diizinkan untuk avatar.",
    );
  });

  it("4: rejects SVG", async () => {
    mockSupabase = createMockSupabase({ authUser: AUTH_USER, userRow: USER_ROW });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/svg+xml", "icon.svg");
    await expect(uploadAvatar(file)).rejects.toThrow(
      "Hanya file JPG, PNG, dan WebP yang diizinkan untuk avatar.",
    );
  });

  it("5: rejects oversized file", async () => {
    mockSupabase = createMockSupabase({ authUser: AUTH_USER, userRow: USER_ROW });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "huge.jpg", 6 * 1024 * 1024);
    await expect(uploadAvatar(file)).rejects.toThrow(
      "Ukuran file avatar tidak boleh melebihi 5 MB.",
    );
  });

  it("6: accepts valid JPEG", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    const result = await uploadAvatar(file);
    expect(result.avatar_url).toContain("avatars/");
  });

  it("7: accepts valid PNG", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/png", "photo.png");
    const result = await uploadAvatar(file);
    expect(result.avatar_url).toContain("avatars/");
  });

  it("8: accepts valid WebP", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/webp", "photo.webp");
    const result = await uploadAvatar(file);
    expect(result.avatar_url).toContain("avatars/");
  });

  it("9: extension derived from MIME, not filename", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");

    const file = makeFile("image/png", "photo.jpg");
    await uploadAvatar(file);

    const uploadCall = mockSupabase._storageUpload;
    expect(uploadCall).toHaveBeenCalled();
    const filePath = uploadCall.mock.calls[0]![0] as string;
    expect(filePath).toMatch(/avatar\.png$/);
  });
});

describe("Ownership and path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUserProfilesChain = null;
  });

  it("10: path uses authenticated public.users.id", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    await uploadAvatar(file);

    const uploadCall = mockSupabase._storageUpload;
    const filePath = uploadCall.mock.calls[0]![0] as string;
    expect(filePath).toBe("user-1/avatar.jpg");
  });

  it("11: caller cannot supply another user_id", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    await uploadAvatar(file);

    const uploadCall = mockSupabase._storageUpload;
    const filePath = uploadCall.mock.calls[0]![0] as string;
    const userIdInPath = filePath.split("/")[0];
    expect(userIdInPath).toBe("user-1");
  });

  it("12: caller cannot supply arbitrary storage path", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    await uploadAvatar(file);

    const uploadCall = mockSupabase._storageUpload;
    const filePath = uploadCall.mock.calls[0]![0] as string;
    expect(filePath).toMatch(/^user-1\/avatar\.(jpg|png|webp)$/);
  });
});

describe("Upload behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUserProfilesChain = null;
  });

  it("13: storage upload called with avatars bucket", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    await uploadAvatar(file);

    expect(mockSupabase.storage.from).toHaveBeenCalledWith("avatars");
  });

  it("14: deterministic avatar path used", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/webp", "random-name.webp");
    await uploadAvatar(file);

    const uploadCall = mockSupabase._storageUpload;
    const filePath = uploadCall.mock.calls[0]![0] as string;
    expect(filePath).toBe("user-1/avatar.webp");
  });

  it("15: profile avatar_url updated after successful upload", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    await uploadAvatar(file);

    expect(capturedUserProfilesChain?.update).toHaveBeenCalled();
  });

  it("16: handles storage upload failure", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
      storageUploadError: new Error("Storage full"),
    });
    const { uploadAvatar } = await import("@/lib/actions/avatar");
    const file = makeFile("image/jpeg", "photo.jpg");
    await expect(uploadAvatar(file)).rejects.toThrow(
      "Gagal mengunggah avatar. Silakan coba lagi.",
    );
  });
});

describe("Delete behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUserProfilesChain = null;
  });

  it("17: deletes authenticated user's avatar", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_WITH_AVATAR,
    });
    const { deleteAvatar } = await import("@/lib/actions/avatar");
    await deleteAvatar();

    expect(mockSupabase._storageRemove).toHaveBeenCalledWith(["user-1/avatar.jpg"]);
  });

  it("18: clears profile avatar_url after delete", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_WITH_AVATAR,
    });
    const { deleteAvatar } = await import("@/lib/actions/avatar");
    await deleteAvatar();

    expect(capturedUserProfilesChain?.update).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: null }),
    );
  });

  it("19: arbitrary path cannot be supplied to delete", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_WITH_AVATAR,
    });
    const { deleteAvatar } = await import("@/lib/actions/avatar");
    await deleteAvatar();

    const removeCall = mockSupabase._storageRemove.mock.calls[0];
    const pathsArray = (removeCall as unknown[])[0] as string[];
    const objectPath = pathsArray[0];
    expect(typeof objectPath).toBe("string");
    expect(objectPath).not.toContain("..");
    expect(objectPath).toBe("user-1/avatar.jpg");
  });

  it("20: handles storage remove failure", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_WITH_AVATAR,
      storageRemoveError: new Error("Permission denied"),
    });
    const { deleteAvatar } = await import("@/lib/actions/avatar");
    await expect(deleteAvatar()).rejects.toThrow(
      "Gagal menghapus avatar dari penyimpanan.",
    );
  });

  it("21: deleting when no avatar exists is safe/idempotent", async () => {
    mockSupabase = createMockSupabase({
      authUser: AUTH_USER,
      userRow: USER_ROW,
      profile: MOCK_PROFILE_NO_AVATAR,
    });
    const { deleteAvatar } = await import("@/lib/actions/avatar");
    await expect(deleteAvatar()).resolves.toBeUndefined();
    expect(mockSupabase._storageRemove).not.toHaveBeenCalled();
  });
});
