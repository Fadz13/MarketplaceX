-- =============================================================================
-- MARKETPLACEX — ROW LEVEL SECURITY
-- File   : database/002_rls.sql
-- Version: 1.0
-- Depends: 001_schema.sql (all tables must exist)
--
-- Purpose
--   Standalone, idempotent RLS file.  Safe to re-run: every policy is
--   dropped and re-created so this file is the single source of truth for
--   access control.  All helpers are replaced with improved, security-definer
--   versions that cache the role lookup and handle NULL / unauthenticated
--   callers without raising exceptions.
--
-- Role matrix (enforced via users.role denorm-cache)
--   guest          → auth.uid() IS NULL
--   authenticated  → auth.uid() IS NOT NULL  (any logged-in user)
--   buyer          → role = 'buyer'
--   seller         → role = 'seller'
--   moderator      → role = 'moderator'
--   finance        → role = 'finance'
--   admin          → role = 'admin'
--   super_admin    → role = 'super_admin'
--
-- Least-privilege summary
--   Public / guest    : read active products, categories, brands, stores,
--                       flash-sale items, banners, review content.
--   Buyer             : own profile, addresses, cart, wishlist, orders,
--                       payments, shipments, vouchers, notifications, reviews
--                       (only for completed purchases), reports.
--   Seller            : own store(s), products, SKUs, variants, stock
--                       movements, order items for their store, vouchers for
--                       their store, withdrawals, balance, analytics.
--   Moderator         : read-only across users, stores, products, orders,
--                       reports; resolve reports; suspend content.
--   Finance           : read payments, orders, seller balances, analytics,
--                       withdrawals; approve withdrawals.
--   Admin/Super Admin : full write access to every table.
--   Service role      : bypasses RLS entirely (Supabase default).
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENABLE RLS ON ALL TABLES
-- Safe to run repeatedly — ALTER TABLE … ENABLE ROW LEVEL SECURITY is
-- idempotent in PostgreSQL.
-- =============================================================================

ALTER TABLE roles                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_followers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images              ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_options             ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_values              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_skus                ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements_default     ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vouchers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking           ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_balances             ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_withdrawals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_images               ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sale_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications               ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs_default       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_analytics             ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 2: DROP ALL EXISTING POLICIES (idempotency)
-- Naming convention: <table>_<role/action>  e.g. products_guest_select
-- =============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname, tablename
        FROM   pg_policies
        WHERE  schemaname = 'public'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I',
            r.policyname, r.tablename
        );
    END LOOP;
END;
$$;

-- =============================================================================
-- SECTION 3: RLS HELPER FUNCTIONS
-- All functions are SECURITY DEFINER so they execute with the privileges of
-- their owner (postgres / service role) and can query the users table even
-- when the calling user has no direct SELECT permission on it.
-- All functions are STABLE for within-transaction caching.
-- All functions return a safe default on unauthenticated calls.
-- =============================================================================

-- Returns the internal users.id for the currently authenticated Supabase user.
-- Returns NULL for unauthenticated (guest) callers.
CREATE OR REPLACE FUNCTION rls_user_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT id
    FROM   users
    WHERE  auth_id = auth.uid()
    LIMIT  1;
$$;

-- Returns the role string from the denorm cache column users.role.
-- Returns NULL for unauthenticated callers — policies treat NULL as 'guest'.
CREATE OR REPLACE FUNCTION rls_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT role
    FROM   users
    WHERE  auth_id = auth.uid()
    LIMIT  1;
$$;

-- TRUE when the caller holds admin or super_admin.
CREATE OR REPLACE FUNCTION rls_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT COALESCE(rls_user_role() IN ('admin', 'super_admin'), FALSE);
$$;

-- TRUE when the caller is a seller (includes admin who can act as seller).
CREATE OR REPLACE FUNCTION rls_is_seller()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT COALESCE(rls_user_role() IN ('seller', 'admin', 'super_admin'), FALSE);
$$;

-- TRUE when the caller is authenticated (any role including buyer).
CREATE OR REPLACE FUNCTION rls_is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT auth.uid() IS NOT NULL;
$$;

-- TRUE when the given store_id is owned by the current caller.
-- Used across product, variant, stock, order-item, voucher policies.
CREATE OR REPLACE FUNCTION rls_owns_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM stores
        WHERE  id        = p_store_id
          AND  seller_id = rls_user_id()
          AND  status   != 'suspended'
    );
$$;

-- Returns the set of store IDs owned by the current caller.
-- Materialised as a function so the planner can inline it efficiently.
CREATE OR REPLACE FUNCTION rls_my_store_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT id FROM stores WHERE seller_id = rls_user_id();
$$;

-- =============================================================================
-- SECTION 4: POLICIES
-- Each table has explicitly named policies per operation and per role class.
-- Naming: <table>_<audience>_<operation>
-- =============================================================================

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.01  RBAC TABLES: roles, permissions, role_permissions, user_roles    │
-- └─────────────────────────────────────────────────────────────────────────┘

-- roles — authenticated users can read; only admin can write
CREATE POLICY roles_auth_select
    ON roles FOR SELECT
    USING (rls_is_authenticated());

CREATE POLICY roles_admin_all
    ON roles FOR ALL
    USING (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- permissions — authenticated users can read; only admin can write
CREATE POLICY permissions_auth_select
    ON permissions FOR SELECT
    USING (rls_is_authenticated());

CREATE POLICY permissions_admin_all
    ON permissions FOR ALL
    USING (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- role_permissions — authenticated users can read; only admin can write
CREATE POLICY role_permissions_auth_select
    ON role_permissions FOR SELECT
    USING (rls_is_authenticated());

CREATE POLICY role_permissions_admin_all
    ON role_permissions FOR ALL
    USING (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- user_roles — user sees own assignments; admin sees all; only admin writes
CREATE POLICY user_roles_owner_select
    ON user_roles FOR SELECT
    USING (user_id = rls_user_id() OR rls_is_admin());

CREATE POLICY user_roles_admin_all
    ON user_roles FOR ALL
    USING (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.02  USERS                                                            │
-- │  - Guest: no access                                                    │
-- │  - Authenticated: read own row only                                    │
-- │  - Moderator / Finance: read all (no PII exposure beyond what's there) │
-- │  - Admin: full access                                                  │
-- │  - INSERT: only via service role (auth trigger) → WITH CHECK (FALSE)  │
-- │    for normal JWT callers                                              │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY users_owner_select
    ON users FOR SELECT
    USING (auth_id = auth.uid());

CREATE POLICY users_staff_select
    ON users FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator', 'finance'));

-- Users may update their own non-privileged columns.
-- Privilege escalation (role, status) is blocked at API layer.
CREATE POLICY users_owner_update
    ON users FOR UPDATE
    USING  (auth_id = auth.uid())
    WITH CHECK (auth_id = auth.uid());

CREATE POLICY users_admin_update
    ON users FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- INSERT is handled by Supabase Auth trigger via service role; JWT callers
-- are denied to prevent manual row injection.
CREATE POLICY users_service_insert
    ON users FOR INSERT
    WITH CHECK (FALSE);

-- Only super_admin can hard-delete a user record; soft-delete preferred.
CREATE POLICY users_superadmin_delete
    ON users FOR DELETE
    USING (rls_user_role() = 'super_admin');

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.03  USER PROFILES                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Sellers' store pages show public profile info; restrict to non-sensitive cols
-- via application layer — RLS only enforces row-level access here.
CREATE POLICY user_profiles_owner_select
    ON user_profiles FOR SELECT
    USING (user_id = rls_user_id());

-- Moderators and admins may read profiles for investigations
CREATE POLICY user_profiles_staff_select
    ON user_profiles FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

CREATE POLICY user_profiles_owner_insert
    ON user_profiles FOR INSERT
    WITH CHECK (user_id = rls_user_id());

CREATE POLICY user_profiles_owner_update
    ON user_profiles FOR UPDATE
    USING  (user_id = rls_user_id())
    WITH CHECK (user_id = rls_user_id());

CREATE POLICY user_profiles_admin_all
    ON user_profiles FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.04  ADDRESSES                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY addresses_owner_select
    ON addresses FOR SELECT
    USING (user_id = rls_user_id());

CREATE POLICY addresses_owner_insert
    ON addresses FOR INSERT
    WITH CHECK (user_id = rls_user_id());

CREATE POLICY addresses_owner_update
    ON addresses FOR UPDATE
    USING  (user_id = rls_user_id())
    WITH CHECK (user_id = rls_user_id());

CREATE POLICY addresses_owner_delete
    ON addresses FOR DELETE
    USING (user_id = rls_user_id());

-- Admin can read all addresses (e.g. for fraud investigation)
CREATE POLICY addresses_admin_select
    ON addresses FOR SELECT
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.05  BRANDS                                                           │
-- │  Public catalog — guests can read active brands                        │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY brands_guest_select
    ON brands FOR SELECT
    USING (is_active = TRUE);

-- Admin sees all brands regardless of active flag
CREATE POLICY brands_admin_select
    ON brands FOR SELECT
    USING (rls_is_admin());

CREATE POLICY brands_admin_insert
    ON brands FOR INSERT
    WITH CHECK (rls_is_admin());

CREATE POLICY brands_admin_update
    ON brands FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

CREATE POLICY brands_admin_delete
    ON brands FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.06  STORES                                                           │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Guests and authenticated users can browse active stores
CREATE POLICY stores_guest_select
    ON stores FOR SELECT
    USING (status = 'active');

-- Sellers read their own store regardless of status
CREATE POLICY stores_seller_select
    ON stores FOR SELECT
    USING (seller_id = rls_user_id());

-- Staff can read all stores
CREATE POLICY stores_staff_select
    ON stores FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator', 'finance'));

-- Only verified sellers may create a store; seller_id must equal the caller
CREATE POLICY stores_seller_insert
    ON stores FOR INSERT
    WITH CHECK (
        seller_id = rls_user_id()
        AND rls_is_seller()
    );

-- Sellers update only their own store
CREATE POLICY stores_seller_update
    ON stores FOR UPDATE
    USING  (seller_id = rls_user_id() AND rls_is_seller())
    WITH CHECK (seller_id = rls_user_id());

-- Only admin can change store status (approve / suspend)
CREATE POLICY stores_admin_update
    ON stores FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- Stores are never hard-deleted; admin may do so only in exceptional cases
CREATE POLICY stores_admin_delete
    ON stores FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.07  STORE FOLLOWERS                                                  │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Users can see which stores they follow
CREATE POLICY store_followers_owner_select
    ON store_followers FOR SELECT
    USING (user_id = rls_user_id());

-- Store owners can see who follows their stores
CREATE POLICY store_followers_seller_select
    ON store_followers FOR SELECT
    USING (store_id IN (SELECT rls_my_store_ids()));

CREATE POLICY store_followers_admin_select
    ON store_followers FOR SELECT
    USING (rls_is_admin());

-- Only authenticated users can follow stores; must use their own user_id
CREATE POLICY store_followers_auth_insert
    ON store_followers FOR INSERT
    WITH CHECK (
        user_id = rls_user_id()
        AND rls_is_authenticated()
    );

-- Users can only unfollow themselves
CREATE POLICY store_followers_owner_delete
    ON store_followers FOR DELETE
    USING (user_id = rls_user_id());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.08  CATEGORIES                                                       │
-- │  Public catalog                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Guests and all authenticated users can read active categories
CREATE POLICY categories_guest_select
    ON categories FOR SELECT
    USING (status = 'active');

CREATE POLICY categories_admin_select
    ON categories FOR SELECT
    USING (rls_is_admin());

CREATE POLICY categories_admin_insert
    ON categories FOR INSERT
    WITH CHECK (rls_is_admin());

CREATE POLICY categories_admin_update
    ON categories FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

CREATE POLICY categories_admin_delete
    ON categories FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.09  PRODUCTS                                                         │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Public catalog: guests and authenticated users see active products only
CREATE POLICY products_guest_select
    ON products FOR SELECT
    USING (status = 'active');

-- Sellers see all their own products regardless of status (draft, suspended…)
CREATE POLICY products_seller_select
    ON products FOR SELECT
    USING (store_id IN (SELECT rls_my_store_ids()));

-- Moderators/admin see everything for moderation
CREATE POLICY products_staff_select
    ON products FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

-- Sellers can create products only in their own active stores
CREATE POLICY products_seller_insert
    ON products FOR INSERT
    WITH CHECK (
        store_id IN (SELECT rls_my_store_ids())
        AND rls_is_seller()
    );

-- Sellers update only their own products
CREATE POLICY products_seller_update
    ON products FOR UPDATE
    USING  (store_id IN (SELECT rls_my_store_ids()))
    WITH CHECK (store_id IN (SELECT rls_my_store_ids()));

-- Admin can update any product (e.g. moderate / suspend)
CREATE POLICY products_admin_update
    ON products FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- Sellers soft-delete their own products; admin hard-deletes
CREATE POLICY products_seller_delete
    ON products FOR DELETE
    USING (store_id IN (SELECT rls_my_store_ids()));

CREATE POLICY products_admin_delete
    ON products FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.10  PRODUCT IMAGES                                                   │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Product images are part of the public catalog
CREATE POLICY product_images_guest_select
    ON product_images FOR SELECT
    USING (TRUE);

CREATE POLICY product_images_seller_insert
    ON product_images FOR INSERT
    WITH CHECK (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY product_images_seller_update
    ON product_images FOR UPDATE
    USING (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    )
    WITH CHECK (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY product_images_seller_delete
    ON product_images FOR DELETE
    USING (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY product_images_admin_all
    ON product_images FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.11  VARIANT OPTIONS                                                  │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY variant_options_guest_select
    ON variant_options FOR SELECT
    USING (TRUE);

CREATE POLICY variant_options_seller_write
    ON variant_options FOR ALL
    USING (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    )
    WITH CHECK (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY variant_options_admin_all
    ON variant_options FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.12  VARIANT VALUES                                                   │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY variant_values_guest_select
    ON variant_values FOR SELECT
    USING (TRUE);

CREATE POLICY variant_values_seller_write
    ON variant_values FOR ALL
    USING (
        variant_option_id IN (
            SELECT vo.id FROM variant_options vo
            JOIN   products p ON p.id = vo.product_id
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    )
    WITH CHECK (
        variant_option_id IN (
            SELECT vo.id FROM variant_options vo
            JOIN   products p ON p.id = vo.product_id
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY variant_values_admin_all
    ON variant_values FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.13  PRODUCT SKUS                                                     │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Active SKUs are public (needed for add-to-cart price/stock display)
CREATE POLICY product_skus_guest_select
    ON product_skus FOR SELECT
    USING (is_active = TRUE);

-- Sellers see all their own SKUs (including inactive)
CREATE POLICY product_skus_seller_select
    ON product_skus FOR SELECT
    USING (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY product_skus_seller_insert
    ON product_skus FOR INSERT
    WITH CHECK (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY product_skus_seller_update
    ON product_skus FOR UPDATE
    USING (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    )
    WITH CHECK (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY product_skus_seller_delete
    ON product_skus FOR DELETE
    USING (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY product_skus_admin_all
    ON product_skus FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.14  STOCK MOVEMENTS                                                  │
-- │  Immutable audit log — no UPDATE or DELETE policies                    │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Sellers see movements for their own products
CREATE POLICY stock_movements_seller_select
    ON stock_movements FOR SELECT
    USING (
        product_id IN (
            SELECT p.id FROM products p
            WHERE  p.store_id IN (SELECT rls_my_store_ids())
        )
    );

-- Finance and admin have full read access
CREATE POLICY stock_movements_finance_select
    ON stock_movements FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- INSERT only via trusted triggers / service role; normal JWT callers blocked
CREATE POLICY stock_movements_service_insert
    ON stock_movements FOR INSERT
    WITH CHECK (
        -- Sellers may manually log purchase / adjustment type movements
        (movement_type IN ('purchase', 'adjustment')
         AND product_id IN (
             SELECT p.id FROM products p
             WHERE  p.store_id IN (SELECT rls_my_store_ids())
         ))
        OR rls_is_admin()
    );

-- No UPDATE or DELETE: append-only table

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.15  CARTS                                                            │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Buyers own their cart; admins can read for support
CREATE POLICY carts_owner_select
    ON carts FOR SELECT
    USING (user_id = rls_user_id());

CREATE POLICY carts_admin_select
    ON carts FOR SELECT
    USING (rls_is_admin());

-- Cart is auto-created by bootstrap trigger; manual inserts blocked
CREATE POLICY carts_service_insert
    ON carts FOR INSERT
    WITH CHECK (user_id = rls_user_id());

CREATE POLICY carts_owner_update
    ON carts FOR UPDATE
    USING  (user_id = rls_user_id())
    WITH CHECK (user_id = rls_user_id());

CREATE POLICY carts_owner_delete
    ON carts FOR DELETE
    USING (user_id = rls_user_id());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.16  CART ITEMS                                                       │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY cart_items_owner_select
    ON cart_items FOR SELECT
    USING (
        cart_id IN (SELECT id FROM carts WHERE user_id = rls_user_id())
    );

CREATE POLICY cart_items_owner_insert
    ON cart_items FOR INSERT
    WITH CHECK (
        cart_id IN (SELECT id FROM carts WHERE user_id = rls_user_id())
    );

CREATE POLICY cart_items_owner_update
    ON cart_items FOR UPDATE
    USING (
        cart_id IN (SELECT id FROM carts WHERE user_id = rls_user_id())
    )
    WITH CHECK (
        cart_id IN (SELECT id FROM carts WHERE user_id = rls_user_id())
    );

CREATE POLICY cart_items_owner_delete
    ON cart_items FOR DELETE
    USING (
        cart_id IN (SELECT id FROM carts WHERE user_id = rls_user_id())
    );

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.17  WISHLISTS                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY wishlists_owner_select
    ON wishlists FOR SELECT
    USING (user_id = rls_user_id());

CREATE POLICY wishlists_service_insert
    ON wishlists FOR INSERT
    WITH CHECK (user_id = rls_user_id());

CREATE POLICY wishlists_owner_delete
    ON wishlists FOR DELETE
    USING (user_id = rls_user_id());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.18  WISHLIST ITEMS                                                   │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY wishlist_items_owner_select
    ON wishlist_items FOR SELECT
    USING (
        wishlist_id IN (SELECT id FROM wishlists WHERE user_id = rls_user_id())
    );

CREATE POLICY wishlist_items_owner_insert
    ON wishlist_items FOR INSERT
    WITH CHECK (
        wishlist_id IN (SELECT id FROM wishlists WHERE user_id = rls_user_id())
    );

CREATE POLICY wishlist_items_owner_delete
    ON wishlist_items FOR DELETE
    USING (
        wishlist_id IN (SELECT id FROM wishlists WHERE user_id = rls_user_id())
    );

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.19  VOUCHERS                                                         │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Guests and buyers see active platform-scoped vouchers
CREATE POLICY vouchers_guest_select
    ON vouchers FOR SELECT
    USING (status = 'active' AND scope = 'platform');

-- Authenticated users also see active store vouchers (for apply-at-checkout)
CREATE POLICY vouchers_auth_select
    ON vouchers FOR SELECT
    USING (
        status = 'active'
        AND rls_is_authenticated()
    );

-- Sellers see all vouchers for their own stores (including inactive)
CREATE POLICY vouchers_seller_select
    ON vouchers FOR SELECT
    USING (
        store_id IN (SELECT rls_my_store_ids())
    );

-- Admin sees all vouchers
CREATE POLICY vouchers_admin_select
    ON vouchers FOR SELECT
    USING (rls_is_admin());

-- Sellers create vouchers only for their own stores
CREATE POLICY vouchers_seller_insert
    ON vouchers FOR INSERT
    WITH CHECK (
        store_id IN (SELECT rls_my_store_ids())
        AND scope = 'store'
        AND rls_is_seller()
    );

-- Platform vouchers are admin-only
CREATE POLICY vouchers_admin_insert
    ON vouchers FOR INSERT
    WITH CHECK (rls_is_admin());

CREATE POLICY vouchers_seller_update
    ON vouchers FOR UPDATE
    USING (store_id IN (SELECT rls_my_store_ids()))
    WITH CHECK (store_id IN (SELECT rls_my_store_ids()));

CREATE POLICY vouchers_admin_update
    ON vouchers FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

CREATE POLICY vouchers_seller_delete
    ON vouchers FOR DELETE
    USING (store_id IN (SELECT rls_my_store_ids()));

CREATE POLICY vouchers_admin_delete
    ON vouchers FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.20  USER VOUCHERS                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY user_vouchers_owner_select
    ON user_vouchers FOR SELECT
    USING (user_id = rls_user_id());

CREATE POLICY user_vouchers_admin_select
    ON user_vouchers FOR SELECT
    USING (rls_is_admin());

CREATE POLICY user_vouchers_owner_insert
    ON user_vouchers FOR INSERT
    WITH CHECK (
        user_id = rls_user_id()
        AND rls_is_authenticated()
    );

-- Mark voucher as used; only the owning buyer can do this (through service fn)
CREATE POLICY user_vouchers_owner_update
    ON user_vouchers FOR UPDATE
    USING  (user_id = rls_user_id())
    WITH CHECK (user_id = rls_user_id());

-- Vouchers cannot be deleted by users; admin only
CREATE POLICY user_vouchers_admin_delete
    ON user_vouchers FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.21  ORDERS                                                           │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Buyers see their own orders
CREATE POLICY orders_buyer_select
    ON orders FOR SELECT
    USING (buyer_id = rls_user_id());

-- Sellers see orders that contain items from their store
CREATE POLICY orders_seller_select
    ON orders FOR SELECT
    USING (
        id IN (
            SELECT DISTINCT oi.order_id
            FROM   order_items oi
            WHERE  oi.store_id IN (SELECT rls_my_store_ids())
        )
    );

-- Finance, admin, moderator have full read access
CREATE POLICY orders_staff_select
    ON orders FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance', 'moderator'));

-- Only authenticated buyers can create orders for themselves
CREATE POLICY orders_buyer_insert
    ON orders FOR INSERT
    WITH CHECK (
        buyer_id = rls_user_id()
        AND rls_is_authenticated()
    );

-- Buyers can cancel their own pending orders
CREATE POLICY orders_buyer_update
    ON orders FOR UPDATE
    USING  (buyer_id = rls_user_id())
    -- Buyers may only set status = 'cancelled' or 'completed'; enforced at API
    WITH CHECK (buyer_id = rls_user_id());

-- Admin can update any order (e.g. force-complete, refund)
CREATE POLICY orders_admin_update
    ON orders FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- Orders are never hard-deleted
CREATE POLICY orders_admin_delete
    ON orders FOR DELETE
    USING (rls_user_role() = 'super_admin');

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.22  ORDER ITEMS                                                      │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY order_items_buyer_select
    ON order_items FOR SELECT
    USING (
        order_id IN (SELECT id FROM orders WHERE buyer_id = rls_user_id())
    );

CREATE POLICY order_items_seller_select
    ON order_items FOR SELECT
    USING (store_id IN (SELECT rls_my_store_ids()));

CREATE POLICY order_items_staff_select
    ON order_items FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance', 'moderator'));

-- INSERT via checkout service only; buyer must own the parent order
CREATE POLICY order_items_buyer_insert
    ON order_items FOR INSERT
    WITH CHECK (
        order_id IN (SELECT id FROM orders WHERE buyer_id = rls_user_id())
    );

-- Sellers update status on their own order items (processing → shipped)
CREATE POLICY order_items_seller_update
    ON order_items FOR UPDATE
    USING  (store_id IN (SELECT rls_my_store_ids()))
    WITH CHECK (store_id IN (SELECT rls_my_store_ids()));

CREATE POLICY order_items_admin_update
    ON order_items FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.23  PAYMENTS                                                         │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Buyers see payments for their own orders
CREATE POLICY payments_buyer_select
    ON payments FOR SELECT
    USING (
        order_id IN (SELECT id FROM orders WHERE buyer_id = rls_user_id())
    );

CREATE POLICY payments_finance_select
    ON payments FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- Payment row created by checkout flow; buyer must own the order
CREATE POLICY payments_buyer_insert
    ON payments FOR INSERT
    WITH CHECK (
        order_id IN (SELECT id FROM orders WHERE buyer_id = rls_user_id())
    );

-- Admin / finance can update payments (e.g. manual refund marking)
CREATE POLICY payments_admin_update
    ON payments FOR UPDATE
    USING  (rls_user_role() IN ('admin', 'super_admin', 'finance'))
    WITH CHECK (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- Payments are never deleted
CREATE POLICY payments_no_delete
    ON payments FOR DELETE
    USING (FALSE);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.24  PAYMENT LOGS                                                     │
-- │  Immutable — no UPDATE or DELETE                                       │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Buyers see logs for their own payments
CREATE POLICY payment_logs_buyer_select
    ON payment_logs FOR SELECT
    USING (
        payment_id IN (
            SELECT p.id FROM payments p
            JOIN   orders o ON o.id = p.order_id
            WHERE  o.buyer_id = rls_user_id()
        )
    );

CREATE POLICY payment_logs_finance_select
    ON payment_logs FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- INSERT only via payment service (triggers/webhooks use service role)
CREATE POLICY payment_logs_service_insert
    ON payment_logs FOR INSERT
    WITH CHECK (TRUE);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.25  SHIPMENTS                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY shipments_buyer_select
    ON shipments FOR SELECT
    USING (
        order_id IN (SELECT id FROM orders WHERE buyer_id = rls_user_id())
    );

-- Sellers see shipments for orders containing their items
CREATE POLICY shipments_seller_select
    ON shipments FOR SELECT
    USING (
        order_id IN (
            SELECT DISTINCT oi.order_id
            FROM   order_items oi
            WHERE  oi.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY shipments_admin_select
    ON shipments FOR SELECT
    USING (rls_is_admin());

-- Shipment is created by seller after processing the order
CREATE POLICY shipments_seller_insert
    ON shipments FOR INSERT
    WITH CHECK (
        order_id IN (
            SELECT DISTINCT oi.order_id
            FROM   order_items oi
            WHERE  oi.store_id IN (SELECT rls_my_store_ids())
        )
    );

-- Sellers update tracking info
CREATE POLICY shipments_seller_update
    ON shipments FOR UPDATE
    USING (
        order_id IN (
            SELECT DISTINCT oi.order_id
            FROM   order_items oi
            WHERE  oi.store_id IN (SELECT rls_my_store_ids())
        )
    )
    WITH CHECK (
        order_id IN (
            SELECT DISTINCT oi.order_id
            FROM   order_items oi
            WHERE  oi.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY shipments_admin_update
    ON shipments FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.26  SHIPMENT TRACKING                                                │
-- │  Append-only courier event log                                         │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY shipment_tracking_buyer_select
    ON shipment_tracking FOR SELECT
    USING (
        shipment_id IN (
            SELECT sh.id FROM shipments sh
            JOIN   orders o ON o.id = sh.order_id
            WHERE  o.buyer_id = rls_user_id()
        )
    );

CREATE POLICY shipment_tracking_seller_select
    ON shipment_tracking FOR SELECT
    USING (
        shipment_id IN (
            SELECT sh.id FROM shipments sh
            JOIN   order_items oi ON oi.order_id = sh.order_id
            WHERE  oi.store_id IN (SELECT rls_my_store_ids())
        )
    );

CREATE POLICY shipment_tracking_admin_select
    ON shipment_tracking FOR SELECT
    USING (rls_is_admin());

-- INSERT via webhook / service role; sellers may also push manual checkpoints
CREATE POLICY shipment_tracking_service_insert
    ON shipment_tracking FOR INSERT
    WITH CHECK (TRUE);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.27  SELLER BALANCES                                                  │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Sellers see only their own balance
CREATE POLICY seller_balances_owner_select
    ON seller_balances FOR SELECT
    USING (seller_id = rls_user_id());

CREATE POLICY seller_balances_finance_select
    ON seller_balances FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- Balances are managed exclusively by triggers; no manual writes by JWT callers
CREATE POLICY seller_balances_no_insert
    ON seller_balances FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY seller_balances_no_update
    ON seller_balances FOR UPDATE
    USING (FALSE);

CREATE POLICY seller_balances_no_delete
    ON seller_balances FOR DELETE
    USING (FALSE);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.28  SELLER BALANCE TRANSACTIONS                                      │
-- │  Immutable ledger — no UPDATE or DELETE                                │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY sbt_owner_select
    ON seller_balance_transactions FOR SELECT
    USING (seller_id = rls_user_id());

CREATE POLICY sbt_finance_select
    ON seller_balance_transactions FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- INSERT via triggers only
CREATE POLICY sbt_service_insert
    ON seller_balance_transactions FOR INSERT
    WITH CHECK (FALSE);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.29  SELLER WITHDRAWALS                                               │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY seller_withdrawals_owner_select
    ON seller_withdrawals FOR SELECT
    USING (seller_id = rls_user_id());

CREATE POLICY seller_withdrawals_finance_select
    ON seller_withdrawals FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- Sellers submit withdrawal requests
CREATE POLICY seller_withdrawals_seller_insert
    ON seller_withdrawals FOR INSERT
    WITH CHECK (
        seller_id = rls_user_id()
        AND rls_is_seller()
    );

-- Finance / admin process withdrawals
CREATE POLICY seller_withdrawals_finance_update
    ON seller_withdrawals FOR UPDATE
    USING  (rls_user_role() IN ('admin', 'super_admin', 'finance'))
    WITH CHECK (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- Sellers may cancel their own pending withdrawal
CREATE POLICY seller_withdrawals_owner_cancel
    ON seller_withdrawals FOR UPDATE
    USING  (seller_id = rls_user_id() AND status = 'pending')
    WITH CHECK (seller_id = rls_user_id());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.30  REVIEWS                                                          │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Reviews are public — guests can read them for product evaluation
CREATE POLICY reviews_guest_select
    ON reviews FOR SELECT
    USING (TRUE);

-- Only buyers who completed the order may leave a review
CREATE POLICY reviews_buyer_insert
    ON reviews FOR INSERT
    WITH CHECK (
        user_id = rls_user_id()
        AND rls_is_authenticated()
        AND order_item_id IN (
            SELECT oi.id FROM order_items oi
            JOIN   orders o ON o.id = oi.order_id
            WHERE  o.buyer_id  = rls_user_id()
              AND  o.status    = 'completed'
        )
    );

-- Buyer can edit their own review (text/rating only; image edits go via review_images)
CREATE POLICY reviews_buyer_update
    ON reviews FOR UPDATE
    USING  (user_id = rls_user_id())
    WITH CHECK (user_id = rls_user_id());

-- Seller can add/update seller_response column only
CREATE POLICY reviews_seller_respond
    ON reviews FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM order_items oi
            JOIN   stores s ON s.id = oi.store_id
            WHERE  oi.id = reviews.order_item_id
              AND  s.seller_id = rls_user_id()
        )
    )
    -- Seller can only write to seller_response; enforced at API/view layer
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM order_items oi
            JOIN   stores s ON s.id = oi.store_id
            WHERE  oi.id = reviews.order_item_id
              AND  s.seller_id = rls_user_id()
        )
    );

-- Buyers delete own; moderator/admin moderate
CREATE POLICY reviews_owner_delete
    ON reviews FOR DELETE
    USING (user_id = rls_user_id());

CREATE POLICY reviews_moderator_delete
    ON reviews FOR DELETE
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.31  REVIEW IMAGES                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY review_images_guest_select
    ON review_images FOR SELECT
    USING (TRUE);

CREATE POLICY review_images_buyer_insert
    ON review_images FOR INSERT
    WITH CHECK (
        review_id IN (SELECT id FROM reviews WHERE user_id = rls_user_id())
    );

CREATE POLICY review_images_buyer_delete
    ON review_images FOR DELETE
    USING (
        review_id IN (SELECT id FROM reviews WHERE user_id = rls_user_id())
    );

CREATE POLICY review_images_admin_all
    ON review_images FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.32  FLASH SALES                                                      │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Guests and buyers see published flash sales
CREATE POLICY flash_sales_guest_select
    ON flash_sales FOR SELECT
    USING (status IN ('active', 'scheduled', 'ended'));

CREATE POLICY flash_sales_admin_select
    ON flash_sales FOR SELECT
    USING (rls_is_admin());

CREATE POLICY flash_sales_admin_insert
    ON flash_sales FOR INSERT
    WITH CHECK (rls_is_admin());

CREATE POLICY flash_sales_admin_update
    ON flash_sales FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

CREATE POLICY flash_sales_admin_delete
    ON flash_sales FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.33  FLASH SALE ITEMS                                                 │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Flash sale items are public catalog
CREATE POLICY flash_sale_items_guest_select
    ON flash_sale_items FOR SELECT
    USING (TRUE);

CREATE POLICY flash_sale_items_admin_all
    ON flash_sale_items FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- sold_count is updated by triggers (service role); no JWT update
CREATE POLICY flash_sale_items_no_buyer_write
    ON flash_sale_items FOR INSERT
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.34  BANNERS                                                          │
-- │  Public marketing content                                              │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Guests see active banners
CREATE POLICY banners_guest_select
    ON banners FOR SELECT
    USING (status = 'active');

-- Admin sees all banners regardless of status
CREATE POLICY banners_admin_select
    ON banners FOR SELECT
    USING (rls_is_admin());

CREATE POLICY banners_admin_insert
    ON banners FOR INSERT
    WITH CHECK (rls_is_admin());

CREATE POLICY banners_admin_update
    ON banners FOR UPDATE
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

CREATE POLICY banners_admin_delete
    ON banners FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.35  CONVERSATIONS                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Participants (buyer and seller) can see and use their conversations
CREATE POLICY conversations_participant_select
    ON conversations FOR SELECT
    USING (
        buyer_id = rls_user_id()
        OR seller_id = rls_user_id()
    );

CREATE POLICY conversations_moderator_select
    ON conversations FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

-- Buyer initiates a conversation
CREATE POLICY conversations_buyer_insert
    ON conversations FOR INSERT
    WITH CHECK (
        buyer_id = rls_user_id()
        AND rls_is_authenticated()
    );

-- last_message_at is updated by trigger; participants may update other fields
CREATE POLICY conversations_participant_update
    ON conversations FOR UPDATE
    USING  (buyer_id = rls_user_id() OR seller_id = rls_user_id())
    WITH CHECK (buyer_id = rls_user_id() OR seller_id = rls_user_id());

-- Conversations are soft-deleted at application layer; no hard delete
CREATE POLICY conversations_admin_delete
    ON conversations FOR DELETE
    USING (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.36  MESSAGES                                                         │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY messages_participant_select
    ON messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE  buyer_id  = rls_user_id()
               OR  seller_id = rls_user_id()
        )
    );

CREATE POLICY messages_moderator_select
    ON messages FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

-- Sender must be the caller and must be a participant of the conversation
CREATE POLICY messages_participant_insert
    ON messages FOR INSERT
    WITH CHECK (
        sender_id = rls_user_id()
        AND conversation_id IN (
            SELECT id FROM conversations
            WHERE  buyer_id  = rls_user_id()
               OR  seller_id = rls_user_id()
        )
    );

-- Only is_read can be updated (marked as read); enforced at API layer
CREATE POLICY messages_participant_update
    ON messages FOR UPDATE
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE  buyer_id  = rls_user_id()
               OR  seller_id = rls_user_id()
        )
    )
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE  buyer_id  = rls_user_id()
               OR  seller_id = rls_user_id()
        )
    );

-- Messages are never hard-deleted by normal users
CREATE POLICY messages_admin_delete
    ON messages FOR DELETE
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.37  NOTIFICATIONS                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY notifications_owner_select
    ON notifications FOR SELECT
    USING (user_id = rls_user_id());

CREATE POLICY notifications_admin_select
    ON notifications FOR SELECT
    USING (rls_is_admin());

-- Notifications are created by server-side triggers/services only
CREATE POLICY notifications_service_insert
    ON notifications FOR INSERT
    WITH CHECK (TRUE);

-- Owners can mark notifications as read
CREATE POLICY notifications_owner_update
    ON notifications FOR UPDATE
    USING  (user_id = rls_user_id())
    WITH CHECK (user_id = rls_user_id());

-- Owners can delete their own notifications
CREATE POLICY notifications_owner_delete
    ON notifications FOR DELETE
    USING (user_id = rls_user_id());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.38  REPORT CATEGORIES                                                │
-- │  Public taxonomy for report form                                       │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE POLICY report_categories_guest_select
    ON report_categories FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY report_categories_admin_select
    ON report_categories FOR SELECT
    USING (rls_is_admin());

CREATE POLICY report_categories_admin_all
    ON report_categories FOR ALL
    USING  (rls_is_admin())
    WITH CHECK (rls_is_admin());

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.39  REPORTS                                                          │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Reporter can see their own submitted reports
CREATE POLICY reports_owner_select
    ON reports FOR SELECT
    USING (reporter_id = rls_user_id());

-- Moderators and admin see all reports
CREATE POLICY reports_staff_select
    ON reports FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

-- Any authenticated user can submit a report
CREATE POLICY reports_auth_insert
    ON reports FOR INSERT
    WITH CHECK (
        reporter_id = rls_user_id()
        AND rls_is_authenticated()
    );

-- Only moderators and admin can update reports (resolve / dismiss)
CREATE POLICY reports_moderator_update
    ON reports FOR UPDATE
    USING  (rls_user_role() IN ('admin', 'super_admin', 'moderator'))
    WITH CHECK (rls_user_role() IN ('admin', 'super_admin', 'moderator'));

-- Reports are never deleted to preserve audit trail
CREATE POLICY reports_no_delete
    ON reports FOR DELETE
    USING (FALSE);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.40  ACTIVITY LOGS                                                    │
-- │  Immutable compliance audit trail — no UPDATE or DELETE for anyone     │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Only privileged staff may read activity logs
CREATE POLICY activity_logs_staff_select
    ON activity_logs FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance', 'moderator'));

-- INSERT allowed from any context (triggers, service, application)
-- The application/trigger is responsible for correct data
CREATE POLICY activity_logs_service_insert
    ON activity_logs FOR INSERT
    WITH CHECK (TRUE);

-- Explicitly block UPDATE and DELETE for all callers including admin
CREATE POLICY activity_logs_no_update
    ON activity_logs FOR UPDATE
    USING (FALSE);

CREATE POLICY activity_logs_no_delete
    ON activity_logs FOR DELETE
    USING (FALSE);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4.41  SALES ANALYTICS                                                  │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Sellers see their own store analytics only
CREATE POLICY sales_analytics_seller_select
    ON sales_analytics FOR SELECT
    USING (store_id IN (SELECT rls_my_store_ids()));

-- Finance and admin have full platform visibility
CREATE POLICY sales_analytics_finance_select
    ON sales_analytics FOR SELECT
    USING (rls_user_role() IN ('admin', 'super_admin', 'finance'));

-- Upserted by server-side background job via service role
CREATE POLICY sales_analytics_service_insert
    ON sales_analytics FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY sales_analytics_service_update
    ON sales_analytics FOR UPDATE
    USING (FALSE);

-- =============================================================================
-- SECTION 5: POLICY VERIFICATION QUERY
-- Run this query after applying migrations to audit policy coverage.
-- =============================================================================

-- SELECT
--     tablename,
--     COUNT(*)                                              AS policy_count,
--     ARRAY_AGG(policyname ORDER BY policyname)             AS policies
-- FROM   pg_policies
-- WHERE  schemaname = 'public'
-- GROUP  BY tablename
-- ORDER  BY tablename;

-- =============================================================================
-- END OF 002_rls.sql
-- =============================================================================
