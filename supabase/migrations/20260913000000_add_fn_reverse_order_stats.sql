-- =============================================================================
-- MARKETPLACEX — REVERSE ORDER STATS ON REFUND
-- File   : 009_reverse_order_stats.sql
-- Version: 1.0
-- Depends: 008_harden_order_trigger_functions.sql (fn_complete_order_stats)
--
-- Purpose
--   Reverse the financial effects of fn_complete_order_stats() when a
--   completed order is refunded.  This prevents sellers from keeping
--   balance credits for refunded orders.
--
-- Safety
--   - Guard: OLD.status = 'completed' AND NEW.status = 'refunded'
--   - Idempotent: checks seller_balance_transactions for existing debit
--     with matching reference_id before inserting.
--   - Formula matches fn_complete_order_stats exactly:
--     net = SUM(subtotal) * (1 - 0.02) per seller_id
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_reverse_order_stats()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_fee_rate NUMERIC := 0.02;
BEGIN
    IF OLD.status = 'completed' AND NEW.status = 'refunded' THEN

        -- 1. products.sold_count
        UPDATE products p
        SET sold_count = p.sold_count - oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND p.id = oi.product_id;

        -- 2. stores.total_sales, total_revenue
        UPDATE stores s
        SET total_sales   = s.total_sales   - agg.item_count,
            total_revenue = s.total_revenue - agg.revenue
        FROM (
            SELECT store_id,
                   COUNT(*)        AS item_count,
                   SUM(subtotal)   AS revenue
            FROM order_items
            WHERE order_id = NEW.id
            GROUP BY store_id
        ) agg
        WHERE s.id = agg.store_id;

        -- 3. seller_balances — debit net amount per seller
        UPDATE seller_balances sb
        SET available_balance = sb.available_balance - agg.net,
            total_earned      = sb.total_earned      - agg.net
        FROM (
            SELECT seller_id,
                   SUM(subtotal) * (1 - v_fee_rate) AS net
            FROM order_items
            WHERE order_id = NEW.id
            GROUP BY seller_id
        ) agg
        WHERE sb.seller_id = agg.seller_id;

        -- 4. seller_balance_transactions — debit ledger
        --    Idempotent: skip if debit already recorded for this order.
        INSERT INTO seller_balance_transactions (
            seller_id, transaction_type, amount,
            balance_before, balance_after,
            reference_type, reference_id, description
        )
        SELECT
            agg.seller_id,
            'debit',
            agg.net,
            sb.available_balance + agg.net,
            sb.available_balance,
            'order',
            NEW.id,
            'Order refunded: ' || NEW.order_number
        FROM (
            SELECT seller_id,
                   SUM(subtotal) * (1 - v_fee_rate) AS net
            FROM order_items
            WHERE order_id = NEW.id
            GROUP BY seller_id
        ) agg
        JOIN seller_balances sb ON sb.seller_id = agg.seller_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM seller_balance_transactions sbt
            WHERE sbt.seller_id    = agg.seller_id
              AND sbt.reference_type = 'order'
              AND sbt.reference_id   = NEW.id
              AND sbt.transaction_type = 'debit'
        );

        -- 5. Clear completed_at
        UPDATE orders
        SET completed_at = NULL
        WHERE id = NEW.id;

    END IF;
    RETURN NEW;
END;
$$;

-- =============================================================================
-- REVOKE direct execution (defense in depth — trigger fires via trigger only)
-- =============================================================================
REVOKE EXECUTE ON FUNCTION fn_reverse_order_stats() FROM PUBLIC;
