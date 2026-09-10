-- =============================================================================
-- MARKETPLACEX — ATOMIC CHECKOUT RPC
-- File   : database/007_create_order_from_cart.sql
-- Version: 2.0
-- Depends: 001_schema.sql, 003_functions.sql
--
-- Purpose
--   Single SECURITY DEFINER function that executes the entire buyer checkout
--   flow atomically: validates buyer, validates cart + stock, creates order,
--   creates order_items (trigger handles stock reservation), creates pending
--   payment, removes cart items.  All inside one database transaction.
--
-- Security
--   SECURITY DEFINER — runs as the function owner (not the caller).
--   Explicit search_path prevents search-path hijacking.
--   Caller identity validated via auth.uid(); no service_role key needed.
--   Privileges locked down via 008_harden_order_trigger_functions.sql
--   (REVOKE from PUBLIC, GRANT to authenticated).
--
-- Concurrency safety
--   Product and SKU rows are locked FOR UPDATE BEFORE stock is validated.
--   Stock values are re-read AFTER the lock is acquired to prevent the
--   TOCTOU race where two concurrent checkouts both pass validation on
--   stale pre-lock values.
--
-- SKU stock safety
--   When a cart_item has product_sku_id IS NOT NULL, the corresponding
--   product_skus row is locked FOR UPDATE and its stock is checked against
--   the requested quantity.  Insufficient SKU stock aborts the entire
--   transaction.  The parent trigger (fn_reserve_product_stock) also
--   validates SKU stock as a belt-and-suspenders safety net.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_order_from_cart(
    p_recipient_name  VARCHAR(150),
    p_phone           VARCHAR(20),
    p_address_detail  TEXT,
    p_province        VARCHAR(100),
    p_city            VARCHAR(100),
    p_postal_code     VARCHAR(10),
    p_payment_method  payment_method DEFAULT 'bank_transfer'::payment_method
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_auth_id           UUID;
    v_user_id           UUID;
    v_cart_id           UUID;
    v_order_id          UUID;
    v_order_number      VARCHAR(30);
    v_subtotal          NUMERIC(15,2) := 0;
    v_platform_fee      NUMERIC(15,2);
    v_total             NUMERIC(15,2);
    v_payment_id        UUID;
    v_transaction_id    VARCHAR(255);
    v_payment_due_at    TIMESTAMPTZ;
    v_shipping_snapshot JSONB;
    v_cart_item         RECORD;
    v_image_url         TEXT;
    v_unit_price        NUMERIC(15,2);
    v_item_subtotal     NUMERIC(15,2);
    v_locked_stock      INTEGER;
    v_locked_sku_stock  INTEGER;
BEGIN
    -- =========================================================================
    -- 1. AUTHENTICATE — verify JWT is present
    -- =========================================================================
    v_auth_id := auth.uid();
    IF v_auth_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = 'P0001';
    END IF;

    -- =========================================================================
    -- 2. RESOLVE BUYER — map auth.uid() to internal users.id, validate role
    -- =========================================================================
    SELECT id INTO v_user_id
    FROM   users
    WHERE  auth_id = v_auth_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User account not found.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE  id = v_user_id
        AND    role = 'buyer'
        AND    status = 'active'
    ) THEN
        RAISE EXCEPTION 'Only active buyers can place orders.'
            USING ERRCODE = 'P0001';
    END IF;

    -- =========================================================================
    -- 3. LOCATE CART — one cart per buyer (enforced by UNIQUE on user_id)
    -- =========================================================================
    SELECT id INTO v_cart_id
    FROM   carts
    WHERE  user_id = v_user_id;

    IF v_cart_id IS NULL THEN
        RAISE EXCEPTION 'Cart not found.'
            USING ERRCODE = 'P0001';
    END IF;

    -- =========================================================================
    -- 4. VALIDATE CART NOT EMPTY
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM cart_items WHERE cart_id = v_cart_id
    ) THEN
        RAISE EXCEPTION 'Cart is empty.'
            USING ERRCODE = 'P0001';
    END IF;

    -- =========================================================================
    -- 5. BUILD FROZEN SHIPPING SNAPSHOT
    -- =========================================================================
    v_shipping_snapshot := jsonb_build_object(
        'recipient_name', p_recipient_name,
        'phone',          p_phone,
        'address_detail', p_address_detail,
        'province',       p_province,
        'city',           p_city,
        'postal_code',    p_postal_code
    );

    -- =========================================================================
    -- 6. VALIDATE + LOCK + CALCULATE SUBTOTAL
    --
    -- For each cart item:
    --   a. Validate product is active (before locking — cheap check).
    --   b. Lock the product row FOR UPDATE.
    --   c. Re-read stock AFTER lock (concurrency-safe).
    --   d. If product_sku_id IS NOT NULL, lock the SKU row FOR UPDATE
    --      and re-read its stock.
    --   e. Validate stock >= quantity using the LOCKED values.
    --   f. Accumulate subtotal.
    --
    -- This prevents the TOCTOU race where two concurrent buyers both pass
    -- a stock check on stale (pre-lock) values, then one fails in the
    -- trigger.  By re-reading after the lock, only one buyer sees the
    -- available stock first; the other blocks until the first commits,
    -- then sees the updated (depleted) stock and fails here with a clean
    -- error instead of a trigger exception.
    -- =========================================================================
    FOR v_cart_item IN
        SELECT ci.id            AS ci_id,
               ci.product_id,
               ci.product_sku_id,
               ci.quantity       AS ci_quantity,
               ci.unit_price     AS ci_unit_price,
               p.name            AS product_name,
               p.price           AS product_price,
               p.discount_price  AS product_discount_price,
               p.status          AS product_status,
               p.store_id,
               s.seller_id
        FROM   cart_items ci
        JOIN   products p ON p.id = ci.product_id
        JOIN   stores   s ON s.id = p.store_id
        WHERE  ci.cart_id = v_cart_id
    LOOP
        -- -----------------------------------------------------------------
        -- 6a. Validate product is active (cheap check before expensive lock)
        -- -----------------------------------------------------------------
        IF v_cart_item.product_status != 'active' THEN
            RAISE EXCEPTION
                'Product "%" is no longer available.',
                v_cart_item.product_name
                USING ERRCODE = 'P0001';
        END IF;

        -- -----------------------------------------------------------------
        -- 6b. Lock product row FOR UPDATE
        --     This blocks concurrent transactions from mutating the same row
        --     until this transaction commits or rolls back.
        -- -----------------------------------------------------------------
        SELECT stock INTO v_locked_stock
        FROM   products
        WHERE  id = v_cart_item.product_id
        FOR UPDATE;

        -- -----------------------------------------------------------------
        -- 6c. Validate product stock using LOCKED (current) value
        -- -----------------------------------------------------------------
        IF v_locked_stock IS NULL THEN
            RAISE EXCEPTION
                'Product "%" not found.',
                v_cart_item.product_name
                USING ERRCODE = 'P0001';
        END IF;

        IF v_locked_stock < v_cart_item.ci_quantity THEN
            RAISE EXCEPTION
                'Insufficient stock for "%": available %, requested %.',
                v_cart_item.product_name,
                v_locked_stock,
                v_cart_item.ci_quantity
                USING ERRCODE = 'P0001';
        END IF;

        -- -----------------------------------------------------------------
        -- 6d. Lock SKU row FOR UPDATE if applicable + validate SKU stock
        -- -----------------------------------------------------------------
        IF v_cart_item.product_sku_id IS NOT NULL THEN
            SELECT stock INTO v_locked_sku_stock
            FROM   product_skus
            WHERE  id = v_cart_item.product_sku_id
            FOR UPDATE;

            IF v_locked_sku_stock IS NULL THEN
                RAISE EXCEPTION
                    'SKU for product "%" not found.',
                    v_cart_item.product_name
                    USING ERRCODE = 'P0001';
            END IF;

            IF v_locked_sku_stock < v_cart_item.ci_quantity THEN
                RAISE EXCEPTION
                    'Insufficient SKU stock for "%": available %, requested %.',
                    v_cart_item.product_name,
                    v_locked_sku_stock,
                    v_cart_item.ci_quantity
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;

        -- -----------------------------------------------------------------
        -- 6e. Accumulate subtotal using effective price
        -- -----------------------------------------------------------------
        v_unit_price    := COALESCE(v_cart_item.product_discount_price,
                                    v_cart_item.product_price);
        v_item_subtotal := v_unit_price * v_cart_item.ci_quantity;
        v_subtotal      := v_subtotal + v_item_subtotal;
    END LOOP;

    IF v_subtotal <= 0 THEN
        RAISE EXCEPTION 'Order subtotal must be positive.'
            USING ERRCODE = 'P0001';
    END IF;

    -- =========================================================================
    -- 7. CALCULATE FEES
    -- =========================================================================
    v_platform_fee := calculate_platform_fee(v_subtotal);
    v_total        := calculate_order_total(v_subtotal, 0, 0, v_platform_fee);

    -- =========================================================================
    -- 8. GENERATE UNIQUE ORDER NUMBER
    -- =========================================================================
    v_order_number := generate_order_number();

    -- =========================================================================
    -- 9. PAYMENT DUE — 24 hour window
    -- =========================================================================
    v_payment_due_at := NOW() + INTERVAL '24 hours';

    -- =========================================================================
    -- 10. CREATE ORDER ROW
    -- =========================================================================
    INSERT INTO orders (
        buyer_id,
        order_number,
        status,
        subtotal,
        shipping_cost,
        discount_amount,
        platform_fee,
        total_amount,
        payment_status,
        payment_due_at,
        shipping_snapshot
    ) VALUES (
        v_user_id,
        v_order_number,
        'pending'::order_status,
        v_subtotal,
        0,                         -- shipping_cost (initial impl)
        0,                         -- discount_amount (initial impl)
        v_platform_fee,
        v_total,
        'pending'::payment_status,
        v_payment_due_at,
        v_shipping_snapshot
    )
    RETURNING id INTO v_order_id;

    -- =========================================================================
    -- 11. CREATE ORDER ITEMS
    --     Each INSERT fires trg_reserve_product_stock which:
    --       - Re-locks the product row (re-entrant, same txn — no-op)
    --       - Re-validates stock (belt-and-suspenders)
    --       - Decrements product stock
    --       - Inserts stock_movements audit trail
    --       - If SKU: locks, validates, decrements SKU stock
    --     The pre-validation in step 6 ensures we fail fast with clean
    --     business errors instead of triggering constraint violations.
    -- =========================================================================
    FOR v_cart_item IN
        SELECT ci.product_id,
               ci.product_sku_id,
               ci.quantity       AS ci_quantity,
               p.name            AS product_name,
               p.price           AS product_price,
               p.discount_price  AS product_discount_price,
               p.store_id,
               s.seller_id
        FROM   cart_items ci
        JOIN   products p ON p.id = ci.product_id
        JOIN   stores   s ON s.id = p.store_id
        WHERE  ci.cart_id = v_cart_id
    LOOP
        -- Primary product image (frozen snapshot)
        SELECT image_url INTO v_image_url
        FROM   product_images
        WHERE  product_id = v_cart_item.product_id
        AND    is_primary = TRUE
        LIMIT  1;

        v_unit_price    := COALESCE(v_cart_item.product_discount_price,
                                    v_cart_item.product_price);
        v_item_subtotal := v_unit_price * v_cart_item.ci_quantity;

        INSERT INTO order_items (
            order_id,
            product_id,
            product_sku_id,
            seller_id,
            store_id,
            product_name,
            product_image_url,
            unit_price,
            quantity,
            subtotal,
            status
        ) VALUES (
            v_order_id,
            v_cart_item.product_id,
            v_cart_item.product_sku_id,
            v_cart_item.seller_id,
            v_cart_item.store_id,
            v_cart_item.product_name,
            v_image_url,
            v_unit_price,
            v_cart_item.ci_quantity,
            v_item_subtotal,
            'pending'::order_status
        );
    END LOOP;

    -- =========================================================================
    -- 12. CREATE PENDING PAYMENT
    --     Unique transaction_id for the unique constraint.
    -- =========================================================================
    v_payment_id     := gen_random_uuid();
    v_transaction_id := 'MX-PAY-'
                     || TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS')
                     || '-'
                     || UPPER(SUBSTRING(MD5(v_payment_id::TEXT) FROM 1 FOR 8));

    INSERT INTO payments (
        order_id,
        payment_method,
        transaction_id,
        amount,
        fee_amount,
        status,
        expired_at
    ) VALUES (
        v_order_id,
        p_payment_method,
        v_transaction_id,
        v_total,
        0,
        'pending'::payment_status,
        v_payment_due_at
    );

    -- =========================================================================
    -- 13. REMOVE ORDERED CART ITEMS
    -- =========================================================================
    DELETE FROM cart_items WHERE cart_id = v_cart_id;

    -- =========================================================================
    -- 14. RETURN ORDER REFERENCE
    -- =========================================================================
    RETURN jsonb_build_object(
        'order_id',     v_order_id,
        'order_number', v_order_number
    );
END;
$$;

COMMENT ON FUNCTION create_order_from_cart IS
'Atomic buyer checkout: validates buyer + cart + stock, creates order + items + payment, clears cart. SECURITY DEFINER — runs as owner. Concurrency-safe: locks + re-reads stock after lock.';
