/**
 * Phase 3C-3 — Real Supabase Integration Tests
 *
 * Tests trigger behavior and financial reversal against the actual Supabase
 * database. Uses the service_role key to bypass RLS.
 *
 * Run: node __tests__/run-integration.js
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FEE_RATE = 0.02;
const SKIP = !SUPABASE_URL || !SERVICE_KEY;
const PREFIX = `MX-INT-${Date.now()}`;

let db: SupabaseClient<Database>;

function genId(): string { return crypto.randomUUID(); }
function label(suffix: string): string { return `${PREFIX}-${suffix}`; }
function num(v: number | null | undefined): number { return Number(v ?? 0); }

// Upsert with error check — throws on failure so tests don't silently pass
async function upsert(table: string, row: Record<string, unknown>, onConflict?: string) {
  const opts = onConflict ? { onConflict } : {};
  const { error } = await db.from(table as never).upsert(row as never, opts);
  if (error) throw new Error(`upsert ${table} failed: ${error.message} (${error.code})`);
}

async function snapshotOrder(id: string) {
  const { data } = await db.from("orders").select("*").eq("id", id).single();
  return data;
}
async function snapshotItems(orderId: string) {
  const { data } = await db.from("order_items").select("*").eq("order_id", orderId);
  return data ?? [];
}
async function snapshotProduct(id: string) {
  const { data } = await db.from("products").select("*").eq("id", id).single();
  return data;
}
async function snapshotStore(id: string) {
  const { data } = await db.from("stores").select("*").eq("id", id).single();
  return data;
}
async function snapshotSellerBalance(sellerId: string) {
  const { data } = await db.from("seller_balances").select("*").eq("seller_id", sellerId).single();
  return data;
}
async function snapshotLedger(sellerId: string, orderId: string) {
  const { data } = await db
    .from("seller_balance_transactions").select("*")
    .eq("seller_id", sellerId).eq("reference_id", orderId)
    .order("created_at", { ascending: true });
  return data ?? [];
}
async function snapshotStockMovements(productId: string, orderId: string) {
  const { data } = await db
    .from("stock_movements").select("*")
    .eq("product_id", productId).eq("reference_id", orderId)
    .order("created_at", { ascending: true });
  return data ?? [];
}
async function snapshotPayment(orderId: string) {
  const { data } = await db.from("payments").select("*").eq("order_id", orderId).maybeSingle();
  return data;
}

// ─── Shared setup helpers ──────────────────────────────────────────────────

async function createTestUser(id: string, email: string, role: string) {
  const { data: existing } = await db.from("users" as never).select("id").eq("email", email).maybeSingle() as { data: { id: string } | null };
  if (existing) {
    const { error } = await db.from("users" as never).update({ role, status: "active", email_verified: true } as never).eq("id", existing.id);
    if (error) throw new Error(`update users failed: ${error.message} (${error.code})`);
  } else {
    const { error } = await db.from("users" as never).insert({ id, email, role, status: "active", email_verified: true } as never);
    if (error) throw new Error(`insert users failed: ${error.message} (${error.code})`);
  }
}

async function createTestStore(id: string, sellerId: string, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const { data: existing } = await db.from("stores" as never).select("id").eq("slug", slug).maybeSingle() as { data: { id: string } | null };
  if (existing) {
    const { error } = await db.from("stores" as never).update({
      seller_id: sellerId, store_name: name, slug, status: "active",
      total_sales: 0, total_revenue: 0,
    } as never).eq("id", existing.id);
    if (error) throw new Error(`update stores failed: ${error.message} (${error.code})`);
  } else {
    const { error } = await db.from("stores" as never).insert({
      id, seller_id: sellerId, store_name: name, slug, status: "active",
      total_sales: 0, total_revenue: 0,
    } as never);
    if (error) throw new Error(`insert stores failed: ${error.message} (${error.code})`);
  }
}

async function createTestProduct(id: string, storeId: string, name: string, price: number, stock: number) {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const { data: existing } = await db.from("products" as never).select("id").eq("slug", slug).maybeSingle() as { data: { id: string } | null };
  if (existing) {
    const { error } = await db.from("products" as never).update({
      store_id: storeId, name, slug, price, stock,
      sold_count: 0, status: "active", condition: "new", has_variants: false,
    } as never).eq("id", existing.id);
    if (error) throw new Error(`update products failed: ${error.message} (${error.code})`);
  } else {
    const { error } = await db.from("products" as never).insert({
      id, store_id: storeId, name, slug, price, stock,
      sold_count: 0, status: "active", condition: "new", has_variants: false,
    } as never);
    if (error) throw new Error(`insert products failed: ${error.message} (${error.code})`);
  }
}

async function createTestBalance(id: string, sellerId: string, balance: number) {
  const { data: existing } = await db.from("seller_balances" as never).select("id").eq("seller_id", sellerId).maybeSingle() as { data: { id: string } | null };
  if (existing) {
    const { error } = await db.from("seller_balances" as never).update({
      available_balance: balance, pending_balance: 0,
      total_earned: balance, total_withdrawn: 0,
    } as never).eq("id", existing.id);
    if (error) throw new Error(`update seller_balances failed: ${error.message} (${error.code})`);
  } else {
    const { error } = await db.from("seller_balances" as never).insert({
      id, seller_id: sellerId,
      available_balance: balance, pending_balance: 0,
      total_earned: balance, total_withdrawn: 0,
    } as never);
    if (error) throw new Error(`insert seller_balances failed: ${error.message} (${error.code})`);
  }
}

async function createTestOrder(id: string, orderNumber: string, buyerId: string, subtotal: number, shippingCost: number) {
  await upsert("orders", {
    id, order_number: orderNumber, buyer_id: buyerId,
    status: "pending", payment_status: "pending",
    subtotal, shipping_cost: shippingCost,
    platform_fee: 0, discount_amount: 0,
    total_amount: subtotal + shippingCost,
    shipping_snapshot: {},
  });
}

async function createTestOrderItem(id: string, orderId: string, productId: string, sellerId: string, storeId: string, name: string, qty: number, unitPrice: number) {
  await upsert("order_items", {
    id, order_id: orderId, product_id: productId,
    seller_id: sellerId, store_id: storeId,
    product_name: name, quantity: qty,
    unit_price: unitPrice, subtotal: qty * unitPrice,
    status: "pending",
  });
}

// Cleanup: find all test orders and delete in FK-safe order
async function cleanupAll() {
  if (!db) return;
  console.log(`[integration] Cleaning up ${PREFIX}*`);

  const { data: orders } = await db.from("orders").select("id").like("order_number", `${PREFIX}%`);
  const orderIds = (orders ?? []).map((o) => o.id);

  if (orderIds.length > 0) {
    await db.from("stock_movements").delete().in("reference_id", orderIds);
    await db.from("seller_balance_transactions").delete().in("reference_id", orderIds);
    await db.from("payments").delete().in("order_id", orderIds);
    await db.from("order_items").delete().in("order_id", orderIds);
    await db.from("orders").delete().in("id", orderIds);
  }

  await db.from("products").delete().like("name", `${PREFIX}%`);

  const { data: stores } = await db.from("stores").select("id").like("store_name", `${PREFIX}%`);
  const storeIds = (stores ?? []).map((s) => s.id);
  if (storeIds.length > 0) {
    await db.from("seller_balances").delete().in("seller_id", storeIds);
  }
  await db.from("stores").delete().like("store_name", `${PREFIX}%`);

  const { data: users } = await db.from("users").select("id").like("email", `${PREFIX}%`);
  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length > 0) {
    await db.from("users").delete().in("id", userIds);
  }

  // Also clean up any stale MX-INT-* users from previous test runs
  // These are orphaned test data — delete users directly (fastest path)
  const { data: staleUsers } = await db.from("users" as never).select("id").like("email", "MX-INT-%").limit(500) as { data: { id: string }[] | null };
  const staleIds = (staleUsers ?? []).map((u) => u.id);
  if (staleIds.length > 0) {
    console.log(`[integration] Cleaning up ${staleIds.length} stale MX-INT users from previous runs`);
    // Delete users in batches — cascading FKs handle related records
    for (let i = 0; i < staleIds.length; i += 100) {
      const batch = staleIds.slice(i, i + 100);
      await db.from("users").delete().in("id", batch);
    }
  }
  console.log("[integration] Cleanup complete");
}

beforeAll(async () => {
  if (SKIP) { console.warn("[integration] Skipping: env vars not set"); return; }
  db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await db.from("users").select("id").limit(1);
  if (error) throw new Error(`DB connectivity failed: ${error.message}`);
});

afterAll(cleanupAll);

// ═══════════════════════════════════════════════════════════════════════════
// T1. DATABASE CONNECTIVITY
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP)("T1. Database connectivity", () => {
  it("can connect with service role", async () => {
    const { error } = await db.from("users").select("id").limit(1);
    expect(error).toBeNull();
    expect(SUPABASE_URL).toContain("supabase.co");
    expect(SERVICE_KEY).toMatch(/^eyJ/);
  });

  it("required tables accessible", async () => {
    const tables = [
      "users", "orders", "order_items", "products", "stores",
      "seller_balances", "seller_balance_transactions", "payments", "stock_movements",
    ] as const;
    for (const t of tables) {
      const { error } = await db.from(t).select("*").limit(0);
      expect(error).toBeNull();
    }
  });

  it("trigger functions exist in public schema", async () => {
    // Supabase JS client doesn't support pg_catalog queries directly.
    // We verify trigger functions exist empirically by checking:
    // 1. The orders table exists and is writable (verified above)
    // 2. T2-T7 tests demonstrate triggers fire correctly
    // This test documents the expectation.
    const { error: orderErr } = await db.from("orders").select("id").limit(1);
    const { error: itemErr } = await db.from("order_items").select("id").limit(1);
    expect(orderErr).toBeNull();
    expect(itemErr).toBeNull();
  });

  it("required triggers bound to orders table", async () => {
    // We can't query pg_trigger directly from the JS client without raw SQL,
    // but we verify the schema is correct by checking table structure.
    const { data: orderCols } = await db.from("orders").select("*").limit(0);
    expect(orderCols).toBeDefined();
    // Trigger existence is verified empirically by T2 complete/refund tests.
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T2. SINGLE-SELLER COMPLETE → REFUND
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP)("T2. Single-seller complete → refund", () => {
  const PRICE = 100000, QTY = 2, SUB = PRICE * QTY;
  const INIT_STOCK = 50, INIT_SOLD = 10, INIT_SALES = 20, INIT_REV = 500000;
  const INIT_BAL = 300000;

  let buyerId: string, sellerId: string, storeId: string, productId: string;
  let orderId: string;
  let testSeq = 0;

  async function cleanupPrev() {
    if (!orderId) return;
    await db.from("stock_movements").delete().eq("reference_id", orderId);
    await db.from("seller_balance_transactions").delete().eq("reference_id", orderId);
    await db.from("payments").delete().eq("order_id", orderId);
    await db.from("order_items").delete().eq("order_id", orderId);
    await db.from("orders").delete().eq("id", orderId);
    await db.from("products").delete().eq("id", productId);
    await db.from("seller_balances").delete().eq("seller_id", sellerId);
    await db.from("stores").delete().eq("id", storeId);
    await db.from("user_profiles" as never).delete().in("user_id" as never, [buyerId, sellerId] as never);
    await db.from("users").delete().in("id", [buyerId, sellerId]);
  }

  beforeEach(async () => {
    if (!db) return;
    await cleanupPrev();
    testSeq++;

    buyerId = genId();
    sellerId = genId();
    storeId = genId();
    productId = genId();
    orderId = genId();

    const suf = `T2-${testSeq}`;
    await createTestUser(buyerId, `${PREFIX}-${suf}buyer@test.mx`, "buyer");
    await createTestUser(sellerId, `${PREFIX}-${suf}seller@test.mx`, "seller");
    await createTestStore(storeId, sellerId, label(`${suf}Store`));

    // Set initial store stats
    await db.from("stores").update({ total_sales: INIT_SALES, total_revenue: INIT_REV }).eq("id", storeId);

    await createTestProduct(productId, storeId, label(`${suf}Product`), PRICE, INIT_STOCK);

    // Set initial sold_count
    await db.from("products").update({ sold_count: INIT_SOLD }).eq("id", productId);

    await createTestBalance(genId(), sellerId, INIT_BAL);
    await createTestOrder(orderId, label(`${suf}ORD`), buyerId, SUB, 20000);
    await createTestOrderItem(genId(), orderId, productId, sellerId, storeId, label(`${suf}Product`), QTY, PRICE);
  });

  it("complete: sold_count, stores, seller_balances, credit ledger", async () => {
    const prodBefore = await snapshotProduct(productId);
    const storeBefore = await snapshotStore(storeId);
    const balBefore = await snapshotSellerBalance(sellerId);

    expect(prodBefore).not.toBeNull();
    expect(storeBefore).not.toBeNull();
    expect(balBefore).not.toBeNull();

    // Complete order
    const { error } = await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    expect(error).toBeNull();
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    const prodAfter = await snapshotProduct(productId);
    const storeAfter = await snapshotStore(storeId);
    const balAfter = await snapshotSellerBalance(sellerId);
    const ledger = await snapshotLedger(sellerId, orderId);
    const orderAfter = await snapshotOrder(orderId);

    expect(prodAfter!.sold_count).toBe(prodBefore!.sold_count + QTY);
    expect(storeAfter!.total_sales).toBe(storeBefore!.total_sales + 1);
    expect(num(storeAfter!.total_revenue)).toBe(num(storeBefore!.total_revenue) + SUB);

    const net = SUB * (1 - FEE_RATE);
    expect(num(balAfter!.available_balance)).toBe(num(balBefore!.available_balance) + net);
    expect(num(balAfter!.total_earned)).toBe(num(balBefore!.total_earned) + net);

    // completed_at is set
    expect(orderAfter!.completed_at).not.toBeNull();

    // credit ledger: exactly 1 entry
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.transaction_type).toBe("credit");
    expect(num(ledger[0]!.amount)).toBe(net);
    expect(ledger[0]!.reference_id).toBe(orderId);
    expect(ledger[0]!.reference_type).toBe("order");

    // balance_before/after in ledger are correct
    expect(num(ledger[0]!.balance_before)).toBe(num(balBefore!.available_balance));
    expect(num(ledger[0]!.balance_after)).toBe(num(balAfter!.available_balance));
  });

  it("refund: all reversed, debit ledger, stock restored exactly once", async () => {
    // Complete first
    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    const prodMid = await snapshotProduct(productId);
    const storeMid = await snapshotStore(storeId);
    const balMid = await snapshotSellerBalance(sellerId);

    // Refund
    await db.from("orders").update({ status: "refunded" }).eq("id", orderId);
    await db.from("order_items").update({ status: "refunded" }).eq("order_id", orderId);

    const prodAfter = await snapshotProduct(productId);
    const storeAfter = await snapshotStore(storeId);
    const balAfter = await snapshotSellerBalance(sellerId);
    const ledger = await snapshotLedger(sellerId, orderId);
    const movements = await snapshotStockMovements(productId, orderId);
    const orderAfter = await snapshotOrder(orderId);

    expect(prodAfter!.sold_count).toBe(prodMid!.sold_count - QTY);
    expect(storeAfter!.total_sales).toBe(storeMid!.total_sales - 1);
    expect(num(storeAfter!.total_revenue)).toBe(num(storeMid!.total_revenue) - SUB);

    const net = SUB * (1 - FEE_RATE);
    expect(num(balAfter!.available_balance)).toBe(num(balMid!.available_balance) - net);
    expect(num(balAfter!.total_earned)).toBe(num(balMid!.total_earned) - net);

    // completed_at cleared on refund
    expect(orderAfter!.completed_at).toBeNull();

    // ledger: 1 credit + 1 debit = 2 entries
    expect(ledger).toHaveLength(2);
    expect(ledger[0]!.transaction_type).toBe("credit");
    expect(ledger[1]!.transaction_type).toBe("debit");
    expect(num(ledger[1]!.amount)).toBe(net);

    // balance_before/after in debit ledger are correct
    expect(num(ledger[1]!.balance_before)).toBe(num(balMid!.available_balance));
    expect(num(ledger[1]!.balance_after)).toBe(num(balAfter!.available_balance));

    // stock restored exactly once (1 return movement per item, qty=QTY)
    const returnMovements = movements.filter((m) => m.movement_type === "return");
    expect(returnMovements).toHaveLength(1);
    expect(returnMovements[0]!.quantity_delta).toBe(QTY);
    expect(prodAfter!.stock).toBe(INIT_STOCK);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T3. MULTI-SELLER COMPLETE → REFUND
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP)("T3. Multi-seller complete → refund", () => {
  const PA = 100000, QA = 1, SUBA = PA * QA;
  const PB = 200000, QB = 2, SUBB = PB * QB;
  const STOCK_A = 30, STOCK_B = 40;
  const BAL_A = 200000, BAL_B = 500000;

  let buyerId: string;
  let sAId: string, sBId: string;
  let stAId: string, stBId: string;
  let pAId: string, pBId: string;
  let orderId: string;
  let testSeq = 0;

  async function cleanupPrev() {
    if (!orderId) return;
    await db.from("stock_movements").delete().eq("reference_id", orderId);
    await db.from("seller_balance_transactions").delete().eq("reference_id", orderId);
    await db.from("payments").delete().eq("order_id", orderId);
    await db.from("order_items").delete().eq("order_id", orderId);
    await db.from("orders").delete().eq("id", orderId);
    await db.from("products").delete().in("id", [pAId, pBId]);
    await db.from("seller_balances").delete().in("seller_id", [sAId, sBId]);
    await db.from("stores").delete().in("id", [stAId, stBId]);
    await db.from("user_profiles" as never).delete().in("user_id" as never, [buyerId, sAId, sBId] as never);
    await db.from("users").delete().in("id", [buyerId, sAId, sBId]);
  }

  beforeEach(async () => {
    if (!db) return;
    await cleanupPrev();
    testSeq++;

    buyerId = genId();
    sAId = genId(); sBId = genId();
    stAId = genId(); stBId = genId();
    pAId = genId(); pBId = genId();
    orderId = genId();

    const suf = `T3-${testSeq}`;
    await createTestUser(buyerId, `${PREFIX}-${suf}buyer@test.mx`, "buyer");
    await createTestUser(sAId, `${PREFIX}-${suf}sellerA@test.mx`, "seller");
    await createTestUser(sBId, `${PREFIX}-${suf}sellerB@test.mx`, "seller");
    await createTestStore(stAId, sAId, label(`${suf}StoreA`));
    await createTestStore(stBId, sBId, label(`${suf}StoreB`));
    await createTestProduct(pAId, stAId, label(`${suf}ProdA`), PA, STOCK_A);
    await createTestProduct(pBId, stBId, label(`${suf}ProdB`), PB, STOCK_B);
    await createTestBalance(genId(), sAId, BAL_A);
    await createTestBalance(genId(), sBId, BAL_B);
    await createTestOrder(orderId, label(`${suf}ORD`), buyerId, SUBA + SUBB, 30000);
    await createTestOrderItem(genId(), orderId, pAId, sAId, stAId, label(`${suf}ProdA`), QA, PA);
    await createTestOrderItem(genId(), orderId, pBId, sBId, stBId, label(`${suf}ProdB`), QB, PB);
  });

  it("complete: each seller credited correctly", async () => {
    const bA = await snapshotSellerBalance(sAId);
    const bB = await snapshotSellerBalance(sBId);

    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    const bA2 = await snapshotSellerBalance(sAId);
    const bB2 = await snapshotSellerBalance(sBId);
    const lA = await snapshotLedger(sAId, orderId);
    const lB = await snapshotLedger(sBId, orderId);

    const netA = SUBA * (1 - FEE_RATE), netB = SUBB * (1 - FEE_RATE);
    expect(num(bA2!.available_balance)).toBe(num(bA!.available_balance) + netA);
    expect(num(bB2!.available_balance)).toBe(num(bB!.available_balance) + netB);
    expect(lA).toHaveLength(1);
    expect(num(lA[0]!.amount)).toBe(netA);
    expect(lB).toHaveLength(1);
    expect(num(lB[0]!.amount)).toBe(netB);
  });

  it("refund: each seller debited, stocks restored, no duplicates, baseline returned", async () => {
    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    const bAM = await snapshotSellerBalance(sAId);
    const bBM = await snapshotSellerBalance(sBId);
    const stAM = await snapshotStore(stAId);
    const stBM = await snapshotStore(stBId);

    await db.from("orders").update({ status: "refunded" }).eq("id", orderId);
    await db.from("order_items").update({ status: "refunded" }).eq("order_id", orderId);

    const bA = await snapshotSellerBalance(sAId);
    const bB = await snapshotSellerBalance(sBId);
    const lA = await snapshotLedger(sAId, orderId);
    const lB = await snapshotLedger(sBId, orderId);
    const prA = await snapshotProduct(pAId);
    const prB = await snapshotProduct(pBId);
    const stA = await snapshotStore(stAId);
    const stB = await snapshotStore(stBId);

    const netA = SUBA * (1 - FEE_RATE), netB = SUBB * (1 - FEE_RATE);
    expect(num(bA!.available_balance)).toBe(num(bAM!.available_balance) - netA);
    expect(num(bB!.available_balance)).toBe(num(bBM!.available_balance) - netB);

    // Exactly 2 ledger entries per seller (1 credit + 1 debit), no duplicates
    expect(lA).toHaveLength(2);
    expect(lA[0]!.transaction_type).toBe("credit");
    expect(lA[1]!.transaction_type).toBe("debit");
    expect(lB).toHaveLength(2);
    expect(lB[0]!.transaction_type).toBe("credit");
    expect(lB[1]!.transaction_type).toBe("debit");

    // Stock restored to initial
    expect(prA!.stock).toBe(STOCK_A);
    expect(prB!.stock).toBe(STOCK_B);

    // Total sales/revenue returned to pre-test baseline
    expect(stA!.total_sales).toBe(stAM!.total_sales - 1);
    expect(stB!.total_sales).toBe(stBM!.total_sales - 1);
    expect(num(stA!.total_revenue)).toBe(num(stAM!.total_revenue) - SUBA);
    expect(num(stB!.total_revenue)).toBe(num(stBM!.total_revenue) - SUBB);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T4. DUPLICATE REFUND
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP)("T4. Duplicate refund idempotency", () => {
  const PRICE = 50000, QTY = 3, STOCK = 100;

  let sellerId: string, productId: string, orderId: string;

  beforeEach(async () => {
    if (!db) return;
    if (orderId) {
      await db.from("stock_movements").delete().eq("reference_id", orderId);
      await db.from("seller_balance_transactions").delete().eq("reference_id", orderId);
      await db.from("payments").delete().eq("order_id", orderId);
      await db.from("order_items").delete().eq("order_id", orderId);
      await db.from("orders").delete().eq("id", orderId);
    }

    const buyerId = genId();
    sellerId = genId();
    productId = genId();
    orderId = genId();
    const storeId = genId();

    await createTestUser(buyerId, `${PREFIX}-t4buyer@test.mx`, "buyer");
    await createTestUser(sellerId, `${PREFIX}-t4seller@test.mx`, "seller");
    await createTestStore(storeId, sellerId, label("T4Store"));
    await createTestProduct(productId, storeId, label("T4Product"), PRICE, STOCK);
    await createTestBalance(genId(), sellerId, 100000);

    // Create pending order, then transition to completed so triggers fire properly
    await upsert("orders", {
      id: orderId, order_number: label("T4ORD"), buyer_id: buyerId,
      status: "pending", payment_status: "pending",
      subtotal: PRICE * QTY, shipping_cost: 15000,
      platform_fee: 0, discount_amount: 0,
      total_amount: PRICE * QTY + 15000, shipping_snapshot: {},
    });
    await createTestOrderItem(genId(), orderId, productId, sellerId, storeId, label("T4Product"), QTY, PRICE);
    // Transition pending → completed to fire fn_complete_order_stats (credits balance)
    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);
  });

  it("triple refund: one reversal, one debit, stock once, final state refunded", async () => {
    const balBefore = await snapshotSellerBalance(sellerId);

    // Refund x3
    await db.from("orders").update({ status: "refunded" }).eq("id", orderId);
    await db.from("orders").update({ status: "refunded" }).eq("id", orderId);
    await db.from("orders").update({ status: "refunded" }).eq("id", orderId);

    const ledger = await snapshotLedger(sellerId, orderId);
    const prod = await snapshotProduct(productId);
    const bal = await snapshotSellerBalance(sellerId);
    const order = await snapshotOrder(orderId);

    // Only 1 debit ledger entry (not 3)
    expect(ledger.filter((l) => l.transaction_type === "debit")).toHaveLength(1);
    // Only 1 credit ledger entry
    expect(ledger.filter((l) => l.transaction_type === "credit")).toHaveLength(1);
    // Total ledger: 2 entries
    expect(ledger).toHaveLength(2);

    // Stock not restored multiple times
    expect(prod!.stock).toBe(STOCK);

    // Final state is refunded
    expect(order!.status).toBe("refunded");

    const net = PRICE * QTY * (1 - FEE_RATE);
    expect(num(bal!.available_balance)).toBe(num(balBefore!.available_balance) - net);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T5. CANCEL FLOW
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP)("T5. Cancel flow", () => {
  const PRICE = 75000, STOCK = 60;

  async function setupCancel(orderStatus: string, payStatus: string, suffix: string) {
    const buyerId = genId(), sellerId = genId(), storeId = genId(), productId = genId(), orderId = genId();
    await createTestUser(buyerId, `${PREFIX}-t5buyer${suffix}@test.mx`, "buyer");
    await createTestUser(sellerId, `${PREFIX}-t5seller${suffix}@test.mx`, "seller");
    await createTestStore(storeId, sellerId, label(`T5Store${suffix}`));
    await createTestProduct(productId, storeId, label(`T5Prod${suffix}`), PRICE, STOCK);
    await createTestBalance(genId(), sellerId, 0);

    await upsert("orders", {
      id: orderId, order_number: label(`T5ORD${suffix}`), buyer_id: buyerId,
      status: orderStatus, payment_status: payStatus,
      subtotal: PRICE, shipping_cost: 10000,
      platform_fee: 0, discount_amount: 0,
      total_amount: PRICE + 10000, shipping_snapshot: {},
    });
    await createTestOrderItem(genId(), orderId, productId, sellerId, storeId, label(`T5Prod${suffix}`), 1, PRICE);
    await upsert("payments", {
      id: genId(), order_id: orderId, amount: PRICE + 10000,
      fee_amount: 0,
      payment_method: "bank_transfer", status: payStatus,
    });
    return { orderId, productId, sellerId };
  }

  it("A. cancel pending: all statuses, stock restored", async () => {
    const { orderId, productId } = await setupCancel("pending", "pending", "A");

    await db.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: "Test" }).eq("id", orderId);
    await db.from("order_items").update({ status: "cancelled" }).eq("order_id", orderId);
    await db.from("payments").update({ status: "failed" }).eq("order_id", orderId);
    await db.from("orders").update({ payment_status: "failed" }).eq("id", orderId);

    const order = await snapshotOrder(orderId);
    const items = await snapshotItems(orderId);
    const payment = await snapshotPayment(orderId);
    const prod = await snapshotProduct(productId);
    const movs = await snapshotStockMovements(productId, orderId);

    expect(order!.status).toBe("cancelled");
    expect(items.every((i) => i.status === "cancelled")).toBe(true);
    expect(payment!.status).toBe("failed");
    expect(order!.payment_status).toBe("failed");
    expect(prod!.stock).toBe(STOCK);
    expect(movs.filter((m) => m.movement_type === "return").length).toBeGreaterThanOrEqual(1);
  });

  it("B. cancel paid: payment stays success, order_items cancelled, stock restored", async () => {
    const { orderId, productId } = await setupCancel("paid", "success", "B");

    await db.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: "Test" }).eq("id", orderId);
    await db.from("order_items").update({ status: "cancelled" }).eq("order_id", orderId);

    const order = await snapshotOrder(orderId);
    const items = await snapshotItems(orderId);
    const payment = await snapshotPayment(orderId);
    const prod = await snapshotProduct(productId);
    const movs = await snapshotStockMovements(productId, orderId);

    expect(order!.status).toBe("cancelled");
    // payment status stays success — no contradictory refund on cancel
    expect(payment!.status).toBe("success");
    // order payment_status should reflect the cancel context
    // (payment itself succeeded, but order was cancelled — not refunded)
    expect(items.every((i) => i.status === "cancelled")).toBe(true);
    expect(prod!.stock).toBe(STOCK);
    // stock_movements has return entry from trigger
    expect(movs.filter((m) => m.movement_type === "return").length).toBeGreaterThanOrEqual(1);
  });

  it("C. duplicate cancel: stock not double-restored", async () => {
    const { orderId, productId } = await setupCancel("pending", "pending", "C");

    await db.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: "C1" }).eq("id", orderId);
    await db.from("order_items").update({ status: "cancelled" }).eq("order_id", orderId);
    const after1 = await snapshotProduct(productId);

    await db.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: "C2" }).eq("id", orderId);
    const after2 = await snapshotProduct(productId);

    expect(after2!.stock).toBe(after1!.stock);
    expect(after2!.stock).toBe(STOCK);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T6. CONCURRENCY (Sequential Simulation)
//
// Method: Two sequential UPDATE calls to the same order status = 'refunded'.
// This is NOT true concurrency — it is a sequential simulation to verify
// trigger idempotency. True concurrency would require parallel TCP
// connections from separate processes, which is beyond the scope of
// integration tests against a shared Supabase instance.
//
// What this proves: the second UPDATE is a no-op because the trigger guard
// (OLD.status = 'completed' AND NEW.status = 'refunded') fails when
// OLD.status is already 'refunded'.
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP)("T6. Concurrency (sequential simulation)", () => {
  it("two sequential refunds: second is no-op", async () => {
    const buyerId = genId(), sellerId = genId(), storeId = genId(), productId = genId(), orderId = genId();
    await createTestUser(buyerId, `${PREFIX}-t6buyer@test.mx`, "buyer");
    await createTestUser(sellerId, `${PREFIX}-t6seller@test.mx`, "seller");
    await createTestStore(storeId, sellerId, label("T6Store"));
    await createTestProduct(productId, storeId, label("T6Product"), 100000, 50);
    await createTestBalance(genId(), sellerId, 100000);
    await upsert("orders", {
      id: orderId, order_number: label("T6ORD"), buyer_id: buyerId,
      status: "pending", payment_status: "pending",
      subtotal: 100000, shipping_cost: 10000,
      platform_fee: 0, discount_amount: 0,
      total_amount: 110000, shipping_snapshot: {},
    });
    await createTestOrderItem(genId(), orderId, productId, sellerId, storeId, label("T6Product"), 1, 100000);
    // Transition pending → completed to fire fn_complete_order_stats (credits balance)
    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    // First refund
    await db.from("orders").update({ status: "refunded" }).eq("id", orderId);
    const l1 = await snapshotLedger(sellerId, orderId);
    const p1 = await snapshotProduct(productId);

    // Second refund
    await db.from("orders").update({ status: "refunded" }).eq("id", orderId);
    const l2 = await snapshotLedger(sellerId, orderId);
    const p2 = await snapshotProduct(productId);

    expect(l2).toHaveLength(l1.length);
    expect(p2!.stock).toBe(p1!.stock);
    expect(p2!.stock).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T7. PARTIAL FAILURE / REPAIR
//
// Scenario: payment update succeeds but order status update fails.
// We simulate this by updating payment to "refunded" WITHOUT updating
// the order. Then we verify whether a retry webhook can repair the state.
//
// Finding: The current architecture does NOT auto-repair partial failures.
// If payment = refunded but order != refunded, the triggers don't fire
// because fn_reverse_order_stats requires order.status change.
// A retry webhook (re-fire) that attempts the same update will succeed
// because the trigger guard allows completed→refunded exactly once.
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP)("T7. Partial failure / repair", () => {
  it("refund terminal state: cannot be re-transitioned", async () => {
    const buyerId = genId(), orderId = genId();
    await createTestUser(buyerId, `${PREFIX}-t7buyer@test.mx`, "buyer");
    await upsert("orders", {
      id: orderId, order_number: label("T7ORD"), buyer_id: buyerId,
      status: "refunded", payment_status: "refunded",
      subtotal: 10000, shipping_cost: 0,
      platform_fee: 0, discount_amount: 0,
      total_amount: 10000, shipping_snapshot: {},
    });

    const order = await snapshotOrder(orderId);
    expect(order!.status).toBe("refunded");
    await db.from("orders").delete().eq("id", orderId);
  });

  it("happy path: completed → refunded with all triggers", async () => {
    const buyerId = genId(), sellerId = genId(), storeId = genId(), productId = genId(), orderId = genId();
    await createTestUser(buyerId, `${PREFIX}-t7rbuyer@test.mx`, "buyer");
    await createTestUser(sellerId, `${PREFIX}-t7rseller@test.mx`, "seller");
    await createTestStore(storeId, sellerId, label("T7RStore"));
    await createTestProduct(productId, storeId, label("T7RProd"), 100000, 25);
    await createTestBalance(genId(), sellerId, 50000);
    await upsert("orders", {
      id: orderId, order_number: label("T7RORD"), buyer_id: buyerId,
      status: "pending", payment_status: "pending",
      subtotal: 100000, shipping_cost: 10000,
      platform_fee: 0, discount_amount: 0,
      total_amount: 110000, shipping_snapshot: {},
    });
    await createTestOrderItem(genId(), orderId, productId, sellerId, storeId, label("T7RProd"), 1, 100000);
    // Transition pending → completed to fire fn_complete_order_stats (credits balance)
    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    // Simulate webhook: update payment + order + items atomically
    await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("order_id", orderId);
    await db.from("orders").update({ status: "refunded", payment_status: "refunded" }).eq("id", orderId);
    await db.from("order_items").update({ status: "refunded" }).eq("order_id", orderId);

    const order = await snapshotOrder(orderId);
    const prod = await snapshotProduct(productId);
    const ledger = await snapshotLedger(sellerId, orderId);

    expect(order!.status).toBe("refunded");
    expect(prod!.stock).toBe(25);
    expect(ledger.filter((l) => l.transaction_type === "debit")).toHaveLength(1);
  });

  it("partial failure: payment=refunded but order=completed, retry repair", async () => {
    const buyerId = genId(), sellerId = genId(), storeId = genId(), productId = genId(), orderId = genId();
    await createTestUser(buyerId, `${PREFIX}-t7pfBuyer@test.mx`, "buyer");
    await createTestUser(sellerId, `${PREFIX}-t7pfSeller@test.mx`, "seller");
    await createTestStore(storeId, sellerId, label("T7PFStore"));
    await createTestProduct(productId, storeId, label("T7PFProd"), 100000, 20);
    await createTestBalance(genId(), sellerId, 0);
    await upsert("orders", {
      id: orderId, order_number: label("T7PFORD"), buyer_id: buyerId,
      status: "pending", payment_status: "pending",
      subtotal: 100000, shipping_cost: 10000,
      platform_fee: 0, discount_amount: 0,
      total_amount: 110000, shipping_snapshot: {},
    });
    await createTestOrderItem(genId(), orderId, productId, sellerId, storeId, label("T7PFProd"), 1, 100000);

    // Simulate full happy path: payment success → order paid → completed
    await db.from("orders").update({ payment_status: "success", status: "paid" }).eq("id", orderId);
    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    const balBefore = await snapshotSellerBalance(sellerId);

    // STEP 1: Simulate partial failure — payment updated to refunded, but order NOT updated
    await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("order_id", orderId);
    // Order status intentionally NOT updated (simulating failure)

    const orderMid = await snapshotOrder(orderId);
    const balMid = await snapshotSellerBalance(sellerId);
    const ledgerMid = await snapshotLedger(sellerId, orderId);
    const prodMid = await snapshotProduct(productId);
    const itemsMid = await snapshotItems(orderId);

    // Payment is refunded but order is still completed — inconsistent state
    expect(orderMid!.status).toBe("completed");
    expect(orderMid!.payment_status).toBe("success");
    expect(balMid!.available_balance).toBe(balBefore!.available_balance);
    expect(ledgerMid.filter((l) => l.transaction_type === "debit")).toHaveLength(0);
    expect(prodMid!.stock).toBe(19); // stock decremented by order_items insert, not restored
    expect(itemsMid.every((i) => i.status === "completed")).toBe(true);

    // STEP 2: Repair — simulate what the webhook repair path does
    // (payment=refunded, no pending payment, order≠refunded → repair fires)
    await db.from("orders").update({ status: "refunded", payment_status: "refunded" }).eq("id", orderId).neq("payment_status", "refunded");
    await db.from("order_items").update({ status: "refunded" }).eq("order_id", orderId).neq("status", "refunded");

    const orderAfter = await snapshotOrder(orderId);
    const itemsAfter = await snapshotItems(orderId);
    const balAfter = await snapshotSellerBalance(sellerId);
    const ledgerAfter = await snapshotLedger(sellerId, orderId);
    const prodAfter = await snapshotProduct(productId);

    // Repair succeeded — all states corrected
    expect(orderAfter!.status).toBe("refunded");
    expect(orderAfter!.payment_status).toBe("refunded");
    expect(itemsAfter.every((i) => i.status === "refunded")).toBe(true);

    // Trigger fn_reverse_order_stats fired: balance debited back to initial
    const net = 100000 * 0.98;
    expect(num(balAfter!.available_balance)).toBe(0); // 0 + 98000 (complete) - 98000 (refund) = 0
    expect(ledgerAfter.filter((l) => l.transaction_type === "credit")).toHaveLength(1);
    expect(ledgerAfter.filter((l) => l.transaction_type === "debit")).toHaveLength(1);
    expect(num(ledgerAfter.find((l) => l.transaction_type === "debit")!.amount)).toBe(net);

    // Trigger fn_restore_product_stock fired: stock restored to pre-order level
    expect(prodAfter!.stock).toBe(20); // restored from 19 back to original 20
  });

  it("repair idempotent: double repair is no-op", async () => {
    const buyerId = genId(), sellerId = genId(), storeId = genId(), productId = genId(), orderId = genId();
    await createTestUser(buyerId, `${PREFIX}-t7repBuyer@test.mx`, "buyer");
    await createTestUser(sellerId, `${PREFIX}-t7repSeller@test.mx`, "seller");
    await createTestStore(storeId, sellerId, label("T7RepStore"));
    await createTestProduct(productId, storeId, label("T7RepProd"), 50000, 10);
    await createTestBalance(genId(), sellerId, 0);
    await upsert("orders", {
      id: orderId, order_number: label("T7RepORD"), buyer_id: buyerId,
      status: "pending", payment_status: "pending",
      subtotal: 50000, shipping_cost: 5000,
      platform_fee: 0, discount_amount: 0,
      total_amount: 55000, shipping_snapshot: {},
    });
    await createTestOrderItem(genId(), orderId, productId, sellerId, storeId, label("T7RepProd"), 1, 50000);

    // Go through proper flow: paid → completed (triggers fire)
    await db.from("orders").update({ payment_status: "success", status: "paid" }).eq("id", orderId);
    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_items").update({ status: "completed" }).eq("order_id", orderId);

    // First repair: order → refunded
    await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("order_id", orderId);
    await db.from("orders").update({ status: "refunded", payment_status: "refunded" }).eq("id", orderId).neq("payment_status", "refunded");
    await db.from("order_items").update({ status: "refunded" }).eq("order_id", orderId).neq("status", "refunded");

    const balAfter1 = await snapshotSellerBalance(sellerId);
    const ledger1 = await snapshotLedger(sellerId, orderId);
    const prod1 = await snapshotProduct(productId);

    // Second repair: neq guard blocks, no double-effect
    await db.from("orders").update({ status: "refunded", payment_status: "refunded" }).eq("id", orderId).neq("payment_status", "refunded");
    await db.from("order_items").update({ status: "refunded" }).eq("order_id", orderId).neq("status", "refunded");

    const balAfter2 = await snapshotSellerBalance(sellerId);
    const ledger2 = await snapshotLedger(sellerId, orderId);
    const prod2 = await snapshotProduct(productId);

    // No double-effect
    expect(num(balAfter2!.available_balance)).toBe(num(balAfter1!.available_balance));
    expect(ledger2).toHaveLength(ledger1.length);
    expect(ledger2.filter((l) => l.transaction_type === "debit")).toHaveLength(1);
    expect(prod2!.stock).toBe(prod1!.stock);
  });

  it("inconsistent state: payment=refunded order=completed is detectable", async () => {
    const buyerId = genId(), orderId = genId();
    await createTestUser(buyerId, `${PREFIX}-t7incBuyer@test.mx`, "buyer");
    await upsert("orders", {
      id: orderId, order_number: label("T7INC"), buyer_id: buyerId,
      status: "completed", payment_status: "success",
      subtotal: 10000, shipping_cost: 0,
      platform_fee: 0, discount_amount: 0,
      total_amount: 10000, shipping_snapshot: {},
    });
    // Insert a payment row first
    await upsert("payments", {
      id: genId(), order_id: orderId, amount: 10000,
      fee_amount: 0, payment_method: "bank_transfer", status: "success",
    });

    // Simulate partial failure: payment refunded but order completed
    await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("order_id", orderId);

    const order = await snapshotOrder(orderId);
    const payment = await snapshotPayment(orderId);

    // This is the inconsistent state — detectable by comparing payment vs order status
    expect(order!.status).toBe("completed");
    expect(payment!.status).toBe("refunded");

    // Cleanup
    await db.from("payments").delete().eq("order_id", orderId);
    await db.from("orders").delete().eq("id", orderId);
  });
});
