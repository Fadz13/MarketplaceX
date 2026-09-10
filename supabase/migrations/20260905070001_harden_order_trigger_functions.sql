-- =============================================================================
-- MARKETPLACEX — HARDEN TRIGGER FUNCTIONS + FUNCTION PRIVILEGES
-- File   : database/008_harden_order_trigger_functions.sql
-- Version: 1.0
-- Depends: 001_schema.sql (all trigger functions must exist)
--
-- Purpose
--   1. Harden three SECURITY DEFINER-sensitive trigger functions so they
--      execute safely regardless of caller context.  This is the LIVE
--      database migration — not just the schema file.
--   2. Lock down function privileges so only authenticated buyers can
--      execute the checkout RPC, and public cannot.
--
-- Safety
--   Every CREATE OR REPLACE preserves the existing function body verbatim.
--   Only the function attributes (SECURITY DEFINER, search_path) change.
--   No business logic is modified.
-- =============================================================================

-- =============================================================================
-- SECTION 1: HARDEN TRIGGER FUNCTIONS
-- =============================================================================

-- 1a. fn_reserve_product_stock
-- Fires AFTER INSERT on order_items.
-- Writes to: products (UPDATE), stock_movements (INSERT), product_skus (UPDATE).
-- Previously: plain plpgsql (no explicit SECURITY DEFINER).
-- Now: SECURITY DEFINER with explicit search_path so it can write to
--      products/stock_movements/product_skus even when triggered from a
--      buyer-context function.
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_reserve_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_before_product INTEGER;
    v_before_sku     INTEGER;
BEGIN
    -- Lock & check product stock
    SELECT stock INTO v_before_product FROM products WHERE id = NEW.product_id FOR UPDATE;
    IF v_before_product IS NULL THEN
        RAISE EXCEPTION 'Product % not found', NEW.product_id USING ERRCODE = 'P0001';
    END IF;
    IF v_before_product < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock: product % has %, need %',
            NEW.product_id, v_before_product, NEW.quantity USING ERRCODE = 'P0001';
    END IF;

    UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;

    INSERT INTO stock_movements (
        product_id, product_sku_id, movement_type,
        quantity_delta, stock_before, stock_after, reference_type, reference_id
    ) VALUES (
        NEW.product_id, NEW.product_sku_id, 'sale',
        -NEW.quantity, v_before_product, v_before_product - NEW.quantity,
        'order', NEW.order_id
    );

    -- SKU stock if specified
    IF NEW.product_sku_id IS NOT NULL THEN
        SELECT stock INTO v_before_sku FROM product_skus WHERE id = NEW.product_sku_id FOR UPDATE;
        IF v_before_sku < NEW.quantity THEN
            RAISE EXCEPTION 'Insufficient SKU stock: sku % has %, need %',
                NEW.product_sku_id, v_before_sku, NEW.quantity USING ERRCODE = 'P0001';
        END IF;
        UPDATE product_skus SET stock = stock - NEW.quantity WHERE id = NEW.product_sku_id;
    END IF;

    RETURN NEW;
END;
$$;

-- 1b. fn_restore_product_stock
-- Fires AFTER UPDATE OF status ON orders.
-- Writes to: products (UPDATE), product_skus (UPDATE), stock_movements (INSERT).
-- Same hardening pattern.
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_restore_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NEW.status IN ('cancelled','refunded')
       AND OLD.status NOT IN ('cancelled','refunded') THEN

        -- Restore product stock
        UPDATE products p
        SET stock = p.stock + oi.quantity
        FROM order_items oi WHERE oi.order_id = NEW.id AND p.id = oi.product_id;

        -- Restore SKU stock
        UPDATE product_skus sk
        SET stock = sk.stock + oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND sk.id = oi.product_sku_id AND oi.product_sku_id IS NOT NULL;

        -- Audit trail
        INSERT INTO stock_movements (
            product_id, product_sku_id, movement_type,
            quantity_delta, stock_before, stock_after, reference_type, reference_id
        )
        SELECT oi.product_id, oi.product_sku_id, 'return',
               oi.quantity, p.stock - oi.quantity, p.stock, 'order', NEW.id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- 1c. fn_complete_order_stats
-- Fires AFTER UPDATE OF status ON orders.
-- Writes to: products, stores, seller_balances, seller_balance_transactions, orders.
-- Same hardening pattern.
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_complete_order_stats()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_fee_rate NUMERIC := 0.02;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- sold_count
        UPDATE products p SET sold_count = p.sold_count + oi.quantity
        FROM order_items oi WHERE oi.order_id = NEW.id AND p.id = oi.product_id;

        -- store aggregates
        UPDATE stores s
        SET total_sales   = s.total_sales + agg.item_count,
            total_revenue = s.total_revenue + agg.revenue
        FROM (
            SELECT store_id, COUNT(*) AS item_count, SUM(subtotal) AS revenue
            FROM order_items WHERE order_id = NEW.id GROUP BY store_id
        ) agg WHERE s.id = agg.store_id;

        -- seller balance credit
        UPDATE seller_balances sb
        SET available_balance = sb.available_balance + agg.net,
            total_earned      = sb.total_earned      + agg.net
        FROM (
            SELECT seller_id, SUM(subtotal) * (1 - v_fee_rate) AS net
            FROM order_items WHERE order_id = NEW.id GROUP BY seller_id
        ) agg WHERE sb.seller_id = agg.seller_id;

        -- balance ledger
        INSERT INTO seller_balance_transactions (
            seller_id, transaction_type, amount,
            balance_before, balance_after, reference_type, reference_id, description
        )
        SELECT agg.seller_id, 'credit', agg.net,
               sb.available_balance - agg.net, sb.available_balance,
               'order', NEW.id, 'Order completed: ' || NEW.order_number
        FROM (
            SELECT seller_id, SUM(subtotal) * (1 - v_fee_rate) AS net
            FROM order_items WHERE order_id = NEW.id GROUP BY seller_id
        ) agg
        JOIN seller_balances sb ON sb.seller_id = agg.seller_id;

        UPDATE orders SET completed_at = NOW() WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================================================
-- SECTION 2: FUNCTION PRIVILEGES
--
-- create_order_from_cart is SECURITY DEFINER — the function body runs as the
-- owner, but we must control WHO can invoke it at all.
--   - REVOKE from PUBLIC so unauthenticated / anonymous callers cannot invoke.
--   - GRANT to authenticated so logged-in buyers can invoke.
-- =============================================================================

-- Revoke from PUBLIC (includes anon, authenticated, and every other role)
REVOKE EXECUTE ON FUNCTION create_order_from_cart(
    VARCHAR(150), VARCHAR(20), TEXT, VARCHAR(100), VARCHAR(100), VARCHAR(10),
    payment_method
) FROM PUBLIC;

-- Grant only to authenticated (logged-in users)
GRANT EXECUTE ON FUNCTION create_order_from_cart(
    VARCHAR(150), VARCHAR(20), TEXT, VARCHAR(100), VARCHAR(100), VARCHAR(10),
    payment_method
) TO authenticated;

-- Also revoke/restrict the hardened trigger functions.
-- Trigger functions are not called directly by application code (they fire
-- via triggers), so revoking EXECUTE from PUBLIC is a defense-in-depth measure.
REVOKE EXECUTE ON FUNCTION fn_reserve_product_stock() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_restore_product_stock() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_complete_order_stats() FROM PUBLIC;
