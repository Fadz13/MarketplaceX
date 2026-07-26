-- =============================================================================
-- MARKETPLACEX — REUSABLE SQL FUNCTIONS
-- File   : database/003_functions.sql
-- Version: 1.0
-- Depends: 001_schema.sql, 002_rls.sql
-- Engine : PostgreSQL 17, Supabase compatible
--
-- Conventions
--   • IMMUTABLE  – deterministic, no DB reads, no side effects
--   • STABLE     – reads DB but does not modify within a transaction
--   • VOLATILE   – modifies DB or relies on non-deterministic state
--   • SECURITY DEFINER used only when the function must bypass RLS to read
--     data on behalf of a caller (e.g. internal stats helpers).
--   • All functions use explicit search_path = public, pg_catalog to prevent
--     search-path injection attacks.
--   • Error codes follow SQLSTATE custom range P0xxx.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — COMMON UTILITIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- update_updated_at()
--
-- Convenience wrapper used wherever code manually needs to stamp a row's
-- updated_at without going through a trigger (e.g. batch jobs).
-- VOLATILE because it writes to the database.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at(
    p_table TEXT,
    p_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_table IS NULL OR trim(p_table) = '' THEN
        RAISE EXCEPTION 'update_updated_at: p_table must not be null or empty'
            USING ERRCODE = 'P0010';
    END IF;

    IF p_id IS NULL THEN
        RAISE EXCEPTION 'update_updated_at: p_id must not be null'
            USING ERRCODE = 'P0010';
    END IF;

    -- Whitelist table names to prevent SQL injection via dynamic SQL
    IF p_table NOT IN (
        'users', 'user_profiles', 'addresses', 'stores', 'categories',
        'products', 'product_skus', 'carts', 'cart_items', 'orders',
        'order_items', 'payments', 'shipments', 'reviews', 'vouchers',
        'flash_sales', 'flash_sale_items', 'banners', 'seller_withdrawals',
        'seller_balances', 'reports', 'brands', 'roles', 'permissions'
    ) THEN
        RAISE EXCEPTION 'update_updated_at: table "%" is not whitelisted', p_table
            USING ERRCODE = 'P0011';
    END IF;

    EXECUTE format(
        'UPDATE %I SET updated_at = NOW() WHERE id = $1',
        p_table
    ) USING p_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'update_updated_at failed for table "%" id "%": %',
            p_table, p_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION update_updated_at(TEXT, UUID) IS
'Stamps updated_at = NOW() for any whitelisted table row by ID. Used by batch jobs that bypass trigger-level timestamping.';

-- -----------------------------------------------------------------------------
-- generate_slug(text)
--
-- Converts an arbitrary display string to a URL-safe lowercase slug.
-- Removes accents, replaces non-alphanumeric runs with hyphens, strips
-- leading/trailing hyphens, and enforces a max length of 250 characters.
-- IMMUTABLE — pure string transformation, no DB access.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_slug(
    p_input TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_slug TEXT;
BEGIN
    IF p_input IS NULL OR trim(p_input) = '' THEN
        RAISE EXCEPTION 'generate_slug: input must not be null or empty'
            USING ERRCODE = 'P0012';
    END IF;

    -- 1. Lower-case
    v_slug := lower(p_input);

    -- 2. Remove accents (requires unaccent extension, installed in 001_schema.sql)
    v_slug := unaccent(v_slug);

    -- 3. Replace any character that is not a-z, 0-9 with a hyphen
    v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');

    -- 4. Collapse consecutive hyphens
    v_slug := regexp_replace(v_slug, '-{2,}', '-', 'g');

    -- 5. Strip leading / trailing hyphens
    v_slug := trim(BOTH '-' FROM v_slug);

    -- 6. Enforce maximum length
    IF length(v_slug) > 250 THEN
        v_slug := left(v_slug, 250);
        v_slug := trim(BOTH '-' FROM v_slug);
    END IF;

    IF v_slug = '' THEN
        RAISE EXCEPTION 'generate_slug: resulting slug is empty for input "%"', p_input
            USING ERRCODE = 'P0012';
    END IF;

    RETURN v_slug;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'generate_slug failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION generate_slug(TEXT) IS
'Converts a display string to a URL-safe slug: lowercase, unaccented, hyphen-separated, max 250 chars.';

-- -----------------------------------------------------------------------------
-- generate_uuid_if_null(uuid)
--
-- Returns the input UUID if non-null, or a freshly generated UUID otherwise.
-- Useful for upsert patterns and default-value expressions in application code.
-- VOLATILE because uuid_generate_v4() is non-deterministic.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_uuid_if_null(
    p_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN COALESCE(p_id, uuid_generate_v4());
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'generate_uuid_if_null failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION generate_uuid_if_null(UUID) IS
'Returns p_id unchanged if not null, otherwise generates and returns a new UUIDv4.';

-- =============================================================================
-- SECTION 2 — ORDER FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- calculate_order_total(subtotal, shipping_cost, discount_amount, platform_fee)
--
-- Single source of truth for the orders.total_amount formula.
-- Must stay in sync with the CHECK constraint in 001_schema.sql:
--   total_amount = subtotal + shipping_cost - discount_amount + platform_fee
-- IMMUTABLE — pure arithmetic.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_order_total(
    p_subtotal        NUMERIC(15, 2),
    p_shipping_cost   NUMERIC(15, 2) DEFAULT 0,
    p_discount_amount NUMERIC(15, 2) DEFAULT 0,
    p_platform_fee    NUMERIC(15, 2) DEFAULT 0
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_total NUMERIC(15, 2);
BEGIN
    -- Validate inputs
    IF p_subtotal IS NULL OR p_subtotal <= 0 THEN
        RAISE EXCEPTION 'calculate_order_total: p_subtotal must be > 0, got %', p_subtotal
            USING ERRCODE = 'P0020';
    END IF;
    IF COALESCE(p_shipping_cost, 0) < 0 THEN
        RAISE EXCEPTION 'calculate_order_total: p_shipping_cost must be >= 0'
            USING ERRCODE = 'P0020';
    END IF;
    IF COALESCE(p_discount_amount, 0) < 0 THEN
        RAISE EXCEPTION 'calculate_order_total: p_discount_amount must be >= 0'
            USING ERRCODE = 'P0020';
    END IF;
    IF COALESCE(p_platform_fee, 0) < 0 THEN
        RAISE EXCEPTION 'calculate_order_total: p_platform_fee must be >= 0'
            USING ERRCODE = 'P0020';
    END IF;

    v_total := p_subtotal
             + COALESCE(p_shipping_cost,   0)
             - COALESCE(p_discount_amount, 0)
             + COALESCE(p_platform_fee,    0);

    -- Guard against negative totals (discount larger than order)
    IF v_total < 0 THEN
        RAISE EXCEPTION 'calculate_order_total: resulting total is negative (%). Discount exceeds subtotal + shipping + fee.',
            v_total
            USING ERRCODE = 'P0021';
    END IF;

    RETURN ROUND(v_total, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_order_total failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_order_total(NUMERIC, NUMERIC, NUMERIC, NUMERIC) IS
'Canonical order total formula: subtotal + shipping_cost - discount_amount + platform_fee. Raises if result is negative.';

-- -----------------------------------------------------------------------------
-- calculate_shipping_cost(weight_grams, origin_city, destination_city, courier)
--
-- Flat-rate approximation model for MVP.  Replace the rate table with a real
-- courier API lookup in production.  Rates are stored inline as a JSONB
-- constant to avoid a separate config table dependency.
-- STABLE — reads no tables; deterministic per session but designed to be
--          upgraded to a courier-API call (VOLATILE) in production.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_shipping_cost(
    p_weight_grams     NUMERIC(10, 2),
    p_origin_city      TEXT,
    p_destination_city TEXT,
    p_courier          TEXT DEFAULT 'standard'
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
    -- Base rates per 1000 g (1 kg) in IDR, by courier tier
    v_rate_per_kg   NUMERIC(15, 2);
    v_base_fee      NUMERIC(15, 2);
    v_weight_kg     NUMERIC(10, 4);
    v_same_city     BOOLEAN;
    v_cost          NUMERIC(15, 2);
BEGIN
    -- Validate
    IF p_weight_grams IS NULL OR p_weight_grams <= 0 THEN
        RAISE EXCEPTION 'calculate_shipping_cost: weight must be > 0, got %', p_weight_grams
            USING ERRCODE = 'P0030';
    END IF;
    IF p_origin_city IS NULL OR trim(p_origin_city) = '' THEN
        RAISE EXCEPTION 'calculate_shipping_cost: origin city must not be empty'
            USING ERRCODE = 'P0030';
    END IF;
    IF p_destination_city IS NULL OR trim(p_destination_city) = '' THEN
        RAISE EXCEPTION 'calculate_shipping_cost: destination city must not be empty'
            USING ERRCODE = 'P0030';
    END IF;

    v_same_city := lower(trim(p_origin_city)) = lower(trim(p_destination_city));

    -- Courier rate tiers (MVP flat-rate; replace with live API for production)
    CASE lower(COALESCE(p_courier, 'standard'))
        WHEN 'express'  THEN v_base_fee := 15000; v_rate_per_kg := 8000;
        WHEN 'same_day' THEN v_base_fee := 25000; v_rate_per_kg := 12000;
        WHEN 'economy'  THEN v_base_fee := 5000;  v_rate_per_kg := 3500;
        ELSE                 v_base_fee := 9000;  v_rate_per_kg := 5000; -- standard
    END CASE;

    -- Same-city discount 30%
    IF v_same_city THEN
        v_base_fee    := ROUND(v_base_fee    * 0.70, 0);
        v_rate_per_kg := ROUND(v_rate_per_kg * 0.70, 0);
    END IF;

    -- Chargeable weight rounded up to nearest kg, minimum 1 kg
    v_weight_kg := GREATEST(1, CEIL(p_weight_grams / 1000.0));
    v_cost      := v_base_fee + (v_weight_kg * v_rate_per_kg);

    RETURN ROUND(v_cost, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_shipping_cost failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_shipping_cost(NUMERIC, TEXT, TEXT, TEXT) IS
'MVP flat-rate shipping estimator. Returns cost in IDR. Upgrade p_courier lookup to a live API for production.';

-- -----------------------------------------------------------------------------
-- calculate_platform_fee(subtotal, fee_rate)
--
-- Computes the platform commission on an order subtotal.
-- Default rate 2% matches fn_complete_order_stats in 001_schema.sql.
-- IMMUTABLE — pure arithmetic.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_platform_fee(
    p_subtotal NUMERIC(15, 2),
    p_fee_rate NUMERIC(5, 4)  DEFAULT 0.0200   -- 2.00%
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_subtotal IS NULL OR p_subtotal < 0 THEN
        RAISE EXCEPTION 'calculate_platform_fee: p_subtotal must be >= 0, got %', p_subtotal
            USING ERRCODE = 'P0031';
    END IF;
    IF p_fee_rate IS NULL OR p_fee_rate < 0 OR p_fee_rate > 1 THEN
        RAISE EXCEPTION 'calculate_platform_fee: p_fee_rate must be in [0,1], got %', p_fee_rate
            USING ERRCODE = 'P0031';
    END IF;

    RETURN ROUND(p_subtotal * p_fee_rate, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_platform_fee failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_platform_fee(NUMERIC, NUMERIC) IS
'Returns platform commission = subtotal × fee_rate. Default rate is 2%. Must stay in sync with fn_complete_order_stats.';

-- -----------------------------------------------------------------------------
-- calculate_seller_income(subtotal, platform_fee_rate)
--
-- Net income credited to the seller after the platform fee.
-- IMMUTABLE — delegates to calculate_platform_fee.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_seller_income(
    p_subtotal         NUMERIC(15, 2),
    p_platform_fee_rate NUMERIC(5, 4) DEFAULT 0.0200
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_fee NUMERIC(15, 2);
BEGIN
    IF p_subtotal IS NULL OR p_subtotal < 0 THEN
        RAISE EXCEPTION 'calculate_seller_income: p_subtotal must be >= 0, got %', p_subtotal
            USING ERRCODE = 'P0032';
    END IF;

    v_fee := calculate_platform_fee(p_subtotal, p_platform_fee_rate);
    RETURN ROUND(p_subtotal - v_fee, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_seller_income failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_seller_income(NUMERIC, NUMERIC) IS
'Returns seller net income = subtotal − platform_fee. Delegates fee computation to calculate_platform_fee().';

-- -----------------------------------------------------------------------------
-- generate_order_number()
--
-- Produces a collision-free order number: MX-YYYYMMDD-XXXXXXXX
-- Retries up to 10 times before raising.  Matches fn_generate_order_number
-- in 001_schema.sql but is exposed as a standalone callable function.
-- VOLATILE — queries orders table and uses random().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(30)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_number TEXT;
    v_exists BOOLEAN;
    v_attempts INTEGER := 0;
    v_max_attempts CONSTANT INTEGER := 10;
BEGIN
    LOOP
        v_attempts := v_attempts + 1;

        v_number := 'MX-'
                 || TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD')
                 || '-'
                 || UPPER(SUBSTRING(MD5(random()::TEXT || clock_timestamp()::TEXT) FROM 1 FOR 8));

        SELECT EXISTS (
            SELECT 1 FROM orders WHERE order_number = v_number
        ) INTO v_exists;

        EXIT WHEN NOT v_exists;

        IF v_attempts >= v_max_attempts THEN
            RAISE EXCEPTION 'generate_order_number: could not generate unique order number after % attempts',
                v_max_attempts
                USING ERRCODE = 'P0033';
        END IF;
    END LOOP;

    RETURN v_number;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'generate_order_number failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION generate_order_number() IS
'Generates a collision-resistant order number in format MX-YYYYMMDD-XXXXXXXX. Retries up to 10 times.';

-- =============================================================================
-- SECTION 3 — PRODUCT FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- calculate_product_rating(p_product_id)
--
-- Computes the weighted average rating for a product from the reviews table.
-- Returns 0.00 when no reviews exist.
-- STABLE — reads reviews; does not modify data.
-- SECURITY DEFINER — needs to bypass RLS to aggregate all public reviews.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_product_rating(
    p_product_id UUID
)
RETURNS NUMERIC(3, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_rating NUMERIC(3, 2);
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'calculate_product_rating: p_product_id must not be null'
            USING ERRCODE = 'P0040';
    END IF;

    -- Verify product exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
        RAISE EXCEPTION 'calculate_product_rating: product % not found', p_product_id
            USING ERRCODE = 'P0041';
    END IF;

    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0.00)
    INTO   v_rating
    FROM   reviews
    WHERE  product_id = p_product_id;

    RETURN v_rating;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_product_rating failed for product %: %', p_product_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_product_rating(UUID) IS
'Returns the rounded average rating (0.00–5.00) for a product. Returns 0.00 when no reviews exist.';

-- -----------------------------------------------------------------------------
-- update_product_rating(p_product_id)
--
-- Recalculates and persists rating + review_count on products table.
-- Also cascades to the parent store rating.
-- VOLATILE — writes to products and stores.
-- SECURITY DEFINER — must bypass RLS to write aggregated stats.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_product_rating(
    p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_avg_rating   NUMERIC(3, 2);
    v_review_count INTEGER;
    v_store_id     UUID;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'update_product_rating: p_product_id must not be null'
            USING ERRCODE = 'P0040';
    END IF;

    -- Compute aggregates
    SELECT
        COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0.00),
        COUNT(*)
    INTO v_avg_rating, v_review_count
    FROM reviews
    WHERE product_id = p_product_id;

    -- Persist on product
    UPDATE products
    SET    rating       = v_avg_rating,
           review_count = v_review_count
    WHERE  id = p_product_id
    RETURNING store_id INTO v_store_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'update_product_rating: product % not found', p_product_id
            USING ERRCODE = 'P0041';
    END IF;

    -- Cascade: refresh parent store rating
    IF v_store_id IS NOT NULL THEN
        UPDATE stores
        SET    rating = COALESCE((
                   SELECT ROUND(AVG(p.rating)::NUMERIC, 2)
                   FROM   products p
                   WHERE  p.store_id = v_store_id
                     AND  p.status   = 'active'
                     AND  p.rating   > 0
               ), 0.00),
               review_count = COALESCE((
                   SELECT SUM(p.review_count)
                   FROM   products p
                   WHERE  p.store_id = v_store_id
               ), 0)
        WHERE  id = v_store_id;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'update_product_rating failed for product %: %', p_product_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION update_product_rating(UUID) IS
'Recalculates and persists products.rating and review_count, then cascades to the parent store rating.';

-- -----------------------------------------------------------------------------
-- calculate_product_stock(p_product_id)
--
-- For products with has_variants = TRUE: returns the sum of active SKU stocks.
-- For products without variants: returns products.stock directly.
-- STABLE — reads only; no writes.
-- SECURITY DEFINER — bypasses RLS to read internal stock figures.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_product_stock(
    p_product_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_has_variants BOOLEAN;
    v_stock        INTEGER;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'calculate_product_stock: p_product_id must not be null'
            USING ERRCODE = 'P0042';
    END IF;

    SELECT has_variants, stock
    INTO   v_has_variants, v_stock
    FROM   products
    WHERE  id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'calculate_product_stock: product % not found', p_product_id
            USING ERRCODE = 'P0043';
    END IF;

    IF v_has_variants THEN
        SELECT COALESCE(SUM(stock), 0)
        INTO   v_stock
        FROM   product_skus
        WHERE  product_id = p_product_id
          AND  is_active  = TRUE;
    END IF;

    RETURN v_stock;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_product_stock failed for product %: %', p_product_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_product_stock(UUID) IS
'Returns effective stock: sum of active SKU stocks for variant products, or direct products.stock for simple products.';

-- -----------------------------------------------------------------------------
-- check_product_availability(p_product_id, p_sku_id, p_quantity)
--
-- Returns TRUE when enough stock is available to fulfil p_quantity units.
-- Checks SKU stock when p_sku_id is provided, product stock otherwise.
-- STABLE — read-only.
-- SECURITY DEFINER — reads stock fields bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_product_availability(
    p_product_id UUID,
    p_quantity   INTEGER,
    p_sku_id     UUID    DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_status  product_status;
    v_stock   INTEGER;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'check_product_availability: p_product_id must not be null'
            USING ERRCODE = 'P0044';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'check_product_availability: p_quantity must be > 0, got %', p_quantity
            USING ERRCODE = 'P0044';
    END IF;

    -- Check product exists and is purchasable
    SELECT status
    INTO   v_status
    FROM   products
    WHERE  id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'check_product_availability: product % not found', p_product_id
            USING ERRCODE = 'P0045';
    END IF;

    IF v_status != 'active' THEN
        RETURN FALSE;
    END IF;

    -- Determine stock source
    IF p_sku_id IS NOT NULL THEN
        SELECT stock
        INTO   v_stock
        FROM   product_skus
        WHERE  id         = p_sku_id
          AND  product_id = p_product_id
          AND  is_active  = TRUE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'check_product_availability: SKU % not found or inactive for product %',
                p_sku_id, p_product_id
                USING ERRCODE = 'P0045';
        END IF;
    ELSE
        v_stock := calculate_product_stock(p_product_id);
    END IF;

    RETURN v_stock >= p_quantity;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'check_product_availability failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION check_product_availability(UUID, INTEGER, UUID) IS
'Returns TRUE if enough stock exists to fulfil the requested quantity. Checks SKU-level stock when p_sku_id is supplied.';

-- -----------------------------------------------------------------------------
-- calculate_discount_price(p_price, p_voucher_id)
--
-- Applies a voucher to a price and returns the resulting discount amount.
-- Does NOT modify any row — pure calculation.
-- Returns 0.00 when no valid voucher applies.
-- STABLE — reads vouchers table.
-- SECURITY DEFINER — reads voucher details bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_discount_price(
    p_price      NUMERIC(15, 2),
    p_voucher_id UUID
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_voucher  vouchers%ROWTYPE;
    v_discount NUMERIC(15, 2) := 0;
BEGIN
    IF p_price IS NULL OR p_price < 0 THEN
        RAISE EXCEPTION 'calculate_discount_price: p_price must be >= 0, got %', p_price
            USING ERRCODE = 'P0050';
    END IF;

    -- No voucher → zero discount
    IF p_voucher_id IS NULL THEN
        RETURN 0.00;
    END IF;

    SELECT *
    INTO   v_voucher
    FROM   vouchers
    WHERE  id = p_voucher_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'calculate_discount_price: voucher % not found', p_voucher_id
            USING ERRCODE = 'P0051';
    END IF;

    -- Validate voucher usability
    IF v_voucher.status != 'active' THEN
        RAISE EXCEPTION 'calculate_discount_price: voucher % is not active (status: %)',
            p_voucher_id, v_voucher.status
            USING ERRCODE = 'P0052';
    END IF;

    IF NOW() < v_voucher.start_date OR NOW() > v_voucher.end_date THEN
        RAISE EXCEPTION 'calculate_discount_price: voucher % is outside its validity window',
            p_voucher_id
            USING ERRCODE = 'P0052';
    END IF;

    IF p_price < v_voucher.minimum_purchase THEN
        -- Below minimum purchase threshold → no discount applied
        RETURN 0.00;
    END IF;

    IF v_voucher.quota IS NOT NULL AND v_voucher.used_count >= v_voucher.quota THEN
        RAISE EXCEPTION 'calculate_discount_price: voucher % quota exhausted (%/%)',
            p_voucher_id, v_voucher.used_count, v_voucher.quota
            USING ERRCODE = 'P0052';
    END IF;

    -- Compute discount by type
    CASE v_voucher.type
        WHEN 'percentage' THEN
            v_discount := ROUND(p_price * (v_voucher.value / 100.0), 2);
            -- Apply percentage cap if set
            IF v_voucher.max_discount IS NOT NULL THEN
                v_discount := LEAST(v_discount, v_voucher.max_discount);
            END IF;

        WHEN 'fixed_amount' THEN
            v_discount := LEAST(v_voucher.value, p_price);

        WHEN 'free_shipping' THEN
            -- Free-shipping vouchers reduce shipping cost, not subtotal.
            -- This function returns the subtotal discount only → 0 here.
            -- Shipping discount is applied in calculate_shipping_cost flow.
            v_discount := 0.00;

        ELSE
            RAISE EXCEPTION 'calculate_discount_price: unknown voucher type "%"', v_voucher.type
                USING ERRCODE = 'P0053';
    END CASE;

    RETURN GREATEST(ROUND(v_discount, 2), 0.00);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_discount_price failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_discount_price(NUMERIC, UUID) IS
'Returns the discount amount in currency units for a given price and voucher. Returns 0 for free_shipping vouchers (shipping handled separately).';

-- =============================================================================
-- SECTION 4 — SELLER FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- update_seller_statistics(p_seller_id)
--
-- Refreshes all counter-cache columns on the stores row owned by the seller:
-- total_sales, total_revenue, rating, review_count.
-- Intended for nightly reconciliation jobs or after bulk imports.
-- VOLATILE — writes to stores.
-- SECURITY DEFINER — writes aggregated stats bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_seller_statistics(
    p_seller_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    IF p_seller_id IS NULL THEN
        RAISE EXCEPTION 'update_seller_statistics: p_seller_id must not be null'
            USING ERRCODE = 'P0060';
    END IF;

    SELECT id INTO v_store_id FROM stores WHERE seller_id = p_seller_id LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'update_seller_statistics: no store found for seller %', p_seller_id
            USING ERRCODE = 'P0061';
    END IF;

    UPDATE stores s
    SET
        total_sales   = COALESCE((
            SELECT SUM(oi.quantity)
            FROM   order_items oi
            JOIN   orders o ON o.id = oi.order_id
            WHERE  oi.store_id = s.id
              AND  o.status    = 'completed'
        ), 0),

        total_revenue = COALESCE((
            SELECT SUM(oi.subtotal)
            FROM   order_items oi
            JOIN   orders o ON o.id = oi.order_id
            WHERE  oi.store_id = s.id
              AND  o.status    = 'completed'
        ), 0.00),

        rating = COALESCE((
            SELECT ROUND(AVG(p.rating)::NUMERIC, 2)
            FROM   products p
            WHERE  p.store_id = s.id
              AND  p.status   = 'active'
              AND  p.rating   > 0
        ), 0.00),

        review_count = COALESCE((
            SELECT SUM(p.review_count)
            FROM   products p
            WHERE  p.store_id = s.id
        ), 0)

    WHERE s.seller_id = p_seller_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'update_seller_statistics failed for seller %: %', p_seller_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION update_seller_statistics(UUID) IS
'Reconciles all counter-cache columns on the seller''s store row. Designed for nightly batch jobs.';

-- -----------------------------------------------------------------------------
-- update_store_rating(p_store_id)
--
-- Recomputes stores.rating and stores.review_count from live product data.
-- Granular version of the cascade inside update_product_rating().
-- VOLATILE — writes to stores.
-- SECURITY DEFINER — writes bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_store_rating(
    p_store_id UUID
)
RETURNS NUMERIC(3, 2)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_rating     NUMERIC(3, 2);
    v_rev_count  INTEGER;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'update_store_rating: p_store_id must not be null'
            USING ERRCODE = 'P0062';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id) THEN
        RAISE EXCEPTION 'update_store_rating: store % not found', p_store_id
            USING ERRCODE = 'P0063';
    END IF;

    SELECT
        COALESCE(ROUND(AVG(p.rating)::NUMERIC, 2), 0.00),
        COALESCE(SUM(p.review_count), 0)
    INTO v_rating, v_rev_count
    FROM products p
    WHERE p.store_id = p_store_id
      AND p.status   = 'active';

    UPDATE stores
    SET    rating       = v_rating,
           review_count = v_rev_count
    WHERE  id = p_store_id;

    RETURN v_rating;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'update_store_rating failed for store %: %', p_store_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION update_store_rating(UUID) IS
'Recomputes and persists stores.rating and review_count from active product ratings. Returns the new rating.';

-- -----------------------------------------------------------------------------
-- calculate_seller_balance(p_seller_id)
--
-- Returns the authoritative available_balance by summing the ledger.
-- Useful for reconciliation — compare against seller_balances.available_balance.
-- STABLE — read-only aggregate.
-- SECURITY DEFINER — reads financial ledger bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_seller_balance(
    p_seller_id UUID
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_balance NUMERIC(15, 2);
BEGIN
    IF p_seller_id IS NULL THEN
        RAISE EXCEPTION 'calculate_seller_balance: p_seller_id must not be null'
            USING ERRCODE = 'P0064';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_seller_id) THEN
        RAISE EXCEPTION 'calculate_seller_balance: seller % not found', p_seller_id
            USING ERRCODE = 'P0065';
    END IF;

    SELECT COALESCE(
        SUM(
            CASE transaction_type
                WHEN 'credit' THEN  amount
                WHEN 'debit'  THEN -amount
            END
        ), 0.00
    )
    INTO v_balance
    FROM seller_balance_transactions
    WHERE seller_id = p_seller_id;

    -- Balance must never be negative (constraint in seller_balances)
    IF v_balance < 0 THEN
        RAISE WARNING 'calculate_seller_balance: computed balance for seller % is negative (%). Data integrity issue.',
            p_seller_id, v_balance;
    END IF;

    RETURN ROUND(v_balance, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_seller_balance failed for seller %: %', p_seller_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_seller_balance(UUID) IS
'Recomputes seller available_balance from the immutable ledger. Use for reconciliation against seller_balances.available_balance.';

-- -----------------------------------------------------------------------------
-- calculate_total_sales(p_seller_id)
--
-- Returns the total gross revenue for all completed orders of a seller.
-- STABLE — read-only.
-- SECURITY DEFINER — reads order_items bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_total_sales(
    p_seller_id UUID
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_total NUMERIC(15, 2);
BEGIN
    IF p_seller_id IS NULL THEN
        RAISE EXCEPTION 'calculate_total_sales: p_seller_id must not be null'
            USING ERRCODE = 'P0066';
    END IF;

    SELECT COALESCE(SUM(oi.subtotal), 0.00)
    INTO   v_total
    FROM   order_items oi
    JOIN   orders o ON o.id = oi.order_id
    WHERE  oi.seller_id = p_seller_id
      AND  o.status     = 'completed';

    RETURN ROUND(v_total, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_total_sales failed for seller %: %', p_seller_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_total_sales(UUID) IS
'Returns total gross revenue from all completed orders for a seller.';

-- -----------------------------------------------------------------------------
-- calculate_monthly_sales(p_seller_id, p_year, p_month)
--
-- Returns gross revenue for a specific calendar month.
-- STABLE — read-only.
-- SECURITY DEFINER — reads order_items bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_monthly_sales(
    p_seller_id UUID,
    p_year      INTEGER,
    p_month     INTEGER
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_total      NUMERIC(15, 2);
    v_start_date TIMESTAMPTZ;
    v_end_date   TIMESTAMPTZ;
BEGIN
    IF p_seller_id IS NULL THEN
        RAISE EXCEPTION 'calculate_monthly_sales: p_seller_id must not be null'
            USING ERRCODE = 'P0067';
    END IF;
    IF p_year IS NULL OR p_year < 2020 OR p_year > 2100 THEN
        RAISE EXCEPTION 'calculate_monthly_sales: invalid year %, must be between 2020 and 2100', p_year
            USING ERRCODE = 'P0067';
    END IF;
    IF p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
        RAISE EXCEPTION 'calculate_monthly_sales: invalid month %, must be 1–12', p_month
            USING ERRCODE = 'P0067';
    END IF;

    v_start_date := DATE_TRUNC('month', make_date(p_year, p_month, 1)::TIMESTAMP WITH TIME ZONE);
    v_end_date   := v_start_date + INTERVAL '1 month';

    SELECT COALESCE(SUM(oi.subtotal), 0.00)
    INTO   v_total
    FROM   order_items oi
    JOIN   orders o ON o.id = oi.order_id
    WHERE  oi.seller_id    = p_seller_id
      AND  o.status        = 'completed'
      AND  o.completed_at >= v_start_date
      AND  o.completed_at  < v_end_date;

    RETURN ROUND(v_total, 2);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_monthly_sales failed for seller % (%-%): %',
            p_seller_id, p_year, p_month, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_monthly_sales(UUID, INTEGER, INTEGER) IS
'Returns gross revenue from completed orders for a seller in the given calendar month (UTC).';

-- =============================================================================
-- SECTION 5 — PAYMENT FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- validate_payment(p_payment_id)
--
-- Performs a series of business-rule checks on an existing payment record.
-- Returns a JSONB object: { valid: bool, reason: text | null }
-- STABLE — read-only.
-- SECURITY DEFINER — reads payments and orders bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_payment(
    p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_payment  payments%ROWTYPE;
    v_order    orders%ROWTYPE;
BEGIN
    IF p_payment_id IS NULL THEN
        RAISE EXCEPTION 'validate_payment: p_payment_id must not be null'
            USING ERRCODE = 'P0070';
    END IF;

    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', FALSE, 'reason', 'Payment record not found');
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_payment.order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', FALSE, 'reason', 'Associated order not found');
    END IF;

    -- Already succeeded or refunded
    IF v_payment.status = 'success' THEN
        RETURN jsonb_build_object('valid', TRUE, 'reason', NULL);
    END IF;
    IF v_payment.status IN ('refunded', 'chargeback') THEN
        RETURN jsonb_build_object('valid', FALSE, 'reason',
            format('Payment already in terminal state: %s', v_payment.status));
    END IF;

    -- Expired check
    IF v_payment.status = 'expired'
       OR (v_payment.expired_at IS NOT NULL AND v_payment.expired_at < NOW()) THEN
        RETURN jsonb_build_object('valid', FALSE, 'reason', 'Payment has expired');
    END IF;

    -- Amount mismatch
    IF v_payment.amount != v_order.total_amount THEN
        RETURN jsonb_build_object('valid', FALSE, 'reason',
            format('Payment amount (%.2s) does not match order total (%.2s)',
                   v_payment.amount, v_order.total_amount));
    END IF;

    -- Order in wrong state
    IF v_order.status NOT IN ('pending', 'awaiting_payment') THEN
        RETURN jsonb_build_object('valid', FALSE, 'reason',
            format('Order status "%s" does not accept payment', v_order.status));
    END IF;

    -- Order already paid
    IF v_order.payment_status = 'success' THEN
        RETURN jsonb_build_object('valid', FALSE, 'reason', 'Order has already been paid');
    END IF;

    RETURN jsonb_build_object('valid', TRUE, 'reason', NULL);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'validate_payment failed for payment %: %', p_payment_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION validate_payment(UUID) IS
'Validates a payment record against business rules. Returns JSON {valid: bool, reason: text|null}.';

-- -----------------------------------------------------------------------------
-- calculate_payment_status(p_order_id)
--
-- Derives the effective payment status for an order by inspecting all its
-- payment attempts.  Returns the most authoritative status.
-- STABLE — read-only.
-- SECURITY DEFINER — reads payments bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_payment_status(
    p_order_id UUID
)
RETURNS payment_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_status payment_status;
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'calculate_payment_status: p_order_id must not be null'
            USING ERRCODE = 'P0071';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id) THEN
        RAISE EXCEPTION 'calculate_payment_status: order % not found', p_order_id
            USING ERRCODE = 'P0072';
    END IF;

    -- Priority: success > chargeback > refunded > failed > expired > pending
    SELECT
        CASE
            WHEN bool_or(status = 'success')    THEN 'success'
            WHEN bool_or(status = 'chargeback') THEN 'chargeback'
            WHEN bool_or(status = 'refunded')   THEN 'refunded'
            WHEN bool_or(status = 'failed')     THEN 'failed'
            WHEN bool_or(status = 'expired')    THEN 'expired'
            ELSE 'pending'
        END::payment_status
    INTO v_status
    FROM payments
    WHERE order_id = p_order_id;

    -- No payment rows yet
    IF v_status IS NULL THEN
        v_status := 'pending';
    END IF;

    RETURN v_status;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'calculate_payment_status failed for order %: %', p_order_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION calculate_payment_status(UUID) IS
'Derives the effective payment_status for an order from all its payment attempts. Priority: success > chargeback > refunded > failed > expired > pending.';

-- -----------------------------------------------------------------------------
-- generate_invoice_number(p_order_id)
--
-- Generates a human-readable invoice number tied to the order.
-- Format: INV-YYYYMMDD-<last 8 chars of order_id>
-- Idempotent: returns the same value for the same order.
-- STABLE — reads orders; deterministic output per order.
-- SECURITY DEFINER — reads orders bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invoice_number(
    p_order_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_created_at TIMESTAMPTZ;
    v_invoice    TEXT;
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'generate_invoice_number: p_order_id must not be null'
            USING ERRCODE = 'P0073';
    END IF;

    SELECT created_at INTO v_created_at FROM orders WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'generate_invoice_number: order % not found', p_order_id
            USING ERRCODE = 'P0074';
    END IF;

    v_invoice := 'INV-'
              || TO_CHAR(v_created_at AT TIME ZONE 'UTC', 'YYYYMMDD')
              || '-'
              || UPPER(REPLACE(p_order_id::TEXT, '-', ''))::TEXT;
    v_invoice := LEFT(v_invoice, 40);   -- hard cap

    RETURN v_invoice;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'generate_invoice_number failed for order %: %', p_order_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION generate_invoice_number(UUID) IS
'Returns a deterministic invoice number INV-YYYYMMDD-<order_id_hex>. Idempotent for the same order.';

-- =============================================================================
-- SECTION 6 — INVENTORY FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- add_stock(p_product_id, p_quantity, p_sku_id, p_note, p_actor_id)
--
-- Adds stock to a product (and its SKU when specified).
-- Writes a stock_movements audit row.
-- VOLATILE — modifies products, product_skus, stock_movements.
-- SECURITY DEFINER — modifies stock bypassing RLS on behalf of trusted callers.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_stock(
    p_product_id UUID,
    p_quantity   INTEGER,
    p_sku_id     UUID    DEFAULT NULL,
    p_note       TEXT    DEFAULT NULL,
    p_actor_id   UUID    DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_stock_before INTEGER;
    v_stock_after  INTEGER;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'add_stock: p_product_id must not be null'
            USING ERRCODE = 'P0080';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'add_stock: p_quantity must be > 0, got %', p_quantity
            USING ERRCODE = 'P0080';
    END IF;

    -- Lock and update product stock
    SELECT stock INTO v_stock_before FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'add_stock: product % not found', p_product_id
            USING ERRCODE = 'P0081';
    END IF;

    v_stock_after := v_stock_before + p_quantity;

    UPDATE products SET stock = v_stock_after WHERE id = p_product_id;

    -- If a SKU is specified, update its stock too
    IF p_sku_id IS NOT NULL THEN
        UPDATE product_skus
        SET    stock = stock + p_quantity
        WHERE  id         = p_sku_id
          AND  product_id = p_product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'add_stock: SKU % not found for product %', p_sku_id, p_product_id
                USING ERRCODE = 'P0081';
        END IF;
    END IF;

    -- Audit trail
    INSERT INTO stock_movements (
        product_id, product_sku_id, movement_type,
        quantity_delta, stock_before, stock_after,
        reference_type, note, created_by
    ) VALUES (
        p_product_id, p_sku_id, 'purchase',
        p_quantity, v_stock_before, v_stock_after,
        'manual', p_note, p_actor_id
    );

    -- Auto-activate product if it was out_of_stock
    UPDATE products
    SET    status = 'active'
    WHERE  id     = p_product_id
      AND  status = 'out_of_stock';

    RETURN v_stock_after;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'add_stock failed for product %: %', p_product_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION add_stock(UUID, INTEGER, UUID, TEXT, UUID) IS
'Adds inventory to a product (and its SKU). Writes a stock_movements audit row. Auto-activates out_of_stock products.';

-- -----------------------------------------------------------------------------
-- remove_stock(p_product_id, p_quantity, p_sku_id, p_movement_type,
--              p_reference_type, p_reference_id, p_note, p_actor_id)
--
-- Deducts stock with full validation and audit trail.
-- Raises if stock would go negative.
-- VOLATILE — modifies products, product_skus, stock_movements.
-- SECURITY DEFINER — modifies stock bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION remove_stock(
    p_product_id     UUID,
    p_quantity       INTEGER,
    p_sku_id         UUID                DEFAULT NULL,
    p_movement_type  stock_movement_type DEFAULT 'sale',
    p_reference_type VARCHAR(50)         DEFAULT NULL,
    p_reference_id   UUID                DEFAULT NULL,
    p_note           TEXT                DEFAULT NULL,
    p_actor_id       UUID                DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_stock_before INTEGER;
    v_stock_after  INTEGER;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'remove_stock: p_product_id must not be null'
            USING ERRCODE = 'P0082';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'remove_stock: p_quantity must be > 0, got %', p_quantity
            USING ERRCODE = 'P0082';
    END IF;

    -- Lock product
    SELECT stock INTO v_stock_before FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'remove_stock: product % not found', p_product_id
            USING ERRCODE = 'P0083';
    END IF;

    IF v_stock_before < p_quantity THEN
        RAISE EXCEPTION 'remove_stock: insufficient stock for product %. Available: %, requested: %',
            p_product_id, v_stock_before, p_quantity
            USING ERRCODE = 'P0084';
    END IF;

    v_stock_after := v_stock_before - p_quantity;

    UPDATE products SET stock = v_stock_after WHERE id = p_product_id;

    -- SKU-level update
    IF p_sku_id IS NOT NULL THEN
        DECLARE
            v_sku_before INTEGER;
        BEGIN
            SELECT stock INTO v_sku_before FROM product_skus WHERE id = p_sku_id FOR UPDATE;

            IF v_sku_before < p_quantity THEN
                RAISE EXCEPTION 'remove_stock: insufficient SKU stock for SKU %. Available: %, requested: %',
                    p_sku_id, v_sku_before, p_quantity
                    USING ERRCODE = 'P0084';
            END IF;

            UPDATE product_skus SET stock = stock - p_quantity WHERE id = p_sku_id;
        END;
    END IF;

    -- Audit trail
    INSERT INTO stock_movements (
        product_id, product_sku_id, movement_type,
        quantity_delta, stock_before, stock_after,
        reference_type, reference_id, note, created_by
    ) VALUES (
        p_product_id, p_sku_id, p_movement_type,
        -p_quantity, v_stock_before, v_stock_after,
        p_reference_type, p_reference_id, p_note, p_actor_id
    );

    -- Auto-mark out_of_stock
    IF v_stock_after = 0 THEN
        UPDATE products
        SET    status = 'out_of_stock'
        WHERE  id     = p_product_id
          AND  status = 'active';
    END IF;

    RETURN v_stock_after;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'remove_stock failed for product %: %', p_product_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION remove_stock(UUID, INTEGER, UUID, stock_movement_type, VARCHAR, UUID, TEXT, UUID) IS
'Deducts stock from a product/SKU with validation. Writes audit row. Auto-marks product out_of_stock when stock reaches 0.';

-- -----------------------------------------------------------------------------
-- reserve_stock(p_product_id, p_quantity, p_sku_id, p_reference_id)
--
-- Reserves stock for a flash-sale or pre-order scenario without finalising
-- the sale.  Moves quantity from available (products.stock) to a logical
-- reserved state tracked in stock_movements.
-- VOLATILE — modifies products, product_skus, stock_movements.
-- SECURITY DEFINER — stock modifications bypass RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reserve_stock(
    p_product_id  UUID,
    p_quantity    INTEGER,
    p_sku_id      UUID DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_stock_before INTEGER;
    v_stock_after  INTEGER;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'reserve_stock: p_product_id must not be null'
            USING ERRCODE = 'P0085';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'reserve_stock: p_quantity must be > 0, got %', p_quantity
            USING ERRCODE = 'P0085';
    END IF;

    SELECT stock INTO v_stock_before FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'reserve_stock: product % not found', p_product_id
            USING ERRCODE = 'P0086';
    END IF;

    IF v_stock_before < p_quantity THEN
        RAISE EXCEPTION 'reserve_stock: insufficient stock for product %. Available: %, requested: %',
            p_product_id, v_stock_before, p_quantity
            USING ERRCODE = 'P0087';
    END IF;

    v_stock_after := v_stock_before - p_quantity;

    UPDATE products SET stock = v_stock_after WHERE id = p_product_id;

    IF p_sku_id IS NOT NULL THEN
        UPDATE product_skus SET stock = stock - p_quantity
        WHERE id = p_sku_id AND product_id = p_product_id;
    END IF;

    INSERT INTO stock_movements (
        product_id, product_sku_id, movement_type,
        quantity_delta, stock_before, stock_after,
        reference_type, reference_id, note
    ) VALUES (
        p_product_id, p_sku_id, 'flash_sale_reserve',
        -p_quantity, v_stock_before, v_stock_after,
        'flash_sale', p_reference_id, 'Stock reserved for flash sale'
    );

    RETURN v_stock_after;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'reserve_stock failed for product %: %', p_product_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION reserve_stock(UUID, INTEGER, UUID, UUID) IS
'Reduces available stock for a flash-sale reservation. Writes a flash_sale_reserve movement. Pair with release_reserved_stock() on cancellation.';

-- -----------------------------------------------------------------------------
-- release_reserved_stock(p_product_id, p_quantity, p_sku_id, p_reference_id)
--
-- Returns previously reserved stock back to available.
-- VOLATILE — modifies products, product_skus, stock_movements.
-- SECURITY DEFINER — stock modifications bypass RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_reserved_stock(
    p_product_id   UUID,
    p_quantity     INTEGER,
    p_sku_id       UUID DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_stock_before INTEGER;
    v_stock_after  INTEGER;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'release_reserved_stock: p_product_id must not be null'
            USING ERRCODE = 'P0088';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'release_reserved_stock: p_quantity must be > 0, got %', p_quantity
            USING ERRCODE = 'P0088';
    END IF;

    SELECT stock INTO v_stock_before FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'release_reserved_stock: product % not found', p_product_id
            USING ERRCODE = 'P0089';
    END IF;

    v_stock_after := v_stock_before + p_quantity;

    UPDATE products SET stock = v_stock_after WHERE id = p_product_id;

    IF p_sku_id IS NOT NULL THEN
        UPDATE product_skus SET stock = stock + p_quantity
        WHERE id = p_sku_id AND product_id = p_product_id;
    END IF;

    INSERT INTO stock_movements (
        product_id, product_sku_id, movement_type,
        quantity_delta, stock_before, stock_after,
        reference_type, reference_id, note
    ) VALUES (
        p_product_id, p_sku_id, 'flash_sale_release',
        p_quantity, v_stock_before, v_stock_after,
        'flash_sale', p_reference_id, 'Reserved stock released'
    );

    -- Re-activate if it was out_of_stock
    UPDATE products
    SET    status = 'active'
    WHERE  id     = p_product_id
      AND  status = 'out_of_stock';

    RETURN v_stock_after;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'release_reserved_stock failed for product %: %', p_product_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION release_reserved_stock(UUID, INTEGER, UUID, UUID) IS
'Returns previously reserved stock back to available inventory. Writes a flash_sale_release movement.';

-- =============================================================================
-- SECTION 7 — SEARCH FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- search_products(p_query, p_category_id, p_brand_id, p_min_price,
--                 p_max_price, p_min_rating, p_condition, p_sort,
--                 p_limit, p_offset)
--
-- Full-text + trigram product search with faceted filtering.
-- Returns a result set compatible with vw_active_products.
-- STABLE — read-only.
-- SECURITY DEFINER — aggregates public catalog data bypassing per-row RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_products(
    p_query       TEXT    DEFAULT NULL,
    p_category_id UUID    DEFAULT NULL,
    p_brand_id    UUID    DEFAULT NULL,
    p_min_price   NUMERIC DEFAULT NULL,
    p_max_price   NUMERIC DEFAULT NULL,
    p_min_rating  NUMERIC DEFAULT NULL,
    p_condition   TEXT    DEFAULT NULL,
    p_sort        TEXT    DEFAULT 'relevance',   -- relevance|price_asc|price_desc|rating|newest|sold
    p_limit       INTEGER DEFAULT 20,
    p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
    id               UUID,
    name             VARCHAR(255),
    slug             VARCHAR(270),
    price            NUMERIC(15, 2),
    discount_price   NUMERIC(15, 2),
    stock            INTEGER,
    rating           NUMERIC(3, 2),
    review_count     INTEGER,
    sold_count       INTEGER,
    condition        product_condition,
    store_id         UUID,
    store_name       VARCHAR(100),
    store_slug       VARCHAR(110),
    category_id      UUID,
    category_name    VARCHAR(100),
    brand_id         UUID,
    brand_name       VARCHAR(100),
    primary_image_url TEXT,
    relevance_score  REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_ts_query TSQUERY;
BEGIN
    -- Validate inputs
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'search_products: p_limit must be between 1 and 100, got %', p_limit
            USING ERRCODE = 'P0090';
    END IF;
    IF p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'search_products: p_offset must be >= 0, got %', p_offset
            USING ERRCODE = 'P0090';
    END IF;
    IF p_min_price IS NOT NULL AND p_min_price < 0 THEN
        RAISE EXCEPTION 'search_products: p_min_price must be >= 0'
            USING ERRCODE = 'P0090';
    END IF;
    IF p_max_price IS NOT NULL AND p_min_price IS NOT NULL AND p_max_price < p_min_price THEN
        RAISE EXCEPTION 'search_products: p_max_price (%) must be >= p_min_price (%)', p_max_price, p_min_price
            USING ERRCODE = 'P0090';
    END IF;
    IF p_min_rating IS NOT NULL AND (p_min_rating < 0 OR p_min_rating > 5) THEN
        RAISE EXCEPTION 'search_products: p_min_rating must be 0–5, got %', p_min_rating
            USING ERRCODE = 'P0090';
    END IF;
    IF p_sort NOT IN ('relevance','price_asc','price_desc','rating','newest','sold') THEN
        RAISE EXCEPTION 'search_products: invalid sort "%" – valid: relevance|price_asc|price_desc|rating|newest|sold', p_sort
            USING ERRCODE = 'P0090';
    END IF;

    -- Parse full-text query safely
    IF p_query IS NOT NULL AND trim(p_query) != '' THEN
        BEGIN
            v_ts_query := plainto_tsquery('english', p_query);
        EXCEPTION WHEN OTHERS THEN
            v_ts_query := NULL;
        END;
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT
            p.id,
            p.name,
            p.slug,
            COALESCE(p.discount_price, p.price)          AS effective_price,
            p.price,
            p.discount_price,
            p.stock,
            p.rating,
            p.review_count,
            p.sold_count,
            p.condition,
            p.store_id,
            p.category_id,
            p.brand_id,
            s.store_name,
            s.slug                                        AS store_slug,
            c.name                                        AS category_name,
            b.name                                        AS brand_name,
            (
                SELECT pi.image_url FROM product_images pi
                WHERE  pi.product_id = p.id AND pi.is_primary = TRUE
                ORDER  BY pi.sort_order LIMIT 1
            )                                             AS primary_image_url,
            CASE
                WHEN v_ts_query IS NOT NULL THEN
                    ts_rank_cd(
                        to_tsvector('english',
                            coalesce(p.name, '') || ' ' || coalesce(p.description, '')),
                        v_ts_query
                    )
                ELSE 0.0
            END                                           AS relevance_score
        FROM  products    p
        JOIN  stores      s ON s.id = p.store_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands     b ON b.id = p.brand_id
        WHERE p.status   = 'active'
          AND s.status   = 'active'
          -- Full-text filter (only when query provided)
          AND (
              v_ts_query IS NULL
              OR to_tsvector('english',
                     coalesce(p.name, '') || ' ' || coalesce(p.description, ''))
                 @@ v_ts_query
              OR p.name ILIKE '%' || p_query || '%'   -- trigram fallback
          )
          -- Category filter (includes descendants via self-join)
          AND (p_category_id IS NULL OR p.category_id = p_category_id
               OR p.category_id IN (
                   SELECT id FROM categories
                   WHERE parent_id = p_category_id
               ))
          -- Brand filter
          AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
          -- Price range
          AND (p_min_price IS NULL OR COALESCE(p.discount_price, p.price) >= p_min_price)
          AND (p_max_price IS NULL OR COALESCE(p.discount_price, p.price) <= p_max_price)
          -- Rating filter
          AND (p_min_rating IS NULL OR p.rating >= p_min_rating)
          -- Condition filter
          AND (p_condition IS NULL OR p.condition::TEXT = p_condition)
    )
    SELECT
        base.id,
        base.name,
        base.slug,
        base.price,
        base.discount_price,
        base.stock,
        base.rating,
        base.review_count,
        base.sold_count,
        base.condition,
        base.store_id,
        base.store_name,
        base.store_slug,
        base.category_id,
        base.category_name,
        base.brand_id,
        base.brand_name,
        base.primary_image_url,
        base.relevance_score
    FROM base
    ORDER BY
        CASE p_sort
            WHEN 'price_asc'  THEN base.effective_price END ASC,
        CASE p_sort
            WHEN 'price_desc' THEN base.effective_price END DESC,
        CASE p_sort
            WHEN 'rating'     THEN base.rating END DESC,
        CASE p_sort
            WHEN 'newest'     THEN EXTRACT(EPOCH FROM (SELECT created_at FROM products WHERE id = base.id)) END DESC,
        CASE p_sort
            WHEN 'sold'       THEN base.sold_count END DESC,
        -- Default: relevance (or sold when no query)
        CASE WHEN p_sort = 'relevance' AND v_ts_query IS NOT NULL
             THEN base.relevance_score END DESC,
        CASE WHEN p_sort = 'relevance' AND v_ts_query IS NULL
             THEN base.sold_count END DESC,
        base.id   -- stable tie-break
    LIMIT  p_limit
    OFFSET p_offset;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'search_products failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION search_products(TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, INTEGER, INTEGER) IS
'Full-text + trigram product search with price, rating, category, brand, and condition filters. Supports 6 sort modes.';

-- -----------------------------------------------------------------------------
-- search_store(p_query, p_city, p_min_rating, p_sort, p_limit, p_offset)
--
-- Searches active stores by name or description with optional geo-city filter.
-- STABLE — read-only.
-- SECURITY DEFINER — reads public store data bypassing RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_store(
    p_query      TEXT    DEFAULT NULL,
    p_city       TEXT    DEFAULT NULL,
    p_min_rating NUMERIC DEFAULT NULL,
    p_sort       TEXT    DEFAULT 'relevance',   -- relevance|rating|followers|newest
    p_limit      INTEGER DEFAULT 20,
    p_offset     INTEGER DEFAULT 0
)
RETURNS TABLE (
    id             UUID,
    store_name     VARCHAR(100),
    slug           VARCHAR(110),
    description    TEXT,
    logo_url       TEXT,
    banner_url     TEXT,
    rating         NUMERIC(3, 2),
    review_count   INTEGER,
    follower_count INTEGER,
    total_sales    INTEGER,
    city           VARCHAR(100),
    relevance_score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_ts_query TSQUERY;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'search_store: p_limit must be between 1 and 100, got %', p_limit
            USING ERRCODE = 'P0091';
    END IF;
    IF p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'search_store: p_offset must be >= 0, got %', p_offset
            USING ERRCODE = 'P0091';
    END IF;
    IF p_min_rating IS NOT NULL AND (p_min_rating < 0 OR p_min_rating > 5) THEN
        RAISE EXCEPTION 'search_store: p_min_rating must be 0–5, got %', p_min_rating
            USING ERRCODE = 'P0091';
    END IF;
    IF p_sort NOT IN ('relevance', 'rating', 'followers', 'newest') THEN
        RAISE EXCEPTION 'search_store: invalid sort "%" – valid: relevance|rating|followers|newest', p_sort
            USING ERRCODE = 'P0091';
    END IF;

    IF p_query IS NOT NULL AND trim(p_query) != '' THEN
        BEGIN
            v_ts_query := plainto_tsquery('english', p_query);
        EXCEPTION WHEN OTHERS THEN
            v_ts_query := NULL;
        END;
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.store_name,
        s.slug,
        s.description,
        s.logo_url,
        s.banner_url,
        s.rating,
        s.review_count,
        s.follower_count,
        s.total_sales,
        s.city,
        CASE
            WHEN v_ts_query IS NOT NULL THEN
                ts_rank_cd(
                    to_tsvector('english',
                        coalesce(s.store_name, '') || ' ' || coalesce(s.description, '')),
                    v_ts_query
                )
            ELSE 0.0
        END::REAL                                       AS relevance_score
    FROM  stores s
    WHERE s.status = 'active'
      AND (
          p_query IS NULL
          OR trim(p_query) = ''
          OR s.store_name ILIKE '%' || p_query || '%'
          OR (v_ts_query IS NOT NULL
              AND to_tsvector('english',
                      coalesce(s.store_name, '') || ' ' || coalesce(s.description, ''))
                  @@ v_ts_query)
      )
      AND (p_city IS NULL OR lower(trim(s.city)) = lower(trim(p_city)))
      AND (p_min_rating IS NULL OR s.rating >= p_min_rating)
    ORDER BY
        CASE p_sort WHEN 'rating'     THEN s.rating          END DESC,
        CASE p_sort WHEN 'followers'  THEN s.follower_count   END DESC,
        CASE p_sort WHEN 'newest'     THEN EXTRACT(EPOCH FROM s.created_at) END DESC,
        CASE WHEN p_sort = 'relevance' AND v_ts_query IS NOT NULL
             THEN relevance_score END DESC,
        CASE WHEN p_sort = 'relevance' AND v_ts_query IS NULL
             THEN s.follower_count END DESC,
        s.id
    LIMIT  p_limit
    OFFSET p_offset;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'search_store failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION search_store(TEXT, TEXT, NUMERIC, TEXT, INTEGER, INTEGER) IS
'Full-text store search with city, rating filters and 4 sort modes. Returns active stores only.';

-- =============================================================================
-- SECTION 8 — NOTIFICATION FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_notification(p_user_id, p_type, p_title, p_message,
--                     p_reference_id, p_reference_type, p_action_url)
--
-- Inserts a notification row and returns its UUID.
-- All notification creation must go through this function to ensure uniform
-- data quality and a single audit point.
-- VOLATILE — inserts into notifications.
-- SECURITY DEFINER — writes bypassing RLS (server-side only).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id        UUID,
    p_type           notification_type,
    p_title          TEXT,
    p_message        TEXT,
    p_reference_id   UUID    DEFAULT NULL,
    p_reference_type TEXT    DEFAULT NULL,
    p_action_url     TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    -- Validate required fields
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'create_notification: p_user_id must not be null'
            USING ERRCODE = 'P0100';
    END IF;
    IF p_type IS NULL THEN
        RAISE EXCEPTION 'create_notification: p_type must not be null'
            USING ERRCODE = 'P0100';
    END IF;
    IF p_title IS NULL OR trim(p_title) = '' THEN
        RAISE EXCEPTION 'create_notification: p_title must not be empty'
            USING ERRCODE = 'P0100';
    END IF;
    IF p_message IS NULL OR trim(p_message) = '' THEN
        RAISE EXCEPTION 'create_notification: p_message must not be empty'
            USING ERRCODE = 'P0100';
    END IF;

    -- Verify the target user exists and is not banned
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id     = p_user_id
          AND status NOT IN ('banned', 'suspended')
    ) THEN
        RAISE WARNING 'create_notification: user % is not active — notification skipped', p_user_id;
        RETURN NULL;
    END IF;

    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        reference_id,
        reference_type,
        action_url
    ) VALUES (
        p_user_id,
        p_type,
        left(trim(p_title),   255),
        left(trim(p_message), 2000),
        p_reference_id,
        p_reference_type,
        p_action_url
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'create_notification failed for user %: %', p_user_id, SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION create_notification(UUID, notification_type, TEXT, TEXT, UUID, TEXT, TEXT) IS
'Single entry point for creating notifications. Validates user state, trims content, and returns the new notification UUID. Returns NULL for banned/suspended users.';

-- =============================================================================
-- END OF 003_functions.sql
-- =============================================================================
