import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SKIP = !SUPABASE_URL || !SERVICE_KEY || !ANON_KEY;

let admin: SupabaseClient<Database>;

const TEST_PREFIX = `MX-ADDR-${Date.now()}`;
const TEST_PASS = "AddrTest123!";

type TestUser = { id: string; email: string; auth_id: string };
let user1: TestUser;
let user2: TestUser;
let client1: SupabaseClient<Database>;
let client2: SupabaseClient<Database>;

const createdAddressIds: string[] = [];

async function cleanup() {
  if (!admin) return;
  // Delete in reverse FK order
  await admin.from("addresses").delete().like("label", `${TEST_PREFIX}%`);
}

async function createAuthedClient(
  email: string,
): Promise<SupabaseClient<Database> | null> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASS,
  });

  if (error) return null;
  return client;
}

describe.skipIf(SKIP)("Address security (integration)", () => {
  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await cleanup();

    // Create test users — invite, then set password
    const email1 = `${TEST_PREFIX}-buyer1@test.mx`;
    const email2 = `${TEST_PREFIX}-buyer2@test.mx`;

    const { data: auth1 } = await admin.auth.admin.inviteUserByEmail(email1, {
      data: { role: "buyer" },
    }).catch(() => ({ data: null }));

    const { data: auth2 } = await admin.auth.admin.inviteUserByEmail(email2, {
      data: { role: "buyer" },
    }).catch(() => ({ data: null }));

    if (!auth1?.user || !auth2?.user) {
      throw new Error("Cannot create test users. Check Supabase auth config.");
    }

    // Set passwords
    await admin.auth.admin.updateUserById(auth1.user.id, { password: TEST_PASS });
    await admin.auth.admin.updateUserById(auth2.user.id, { password: TEST_PASS });

    // Insert into public.users
    const { data: u1 } = await admin
      .from("users")
      .insert({
        email: `${TEST_PREFIX}-buyer1@test.mx`,
        auth_id: auth1.user.id,
        role: "buyer",
        status: "active",
      })
      .select("id")
      .single();

    const { data: u2 } = await admin
      .from("users")
      .insert({
        email: `${TEST_PREFIX}-buyer2@test.mx`,
        auth_id: auth2.user.id,
        role: "buyer",
        status: "active",
      })
      .select("id")
      .single();

    user1 = { id: u1!.id, email: `${TEST_PREFIX}-buyer1@test.mx`, auth_id: auth1.user.id };
    user2 = { id: u2!.id, email: `${TEST_PREFIX}-buyer2@test.mx`, auth_id: auth2.user.id };

    client1 = (await createAuthedClient(user1.email))!;
    client2 = (await createAuthedClient(user2.email))!;

    expect(client1).not.toBeNull();
    expect(client2).not.toBeNull();
  });

  afterAll(async () => {
    await cleanup();
    // Best-effort user cleanup — may fail if FK constraints exist
    if (user1) {
      await admin.auth.admin.deleteUser(user1.auth_id).catch(() => {});
    }
    if (user2) {
      await admin.auth.admin.deleteUser(user2.auth_id).catch(() => {});
    }
  });

  // ── C. SELECT own ──────────────────────────────────────────────────────

  it("user1 can read own addresses", async () => {
    const { data, error } = await client1
      .from("addresses")
      .insert({
        user_id: user1.id,
        label: `${TEST_PREFIX}-addr1`,
        recipient_name: "Test1",
        phone: "081111111111",
        address_detail: "Jl. Test 1",
        province: "DKI Jakarta",
        city: "Jakarta",
        district: "Menteng",
        postal_code: "10310",
        is_default: true,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();
    if (data?.id) createdAddressIds.push(data.id);

    const { data: read } = await client1
      .from("addresses")
      .select("id, label")
      .eq("id", data!.id!)
      .single();

    expect(read?.label).toBe(`${TEST_PREFIX}-addr1`);
  });

  it("user1 cannot read user2 addresses", async () => {
    // Create address as user2
    const { data } = await client2
      .from("addresses")
      .insert({
        user_id: user2.id,
        label: `${TEST_PREFIX}-addr2`,
        recipient_name: "Test2",
        phone: "082222222222",
        address_detail: "Jl. Test 2",
        province: "Jawa Barat",
        city: "Bandung",
        district: "Coblong",
        postal_code: "40132",
        is_default: true,
      })
      .select("id")
      .single();

    expect(data?.id).toBeDefined();
    if (data?.id) createdAddressIds.push(data.id);

    const { data: read } = await client1
      .from("addresses")
      .select("id")
      .eq("id", data!.id!);

    expect(read?.length).toBe(0);
  });

  // ── D. INSERT own ──────────────────────────────────────────────────────

  it("user1 can create own address", async () => {
    const { data, error } = await client1
      .from("addresses")
      .insert({
        user_id: user1.id,
        label: `${TEST_PREFIX}-new`,
        recipient_name: "New",
        phone: "081111111111",
        address_detail: "New addr",
        province: "DKI Jakarta",
        city: "Jakarta",
        district: "Menteng",
        postal_code: "10310",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();
    if (data?.id) createdAddressIds.push(data.id);
  });

  // ── H. user_id spoof blocked ───────────────────────────────────────────

  it("user1 cannot insert with user2 user_id", async () => {
    const { error } = await client1.from("addresses").insert({
      user_id: user2.id,
      label: `${TEST_PREFIX}-spoof`,
      recipient_name: "Hacker",
      phone: "000",
      address_detail: "Spoof",
      province: "Hack",
      city: "Hack",
      district: "Hack",
      postal_code: "00000",
    });

    // RLS WITH CHECK should block this
    expect(error).not.toBeNull();
  });

  // ── E. UPDATE own ──────────────────────────────────────────────────────

  it("user1 can update own address", async () => {
    const addrId = createdAddressIds[0]!;
    const { error } = await client1
      .from("addresses")
      .update({ label: `${TEST_PREFIX}-updated` })
      .eq("id", addrId);

    expect(error).toBeNull();
  });

  // ── F. UPDATE other blocked ────────────────────────────────────────────

  it("user1 cannot update user2 address", async () => {
    const user2Addr = createdAddressIds.find((id) => id !== createdAddressIds[0]);
    if (!user2Addr) return;

    await client1
      .from("addresses")
      .update({ label: "HACKED" })
      .eq("id", user2Addr);

    // Verify unchanged via admin
    const { data } = await admin
      .from("addresses")
      .select("label")
      .eq("id", user2Addr)
      .single();

    expect(data?.label).not.toBe("HACKED");
  });

  // ── G. DELETE own ──────────────────────────────────────────────────────

  it("user1 can delete own address", async () => {
    // Create a disposable address
    const { data } = await client1
      .from("addresses")
      .insert({
        user_id: user1.id,
        label: `${TEST_PREFIX}-del`,
        recipient_name: "Del",
        phone: "081111111111",
        address_detail: "Del addr",
        province: "DKI Jakarta",
        city: "Jakarta",
        district: "Menteng",
        postal_code: "10310",
      })
      .select("id")
      .single();

    expect(data?.id).toBeDefined();

    const { error } = await client1
      .from("addresses")
      .delete()
      .eq("id", data!.id);

    expect(error).toBeNull();

    const { data: check } = await admin
      .from("addresses")
      .select("id")
      .eq("id", data!.id);

    expect(check?.length).toBe(0);
  });

  // ── G. DELETE other blocked ────────────────────────────────────────────

  it("user1 cannot delete user2 address", async () => {
    const user2Addr = createdAddressIds.find((id) => id !== createdAddressIds[0]);
    if (!user2Addr) return;

    await client1
      .from("addresses")
      .delete()
      .eq("id", user2Addr);

    const { data } = await admin
      .from("addresses")
      .select("id")
      .eq("id", user2Addr);

    expect(data?.length).toBe(1);
  });

  // ── I. Default address ─────────────────────────────────────────────────

  it("only one default per user", async () => {
    // Create two addresses for user1
    const { data: a1 } = await client1
      .from("addresses")
      .insert({
        user_id: user1.id,
        label: `${TEST_PREFIX}-def1`,
        recipient_name: "D1",
        phone: "081111111111",
        address_detail: "D1",
        province: "DKI Jakarta",
        city: "Jakarta",
        district: "Menteng",
        postal_code: "10310",
        is_default: true,
      })
      .select("id")
      .single();

    const { data: a2 } = await client1
      .from("addresses")
      .insert({
        user_id: user1.id,
        label: `${TEST_PREFIX}-def2`,
        recipient_name: "D2",
        phone: "081111111111",
        address_detail: "D2",
        province: "DKI Jakarta",
        city: "Jakarta",
        district: "Menteng",
        postal_code: "10310",
        is_default: false,
      })
      .select("id")
      .single();

    if (a1?.id) createdAddressIds.push(a1.id);
    if (a2?.id) createdAddressIds.push(a2.id);

    expect(a1?.id).toBeDefined();
    expect(a2?.id).toBeDefined();

    // Manually set a2 as default (simulating server action logic)
    await client1
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", user1.id)
      .eq("is_default", true);

    await client1
      .from("addresses")
      .update({ is_default: true })
      .eq("id", a2!.id);

    // Verify only a2 is default
    const { data: defaults } = await client1
      .from("addresses")
      .select("id, is_default")
      .eq("user_id", user1.id)
      .eq("is_default", true);

    expect(defaults?.length).toBe(1);
    expect(defaults?.[0]?.id).toBe(a2!.id);
  });

  // ── Unauthenticated ────────────────────────────────────────────────────

  it("unauthenticated user cannot read addresses", async () => {
    const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data } = await anonClient.from("addresses").select("id");
    expect(data?.length).toBe(0);
  });

  // ── User A default doesn't affect User B ──────────────────────────────

  it("user1 default does not affect user2", async () => {
    const { data: user2Defaults } = await client2
      .from("addresses")
      .select("id, is_default")
      .eq("user_id", user2.id)
      .eq("is_default", true);

    // user2 should still have their own default
    expect(user2Defaults?.length).toBeGreaterThanOrEqual(1);
  });
});
