-- =============================================================================
-- MARKETPLACEX — BIND fn_reverse_order_stats TRIGGER TO ORDERS TABLE
--
-- Purpose
--   The previous migration (20260913000000) created fn_reverse_order_stats()
--   but did NOT bind it as a trigger on the orders table.  This migration
--   attaches it so that completed→refunded transitions actually fire.
--
-- Safety
--   DROP IF EXISTS before CREATE to be idempotent.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_reverse_order_stats ON orders;

CREATE TRIGGER trg_reverse_order_stats
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_reverse_order_stats();
